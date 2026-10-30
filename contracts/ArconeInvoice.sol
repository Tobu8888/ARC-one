// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ArconeInvoice {
    using SafeERC20 for IERC20;

    enum InvoiceStatus {
        Pending,
        Paid,
        Cancelled
    }

    struct Invoice {
        uint256 id;
        address payee;
        address payer;
        uint256 amount;
        string memo;
        uint256 dueDate;
        InvoiceStatus status;
        uint256 paidAt;
    }

    error ZeroAddress();
    error ZeroAmount();
    error InvoiceNotFound();
    error NotPayee();
    error NotAuthorizedPayer();
    error AlreadyPaid();
    error AlreadyCancelled();
    error InvoiceOverdue();
    error InsufficientAllowance();
    error NotPending();

    IERC20 public immutable usdc;
    address public owner;
    uint256 public invoiceCount;
    mapping(uint256 => Invoice) public invoices;

    event InvoiceCreated(
        uint256 indexed id,
        address indexed payee,
        address indexed payer,
        uint256 amount,
        string memo,
        uint256 dueDate
    );
    event InvoicePaid(uint256 indexed id, address indexed payer, uint256 amount, uint256 paidAt);
    event InvoiceCancelled(uint256 indexed id, address indexed payee);
    event PayeeUpdated(uint256 indexed id, address indexed oldPayee, address indexed newPayee);

    constructor(address _usdc, address _owner) {
        if (_usdc == address(0) || _owner == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        owner = _owner;
    }

    function createInvoice(
        address payer,
        uint256 amount,
        string calldata memo,
        uint256 dueDate
    ) external returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();

        invoiceCount += 1;
        id = invoiceCount;

        invoices[id] = Invoice({
            id: id,
            payee: msg.sender,
            payer: payer,
            amount: amount,
            memo: memo,
            dueDate: dueDate,
            status: InvoiceStatus.Pending,
            paidAt: 0
        });

        emit InvoiceCreated(id, msg.sender, payer, amount, memo, dueDate);
    }

    function payInvoice(uint256 id) external {
        if (id == 0 || id > invoiceCount) revert InvoiceNotFound();

        Invoice storage invoice = invoices[id];

        if (invoice.status == InvoiceStatus.Paid) revert AlreadyPaid();
        if (invoice.status == InvoiceStatus.Cancelled) revert AlreadyCancelled();

        if (invoice.payer != address(0) && msg.sender != invoice.payer) revert NotAuthorizedPayer();
        // dueDate is stored as metadata only — overdue invoices remain payable.
        // The payee's mechanism to block a late payment is cancelInvoice().
        if (usdc.allowance(msg.sender, address(this)) < invoice.amount) revert InsufficientAllowance();

        usdc.safeTransferFrom(msg.sender, address(this), invoice.amount);
        usdc.safeTransfer(invoice.payee, invoice.amount);

        invoice.status = InvoiceStatus.Paid;
        invoice.paidAt = block.timestamp;
        invoice.payer = msg.sender;

        emit InvoicePaid(id, msg.sender, invoice.amount, block.timestamp);
    }

    function cancelInvoice(uint256 id) external {
        if (id == 0 || id > invoiceCount) revert InvoiceNotFound();

        Invoice storage invoice = invoices[id];

        if (msg.sender != invoice.payee) revert NotPayee();
        if (invoice.status == InvoiceStatus.Paid) revert AlreadyPaid();
        if (invoice.status == InvoiceStatus.Cancelled) revert AlreadyCancelled();

        invoice.status = InvoiceStatus.Cancelled;

        emit InvoiceCancelled(id, msg.sender);
    }

    function updatePayeeAddress(uint256 id, address newPayee) external {
        if (id == 0 || id > invoiceCount) revert InvoiceNotFound();

        Invoice storage invoice = invoices[id];

        if (msg.sender != invoice.payee) revert NotPayee();
        if (invoice.status != InvoiceStatus.Pending) revert NotPending();
        if (newPayee == address(0)) revert ZeroAddress();

        address oldPayee = invoice.payee;
        invoice.payee = newPayee;

        emit PayeeUpdated(id, oldPayee, newPayee);
    }

    function getInvoice(uint256 id) external view returns (Invoice memory) {
        if (id == 0 || id > invoiceCount) revert InvoiceNotFound();
        return invoices[id];
    }
}
