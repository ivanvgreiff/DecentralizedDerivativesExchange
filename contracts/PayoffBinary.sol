// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface PayoffFormulaInterface {
    function payout(uint256 price) external view returns (uint256);
} 