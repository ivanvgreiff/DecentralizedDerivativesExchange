// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
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

        callOptions.push(clone);
        isCallOption[clone] = true;

        // Collect 2TK from msg.sender (short), then fund the clone
        IERC20(_underlyingToken).transferFrom(msg.sender, clone, _optionSize);

        // Call fund() on the clone to mark it funded
        CallOptionContract(clone).fund();

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

        putOptions.push(clone);
        isCallOption[clone] = false;

        uint256 mtkToSend = (_optionSize * _strikePrice) / 1e18;
        IERC20(_strikeToken).transferFrom(msg.sender, clone, mtkToSend);

        PutOptionContract(clone).fund();

        emit OptionCreated(msg.sender, clone, "PUT");
    }

    function enterAndPayPremium(
        address optionAddress
    ) external {
        (bool success, ) = optionAddress.call(
            abi.encodeWithSignature("enterAsLong(address)", msg.sender)
        );
        require(success, "enterAsLong failed");
    }

    function notifyExercised(uint256 strikeTokenAmount) external {
        require(isKnownOption(msg.sender), "Unknown option contract");
        require(!isExercised[msg.sender], "Already marked exercised");

        isExercised[msg.sender] = true;
        totalExercisedStrikeTokens += strikeTokenAmount;

        emit OptionExercised(msg.sender, strikeTokenAmount);
    }

    function isKnownOption(address query) public view returns (bool) {
        for (uint256 i = 0; i < callOptions.length; i++) {
            if (callOptions[i] == query) return true;
        }
        for (uint256 j = 0; j < putOptions.length; j++) {
            if (putOptions[j] == query) return true;
        }
        return false;
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
