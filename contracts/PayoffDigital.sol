// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PayoffFormulaInterface.sol";

contract PayoffDigital is PayoffFormulaInterface {
    // Example: Binary option payoff
    function payout(uint256 price) external pure override returns (uint256) {
        // TODO: Implement digital (binary) payoff logic
        return price > 1000 ? 1 : 0;
    }
} 