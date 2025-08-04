// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IPutOption {
    function initialize(
        address short,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external;
}

interface ICallOption {
    function initialize(
        address short,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external;
}

interface IExercisableOption {
    function exercisedVolume() external view returns (uint256);
}

contract OptionsBook {
    address public immutable putOptionImplementation;
    address public immutable callOptionImplementation;

    address[] public allPutOptions;
    address[] public allCallOptions;

    uint256 public totalVolume;

    event PutOptionCreated(address indexed optionAddress, address indexed creator);
    event CallOptionCreated(address indexed optionAddress, address indexed creator);
    event VolumeUpdated(uint256 newTotalVolume);

    constructor(address _putOptionImplementation, address _callOptionImplementation) {
        require(_putOptionImplementation != address(0), "Invalid put implementation");
        require(_callOptionImplementation != address(0), "Invalid call implementation");
        putOptionImplementation = _putOptionImplementation;
        callOptionImplementation = _callOptionImplementation;
    }

    function createAndFundCallOption(
        address tokenHolder,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external returns (address newOption) {
        // Step 1: Clone the call option implementation
        newOption = Clones.clone(callOptionImplementation);

        // Step 2: Initialize with provided parameters
        ICallOption(newOption).initialize(
            msg.sender,
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );

        // Step 3: Track the new call option instance
        allCallOptions.push(newOption);
        emit CallOptionCreated(newOption, msg.sender);

        // Step 4: Short must fund the contract with underlyingToken (2TK)
        // This is what the long will receive if the option is exercised
        // Pull tokens from tokenHolder (TransactionBundler)
        require(
            IERC20(underlyingToken).transferFrom(tokenHolder, address(this), optionSize),
            "Pull underlying failed"
        );

        require(
            IERC20(underlyingToken).transfer(newOption, optionSize),
            "Forward underlying failed"
        );
    }

    function createAndFundPutOption(
        address tokenHolder,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external returns (address newOption) {
        newOption = Clones.clone(putOptionImplementation);

        IPutOption(newOption).initialize(
            msg.sender,
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );

        allPutOptions.push(newOption);
        emit PutOptionCreated(newOption, msg.sender);

        // Compute the amount of tokens required to fund
        uint256 totalStrike = (optionSize * strikePrice) / 1e18;

        // Step 1: Pull funds from tokenHolder (TransactionBundler) into OptionsBook
        require(
            IERC20(strikeToken).transferFrom(tokenHolder, address(this), totalStrike),
            "Pull failed"
        );

        // Step 2: Forward to the option contract
        require(
            IERC20(strikeToken).transfer(newOption, totalStrike),
            "Forward failed"
        );
    }

    function enterAndPayPremium(
        address optionAddress,
        address strikeToken,
        uint256 premium
    ) external {
        // Step 1: Pull premium from long (msg.sender)
        require(
            IERC20(strikeToken).transferFrom(msg.sender, address(this), premium),
            "Pull premium failed"
        );

        // Step 2: Forward premium to option contract
        require(
            IERC20(strikeToken).transfer(optionAddress, premium),
            "Forward premium failed"
        );

        // Step 3: Enter as long — msg.sender will become the long
        (bool success, ) = optionAddress.call(
            abi.encodeWithSignature("enterAsLong()")
        );
        require(success, "enterAsLong failed");
    }

    function updateVolumeFrom(address[] calldata exercisedOptions) external {
        for (uint256 i = 0; i < exercisedOptions.length; i++) {
            uint256 volume = IExercisableOption(exercisedOptions[i]).exercisedVolume();
            totalVolume += volume;
        }
        emit VolumeUpdated(totalVolume);
    }

    function executeBatch(address[] calldata targets, bytes[] calldata data) external {
        require(targets.length == data.length, "Mismatched inputs");

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call(data[i]);
            require(success, string(result));
        }
    }

    function pullAndForward(
        address token,
        address to,
        uint256 amount
    ) external {
        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "TransferFrom failed"
        );
        require(IERC20(token).transfer(to, amount), "Forward failed");
    }

    function getAllPutOptions() external view returns (address[] memory) {
        return allPutOptions;
    }

    function getAllCallOptions() external view returns (address[] memory) {
        return allCallOptions;
    }

    /// @notice Single-transaction call option creation: pull tokens from user and create funded option
    function approveAndCreateCallOption(
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external returns (address newOption) {
        // Step 1: Clone the call option implementation
        newOption = Clones.clone(callOptionImplementation);

        // Step 2: Initialize with provided parameters
        ICallOption(newOption).initialize(
            msg.sender,           // User is the short
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );

        // Step 3: Track the new call option instance
        allCallOptions.push(newOption);
        emit CallOptionCreated(newOption, msg.sender);

        // Step 4: Pull tokens directly from user (short must fund with underlyingToken)
        require(
            IERC20(underlyingToken).transferFrom(msg.sender, address(this), optionSize),
            "Pull underlying failed"
        );

        // Step 5: Forward to the option contract
        require(
            IERC20(underlyingToken).transfer(newOption, optionSize),
            "Forward underlying failed"
        );
    }

    /// @notice Single-transaction put option creation: pull tokens from user and create funded option
    function approveAndCreatePutOption(
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external returns (address newOption) {
        // Step 1: Clone the put option implementation
        newOption = Clones.clone(putOptionImplementation);

        // Step 2: Initialize with provided parameters
        IPutOption(newOption).initialize(
            msg.sender,           // User is the short
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );

        // Step 3: Track the new put option instance
        allPutOptions.push(newOption);
        emit PutOptionCreated(newOption, msg.sender);

        // Step 4: Compute required strike tokens and pull from user
        uint256 totalStrike = (optionSize * strikePrice) / 1e18;
        require(
            IERC20(strikeToken).transferFrom(msg.sender, address(this), totalStrike),
            "Pull strike tokens failed"
        );

        // Step 5: Forward to the option contract
        require(
            IERC20(strikeToken).transfer(newOption, totalStrike),
            "Forward strike tokens failed"
        );
    }

    /// @notice Single-transaction enter as long: pull premium from user and enter option
    function approveAndEnterAsLong(
        address optionAddress,
        address strikeToken,
        uint256 premium
    ) external {
        // Step 1: Pull premium directly from user
        require(
            IERC20(strikeToken).transferFrom(msg.sender, address(this), premium),
            "Pull premium failed"
        );

        // Step 2: Forward premium to option contract
        require(
            IERC20(strikeToken).transfer(optionAddress, premium),
            "Forward premium failed"
        );

        // Step 3: Enter as long — msg.sender will become the long
        (bool success, ) = optionAddress.call(
            abi.encodeWithSignature("enterAsLong()")
        );
        require(success, "enterAsLong failed");
    }
}
