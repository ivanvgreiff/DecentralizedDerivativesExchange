// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SimuOracle.sol";

contract CallOptionContract {
    address public short;
    address public long;

    IERC20 public underlyingToken; // 2TK - asset to be bought
    IERC20 public strikeToken;     // MTK - asset to be paid with

    string public underlyingSymbol;
    string public strikeSymbol;

    uint256 public strikePrice;   // in MTK per 2TK (1e18-scaled)
    uint256 public optionSize;    // total 2TK available to sell
    uint256 public premium;       // MTK premium paid to short

    uint256 public expiry;
    bool public isFilled;
    bool public isExercised;
    bool public isFunded;

    SimuOracle public oracle;
    uint256 public priceAtExpiry;
    bool public isResolved;

    uint256 private _exercisedVolume; // ⬅️ New state variable

    event OptionCreated(
        address indexed short,
        address underlyingToken,
        address strikeToken,
        string underlyingSymbol,
        string strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium
    );

    event ShortFunded(address indexed short, uint256 amount);
    event OptionFilled(address indexed long, uint256 premiumPaid, uint256 expiry);
    event OptionExercised(address indexed long, uint256 mtkSpent, uint256 twoTkReceived);
    event OptionExpiredUnused(address indexed short);
    event PriceResolved(
        string underlyingSymbol,
        string strikeSymbol,
        uint256 priceAtExpiry,
        uint256 resolvedAt
    );

    constructor(
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        address _oracle
    ) {
        require(_strikePrice > 0, "Invalid strike price");
        require(_optionSize > 0, "Invalid option size");
        require(_oracle != address(0), "Invalid oracle");

        short = msg.sender;
        underlyingToken = IERC20(_underlyingToken);
        strikeToken = IERC20(_strikeToken);

        underlyingSymbol = _underlyingSymbol;
        strikeSymbol = _strikeSymbol;

        strikePrice = _strikePrice;
        optionSize = _optionSize;
        premium = _premium;

        oracle = SimuOracle(_oracle);

        emit OptionCreated(
            short,
            _underlyingToken,
            _strikeToken,
            _underlyingSymbol,
            _strikeSymbol,
            _strikePrice,
            _optionSize,
            _premium
        );
    }

    function fund() external {
        require(msg.sender == short, "Only short can fund");
        require(!isFunded, "Already funded");

        isFunded = true;

        require(
            underlyingToken.transferFrom(msg.sender, address(this), optionSize),
            "2TK deposit failed"
        );

        emit ShortFunded(msg.sender, optionSize);
    }

    function enterAsLong() external {
        require(!isFilled, "Already filled");
        require(isFunded, "Not funded yet");
        require(long == address(0), "Already entered");

        long = msg.sender;
        isFilled = true;
        expiry = block.timestamp + 5 minutes;

        require(
            strikeToken.transferFrom(long, address(this), premium),
            "Premium transfer failed"
        );

        require(
            strikeToken.transfer(short, premium),
            "Premium forwarding failed"
        );

        emit OptionFilled(long, premium, expiry);
    }

    function getMaxSpendableMTK() external view returns (uint256) {
        return (optionSize * strikePrice) / 1e18;
    }

    function resolve() public {
        require(block.timestamp >= expiry, "Too early to resolve");
        require(!isResolved, "Already resolved");

        uint256 derivedPrice = oracle.getDerivedPriceBySymbols(underlyingSymbol, strikeSymbol);
        require(derivedPrice > 0, "Oracle price unavailable");

        priceAtExpiry = derivedPrice;
        isResolved = true;

        emit PriceResolved(underlyingSymbol, strikeSymbol, derivedPrice, block.timestamp);
    }

    function exercise(uint256 mtkAmount) external {
        require(msg.sender == long, "Only long can exercise");
        require(block.timestamp >= expiry, "Not yet expired");
        require(!isExercised, "Already exercised");
        require(isResolved, "Price not yet resolved");
        require(mtkAmount > 0, "Must spend more than 0");
        require(priceAtExpiry > strikePrice, "Option not profitable");

        uint256 twoTkAmount = (mtkAmount * 1e18) / strikePrice;
        require(twoTkAmount <= optionSize, "Too much requested");

        isExercised = true;
        _exercisedVolume = mtkAmount; // ✅ Track exercised volume

        require(
            strikeToken.transferFrom(long, address(this), mtkAmount),
            "MTK transfer failed"
        );

        require(
            strikeToken.transfer(short, mtkAmount),
            "MTK forwarding failed"
        );

        require(
            underlyingToken.transfer(long, twoTkAmount),
            "2TK transfer failed"
        );

        emit OptionExercised(long, mtkAmount, twoTkAmount);
    }

    function exercisedVolume() public view returns (uint256) {
        return _exercisedVolume;
    }

    function reclaim() external {
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isFunded, "Not funded");
        require(msg.sender == short, "Only short can reclaim");

        isExercised = true;

        require(
            underlyingToken.transfer(short, optionSize),
            "2TK reclaim failed"
        );

        emit OptionExpiredUnused(short);
    }
}
