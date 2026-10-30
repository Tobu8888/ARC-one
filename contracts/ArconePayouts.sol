// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ArconePayouts {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidBps();
    error InsufficientAllowance();
    error NotOwner();

    IERC20 public usdc;
    address public treasury;
    address public owner;
    uint16 public withholdingBps;
    uint256 public totalPayouts;

    event PayoutSent(
        uint256 indexed payoutId,
        address indexed sender,
        address indexed recipient,
        uint256 grossAmount,
        uint256 withheldAmount,
        uint256 netAmount,
        uint16 withholdingBps,
        string memo,
        uint256 timestamp
    );
    event WithholdingBpsUpdated(uint16 oldBps, uint16 newBps);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdc, address _treasury, uint16 _initialBps, address _owner) {
        if (_usdc == address(0) || _treasury == address(0) || _owner == address(0)) revert ZeroAddress();
        if (_initialBps > 1000) revert InvalidBps();

        usdc = IERC20(_usdc);
        treasury = _treasury;
        owner = _owner;
        withholdingBps = _initialBps;
    }

    function sendPayout(address recipient, uint256 grossAmount, string calldata memo) external {
        if (recipient == address(0)) revert ZeroAddress();
        if (grossAmount == 0) revert ZeroAmount();
        if (usdc.allowance(msg.sender, address(this)) < grossAmount) revert InsufficientAllowance();

        usdc.safeTransferFrom(msg.sender, address(this), grossAmount);

        uint256 withheld = (grossAmount * withholdingBps) / 10_000;
        uint256 net = grossAmount - withheld;

        usdc.safeTransfer(recipient, net);
        usdc.safeTransfer(treasury, withheld);

        totalPayouts += 1;

        emit PayoutSent(
            totalPayouts,
            msg.sender,
            recipient,
            grossAmount,
            withheld,
            net,
            withholdingBps,
            memo,
            block.timestamp
        );
    }

    function setWithholdingBps(uint16 newBps) external onlyOwner {
        if (newBps > 1000) revert InvalidBps();

        uint16 oldBps = withholdingBps;
        withholdingBps = newBps;

        emit WithholdingBpsUpdated(oldBps, newBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function getQuote(uint256 grossAmount) external view returns (uint256 withheld, uint256 net) {
        withheld = (grossAmount * withholdingBps) / 10_000;
        net = grossAmount - withheld;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
