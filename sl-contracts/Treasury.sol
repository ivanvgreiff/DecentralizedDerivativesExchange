// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury {
    /// @notice Token held by this Treasury
    IERC20 public immutable token;

    /// @notice The Governor contract that controls this Treasury
    address public immutable governor;

    /// @param _governor The address of the Governor contract
    /// @param _token The address of the ERC20Votes token
    constructor(address _governor, address _token) {
        require(_governor != address(0), "Governor address required");
        require(_token != address(0), "Token address required");
        governor = _governor;
        token = IERC20(_token);
    }

    /// @notice Transfers tokens from Treasury to recipient
    /// @dev Callable only by the Governor contract via proposal execution
    function release(address to, uint256 amount) external {
        require(msg.sender == governor, "Only governor can release");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        bool success = token.transfer(to, amount);
        require(success, "Token transfer failed");
    }

    /// @notice View current Treasury token balance
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
