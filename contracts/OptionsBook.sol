// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CallOptionContract.sol";
import "./PutOptionContract.sol";

contract OptionsBook {
    address public callImpl;
    address public putImpl;

    uint256 public totalExercisedStrikeTokens;

    address[] public callOptions;
    address[] public putOptions;

    mapping(address => bool) public isExercised;
    mapping(address => bool) public isCallOption;
    mapping(address => bool) public isKnownClone;

    mapping(address => address) public longPosition;  // option => long address
    mapping(address => address) public shortPosition; // option => short address

    event OptionCreated(address indexed creator, address indexed instance, string optionType);
    event OptionExercised(address indexed option, uint256 strikeTokenAmount);

    constructor(address _callImpl, address _putImpl) {
        callImpl = _callImpl;
        putImpl = _putImpl;
    }

    function createAndFundCallOption(
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        address _oracle
    ) external returns (address clone) {
        clone = Clones.clone(callImpl);

        CallOptionContract(clone).initialize(
            msg.sender,
            _underlyingToken,
            _strikeToken,
            _underlyingSymbol,
            _strikeSymbol,
            _strikePrice,
            _optionSize,
            _premium,
            _oracle,
            address(this)
        );

        require(
            IERC20(_underlyingToken).transferFrom(msg.sender, clone, _optionSize),
            "Token transfer failed"
        );

        CallOptionContract(clone).fund();

        // Register only after success
        callOptions.push(clone);
        isCallOption[clone] = true;
        isKnownClone[clone] = true;
        shortPosition[clone] = msg.sender;

        emit OptionCreated(msg.sender, clone, "CALL");
    }

    function createAndFundPutOption(
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        address _oracle
    ) external returns (address clone) {
        clone = Clones.clone(putImpl);

        PutOptionContract(clone).initialize(
            msg.sender,
            _underlyingToken,
            _strikeToken,
            _underlyingSymbol,
            _strikeSymbol,
            _strikePrice,
            _optionSize,
            _premium,
            _oracle,
            address(this)
        );

        uint256 mtkToSend = (_optionSize * _strikePrice) / 1e18;

        require(
            IERC20(_strikeToken).transferFrom(msg.sender, clone, mtkToSend),
            "Strike token transfer failed"
        );

        PutOptionContract(clone).fund();

        // Register only after success
        putOptions.push(clone);
        isCallOption[clone] = false;
        isKnownClone[clone] = true;
        shortPosition[clone] = msg.sender;

        emit OptionCreated(msg.sender, clone, "PUT");
    }

    function enterAndPayPremium(address optionAddress) external {
        require(isKnownOption(optionAddress), "Unknown option");

        (bool success1, bytes memory data1) = optionAddress.call(abi.encodeWithSignature("premium()"));
        require(success1, "Failed to get premium");
        uint256 premium = abi.decode(data1, (uint256));

        (bool success2, bytes memory data2) = optionAddress.call(abi.encodeWithSignature("strikeToken()"));
        require(success2, "Failed to get strike token");
        address strikeToken = abi.decode(data2, (address));

        (bool success3, bytes memory data3) = optionAddress.call(abi.encodeWithSignature("short()"));
        require(success3, "Failed to get short address");
        address short = abi.decode(data3, (address));

        require(
            IERC20(strikeToken).transferFrom(msg.sender, address(this), premium),
            "Premium transfer to OptionsBook failed"
        );

        require(
            IERC20(strikeToken).transfer(short, premium),
            "Premium transfer to short failed"
        );

        (bool success4, ) = optionAddress.call(
            abi.encodeWithSignature("enterAsLong(address)", msg.sender)
        );
        require(success4, "enterAsLong failed");
    }

    function resolveAndExercise(address optionAddress, uint256 mtkAmount) external {
        require(isKnownOption(optionAddress), "Unknown option");

        // Fetch actual long from the option contract
        (bool successLong, bytes memory dataLong) = optionAddress.call(
            abi.encodeWithSignature("long()")
        );
        require(successLong, "Failed to get long address");
        address actualLong = abi.decode(dataLong, (address));

        require(msg.sender == actualLong, "Not authorized: only long");

        (bool success, bytes memory data) = optionAddress.call(abi.encodeWithSignature("isResolved()"));
        require(success, "isResolved() call failed");
        bool alreadyResolved = abi.decode(data, (bool));

        if (!alreadyResolved) {
            (bool resolved, ) = optionAddress.call(abi.encodeWithSignature("resolve()"));
            require(resolved, "resolve() failed");
        }

        (bool exercised, ) = optionAddress.call(
            abi.encodeWithSignature("exercise(uint256,address)", mtkAmount, actualLong)
        );
        require(exercised, "exercise() failed");
    }

    function resolveAndReclaim(address optionAddress) external {
        require(isKnownOption(optionAddress), "Unknown option");
        require(msg.sender == shortPosition[optionAddress], "Not authorized: only short");

        // Check if option is already resolved before calling resolve()
        (bool success, bytes memory data) = optionAddress.call(abi.encodeWithSignature("isResolved()"));
        require(success, "isResolved() call failed");
        bool alreadyResolved = abi.decode(data, (bool));
        
        if (!alreadyResolved) {
            (bool resolved, ) = optionAddress.call(abi.encodeWithSignature("resolve()"));
            require(resolved, "resolve() failed");
        }

        (bool reclaimed, ) = optionAddress.call(abi.encodeWithSignature("reclaim(address)", msg.sender));
        require(reclaimed, "reclaim() failed");
    }

    function notifyExercised(uint256 strikeTokenAmount) external {
        require(isKnownOption(msg.sender), "Unknown option contract");
        require(!isExercised[msg.sender], "Already marked exercised");

        isExercised[msg.sender] = true;
        totalExercisedStrikeTokens += strikeTokenAmount;

        emit OptionExercised(msg.sender, strikeTokenAmount);
    }

    function isKnownOption(address query) public view returns (bool) {
        return isKnownClone[query];
    }

    function getAllCallOptions() external view returns (address[] memory) {
        return callOptions;
    }

    function getAllPutOptions() external view returns (address[] memory) {
        return putOptions;
    }

    function getExercisedCallOptions() external view returns (address[] memory exercised) {
        uint256 count;
        for (uint256 i = 0; i < callOptions.length; i++) {
            if (isExercised[callOptions[i]]) count++;
        }

        exercised = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < callOptions.length; i++) {
            if (isExercised[callOptions[i]]) {
                exercised[idx++] = callOptions[i];
            }
        }
    }

    function getUnexercisedCallOptions() external view returns (address[] memory unexercised) {
        uint256 count;
        for (uint256 i = 0; i < callOptions.length; i++) {
            if (!isExercised[callOptions[i]]) count++;
        }

        unexercised = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < callOptions.length; i++) {
            if (!isExercised[callOptions[i]]) {
                unexercised[idx++] = callOptions[i];
            }
        }
    }

    function getExercisedPutOptions() external view returns (address[] memory exercised) {
        uint256 count;
        for (uint256 i = 0; i < putOptions.length; i++) {
            if (isExercised[putOptions[i]]) count++;
        }

        exercised = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < putOptions.length; i++) {
            if (isExercised[putOptions[i]]) {
                exercised[idx++] = putOptions[i];
            }
        }
    }

    function getUnexercisedPutOptions() external view returns (address[] memory unexercised) {
        uint256 count;
        for (uint256 i = 0; i < putOptions.length; i++) {
            if (!isExercised[putOptions[i]]) count++;
        }

        unexercised = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < putOptions.length; i++) {
            if (!isExercised[putOptions[i]]) {
                unexercised[idx++] = putOptions[i];
            }
        }
    }
}
