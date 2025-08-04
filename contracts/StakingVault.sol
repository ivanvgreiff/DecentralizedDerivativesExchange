// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IOptionsBook {
    function callOptionImplementation() external view returns (address);

    function createAndFundCallOptionDeterministic(
        address tokenHolder,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle,
        bytes32 salt
    ) external returns (address);
}

contract StakingVault {
    mapping(address => mapping(address => uint256)) public userBalances; // user => token => amount

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event OptionCreated(address indexed user, address optionAddress);

    function deposit(address token, uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        userBalances[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        require(userBalances[msg.sender][token] >= amount, "Insufficient balance");
        userBalances[msg.sender][token] -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "Withdraw failed");

        emit Withdrawn(msg.sender, token, amount);
    }

    function createCallOptionFromVault(
        address optionsBook,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle,
        bytes32 salt
    ) external {
        require(userBalances[msg.sender][underlyingToken] >= optionSize, "Not enough deposited");

        // Predict future option address
        address impl = IOptionsBook(optionsBook).callOptionImplementation();
        address predictedOption = Clones.predictDeterministicAddress(impl, salt, optionsBook);

        // Approve the predicted contract to pull tokens
        require(IERC20(underlyingToken).approve(predictedOption, optionSize), "Approve failed");

        // Decrease internal balance
        userBalances[msg.sender][underlyingToken] -= optionSize;

        // Create and fund the option
        address newOption = IOptionsBook(optionsBook).createAndFundCallOptionDeterministic(
            address(this),
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle,
            salt
        );

        emit OptionCreated(msg.sender, newOption);
    }

    function getBalance(address user, address token) external view returns (uint256) {
        return userBalances[user][token];
    }
}
