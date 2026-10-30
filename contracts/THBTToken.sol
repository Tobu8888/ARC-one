// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract THBTToken is ERC20, Ownable {
    error ZeroAddressMinter();

    mapping(address => bool) public minters;

    event MinterRoleGranted(address indexed account);
    event MinterRoleRevoked(address indexed account);

    modifier onlyMinter() {
        if (msg.sender != owner() && !minters[msg.sender]) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }

    constructor() ERC20("Thai Baht Token", "THBT") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 2;
    }

    function grantMinterRole(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddressMinter();
        minters[account] = true;
        emit MinterRoleGranted(account);
    }

    function revokeMinterRole(address account) external onlyOwner {
        minters[account] = false;
        emit MinterRoleRevoked(account);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
