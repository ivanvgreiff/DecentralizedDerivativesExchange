// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CallOptionContract.sol";
import "./PutOptionContract.sol";
import "./QuadraticCallOption.sol";
import "./QuadraticPutOption.sol";

contract OptionsBook {
    address public callImpl;
    address public putImpl;
    address public quadraticCallImpl;
    address public quadraticPutImpl;

    uint256 public totalExercisedStrikeTokens;

    address[] public callOptions;
    address[] public putOptions;

    mapping(address => bool) public isExercised;
    mapping(address => bool) public isCallOption;
    mapping(address => bool) public isKnownClone;

    mapping(address => address) public longPosition;
    mapping(address => address) public shortPosition;

    struct OptionMeta {
        address optionAddress;
        bool isCall;
        address underlyingToken;
        address strikeToken;
        string underlyingSymbol;
        string strikeSymbol;
        uint256 strikePrice;
        uint256 optionSize;
        uint256 premium;
        uint256 expiry;
        uint256 priceAtExpiry;
        uint256 exercisedAmount;
        bool isExercised;
        bool isResolved;
        address long;
        address short;
        string payoffType; // Add payoff type field
    }

    mapping(address => OptionMeta) public optionMetadata;

    event OptionCreated(address indexed creator, address indexed instance, string optionType);
    event OptionExercised(address indexed option, uint256 strikeTokenAmount);

    constructor(
        address _callImpl, 
        address _putImpl, 
        address _quadraticCallImpl, 
        address _quadraticPutImpl
    ) {
        callImpl = _callImpl;
        putImpl = _putImpl;
        quadraticCallImpl = _quadraticCallImpl;
        quadraticPutImpl = _quadraticPutImpl;
    }

    function createAndFundCallOption(
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        address _oracle,
        string memory _payoffType
    ) external returns (address clone) {
        // Choose implementation based on payoff type
        if (keccak256(bytes(_payoffType)) == keccak256(bytes("Quadratic"))) {
            clone = Clones.clone(quadraticCallImpl);
            QuadraticCallOption(clone).initialize(
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
        } else {
            // Default to linear implementation
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
        }

        require(
            IERC20(_underlyingToken).transferFrom(msg.sender, clone, _optionSize),
            "Token transfer failed"
        );

        // Call fund() using the appropriate interface
        if (keccak256(bytes(_payoffType)) == keccak256(bytes("Quadratic"))) {
            QuadraticCallOption(clone).fund();
        } else {
            CallOptionContract(clone).fund();
        }

        callOptions.push(clone);
        isCallOption[clone] = true;
        isKnownClone[clone] = true;
        shortPosition[clone] = msg.sender;

        optionMetadata[clone] = OptionMeta({
            optionAddress: clone,
            isCall: true,
            underlyingToken: _underlyingToken,
            strikeToken: _strikeToken,
            underlyingSymbol: _underlyingSymbol,
            strikeSymbol: _strikeSymbol,
            strikePrice: _strikePrice,
            optionSize: _optionSize,
            premium: _premium,
            expiry: 0,
            priceAtExpiry: 0,
            exercisedAmount: 0,
            isExercised: false,
            isResolved: false,
            long: address(0),
            short: msg.sender,
            payoffType: _payoffType
        });

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
        address _oracle,
        string memory _payoffType
    ) external returns (address clone) {
        // Choose implementation based on payoff type
        if (keccak256(bytes(_payoffType)) == keccak256(bytes("Quadratic"))) {
            clone = Clones.clone(quadraticPutImpl);
            QuadraticPutOption(clone).initialize(
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
        } else {
            // Default to linear implementation
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
        }

        uint256 mtkToSend = (_optionSize * _strikePrice) / 1e18;
        require(
            IERC20(_strikeToken).transferFrom(msg.sender, clone, mtkToSend),
            "Strike token transfer failed"
        );

        // Call fund() using the appropriate interface
        if (keccak256(bytes(_payoffType)) == keccak256(bytes("Quadratic"))) {
            QuadraticPutOption(clone).fund();
        } else {
            PutOptionContract(clone).fund();
        }

        putOptions.push(clone);
        isCallOption[clone] = false;
        isKnownClone[clone] = true;
        shortPosition[clone] = msg.sender;

        optionMetadata[clone] = OptionMeta({
            optionAddress: clone,
            isCall: false,
            underlyingToken: _underlyingToken,
            strikeToken: _strikeToken,
            underlyingSymbol: _underlyingSymbol,
            strikeSymbol: _strikeSymbol,
            strikePrice: _strikePrice,
            optionSize: _optionSize,
            premium: _premium,
            expiry: 0,
            priceAtExpiry: 0,
            exercisedAmount: 0,
            isExercised: false,
            isResolved: false,
            long: address(0),
            short: msg.sender,
            payoffType: _payoffType
        });

        emit OptionCreated(msg.sender, clone, "PUT");
    }

    function enterAndPayPremium(address optionAddress) external {
        require(isKnownOption(optionAddress), "Unknown option");

        OptionMeta storage meta = optionMetadata[optionAddress];
        require(meta.long == address(0), "Already entered");

        require(
            IERC20(meta.strikeToken).transferFrom(msg.sender, address(this), meta.premium),
            "Premium transfer failed"
        );
        require(
            IERC20(meta.strikeToken).transfer(meta.short, meta.premium),
            "Premium payout failed"
        );

        meta.long = msg.sender;
        meta.expiry = block.timestamp + 5 minutes;

        (bool success, ) = optionAddress.call(
            abi.encodeWithSignature("enterAsLong(address)", msg.sender)
        );
        require(success, "enterAsLong failed");
    }

    function resolveAndExercise(address optionAddress, uint256 amountIn) external {
        require(isKnownOption(optionAddress), "Unknown option");

        OptionMeta storage meta = optionMetadata[optionAddress];
        require(msg.sender == meta.long, "Not authorized");

        if (!meta.isResolved) {
            (bool success, ) = optionAddress.call(abi.encodeWithSignature("resolve()"));
            require(success, "resolve() failed");

            (bool ok, bytes memory data) = optionAddress.call(abi.encodeWithSignature("priceAtExpiry()"));
            require(ok, "priceAtExpiry() failed");
            meta.priceAtExpiry = abi.decode(data, (uint256));
            meta.isResolved = true;
        }

        if (meta.isCall) {
            // CALL: long sends MTK (strikeToken) to buy 2TK (underlyingToken)
            require(
                IERC20(meta.strikeToken).transferFrom(msg.sender, address(this), amountIn),
                "CALL: MTK transfer failed"
            );
            require(
                IERC20(meta.strikeToken).transfer(meta.short, amountIn),
                "CALL: MTK forward to short failed"
            );
        } else {
            // PUT: long sends 2TK (underlyingToken) to sell for MTK (strikeToken)
            // For puts: amountIn represents the amount of 2TK tokens to sell
            require(
                IERC20(meta.underlyingToken).transferFrom(msg.sender, optionAddress, amountIn),
                "PUT: 2TK transfer to option failed"
            );
        }

        // Call exercise() on the option contract
        (bool success2, ) = optionAddress.call(
            abi.encodeWithSignature("exercise(uint256,address)", 0, meta.long)
        );
        require(success2, "exercise() failed");
    }


    function resolveAndReclaim(address optionAddress) external {
        require(isKnownOption(optionAddress), "Unknown option");
        require(msg.sender == shortPosition[optionAddress], "Not authorized");

        OptionMeta storage meta = optionMetadata[optionAddress];

        if (!meta.isResolved) {
            (bool success, ) = optionAddress.call(abi.encodeWithSignature("resolve()"));
            require(success, "resolve() failed");

            (bool ok, bytes memory data) = optionAddress.call(abi.encodeWithSignature("priceAtExpiry()"));
            require(ok, "priceAtExpiry() failed");
            meta.priceAtExpiry = abi.decode(data, (uint256));
            meta.isResolved = true;
        }

        (bool success2, ) = optionAddress.call(abi.encodeWithSignature("reclaim(address)", msg.sender));
        require(success2, "reclaim() failed");
    }

    function notifyExercised(uint256 strikeTokenAmount) external {
        require(isKnownOption(msg.sender), "Unknown option");
        require(!isExercised[msg.sender], "Already marked exercised");

        isExercised[msg.sender] = true;
        totalExercisedStrikeTokens += strikeTokenAmount;

        optionMetadata[msg.sender].exercisedAmount = strikeTokenAmount;
        optionMetadata[msg.sender].isExercised = true;

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

    function getOptionMeta(address option) external view returns (OptionMeta memory) {
        return optionMetadata[option];
    }

    function getAllOptionMetadata() external view returns (OptionMeta[] memory allMeta) {
        uint256 total = callOptions.length + putOptions.length;
        allMeta = new OptionMeta[](total);
        uint256 idx = 0;

        for (uint256 i = 0; i < callOptions.length; i++) {
            allMeta[idx++] = optionMetadata[callOptions[i]];
        }
        for (uint256 i = 0; i < putOptions.length; i++) {
            allMeta[idx++] = optionMetadata[putOptions[i]];
        }
    }
}
