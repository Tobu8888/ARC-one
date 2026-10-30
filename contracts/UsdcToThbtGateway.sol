// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {THBTToken} from "./THBTToken.sol";

contract UsdcToThbtGateway {
    using SafeERC20 for IERC20;

    error NotOwner();
    error ZeroAddress();
    error InvalidRate();
    error ZeroAmount();

    IERC20 public usdc;
    THBTToken public thbt;
    uint256 public thbtPerUsdc;
    address public owner;
    uint256 public totalUsdcReceived;

    event Swapped(address indexed user, uint256 usdcAmount, uint256 thbtAmount);
    event RateUpdated(uint256 oldRate, uint256 newRate);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdc, address _thbt, uint256 _initialRate) {
        if (_usdc == address(0) || _thbt == address(0)) revert ZeroAddress();
        if (_initialRate == 0) revert InvalidRate();

        usdc = IERC20(_usdc);
        thbt = THBTToken(_thbt);
        thbtPerUsdc = _initialRate;
        owner = msg.sender;
    }

    function swap(uint256 usdcAmount) external {
        if (usdcAmount == 0) revert ZeroAmount();

        uint256 thbtAmount = getQuote(usdcAmount);

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        totalUsdcReceived += usdcAmount;

        thbt.mint(msg.sender, thbtAmount);

        emit Swapped(msg.sender, usdcAmount, thbtAmount);
    }

    function setRate(uint256 newRate) external onlyOwner {
        if (newRate == 0) revert InvalidRate();

        uint256 oldRate = thbtPerUsdc;
        thbtPerUsdc = newRate;

        emit RateUpdated(oldRate, newRate);
    }

    function withdrawUsdc(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransfer(to, amount);
    }

    function getQuote(uint256 usdcAmount) public view returns (uint256 thbtAmount) {
        thbtAmount = (usdcAmount * thbtPerUsdc) / 1e6;
    }
}
