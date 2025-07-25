// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PayoffFormulaInterface.sol";

contract PayoffLinear is PayoffFormulaInterface {
    // Example: Vanilla call/put formula
    function payout(uint256 price) external pure override returns (uint256) {
        // TODO: Implement linear payoff logic
        return price;
    }
} 