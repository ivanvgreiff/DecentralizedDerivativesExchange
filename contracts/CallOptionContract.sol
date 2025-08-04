// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SimuOracle.sol";
import "./OptionsBook.sol";

contract CallOptionContract {
    address public short;
    address public long;
    address public optionsBook;

    IERC20 public underlyingToken;
    IERC20 public strikeToken;

    string public underlyingSymbol;
    string public strikeSymbol;

    uint256 public strikePrice;
    uint256 public optionSize;
    uint256 public premium;

    uint256 public expiry;
    bool public isFilled;
    bool public isExercised;
    bool public isFunded;

    SimuOracle public oracle;
    uint256 public priceAtExpiry;
    bool public isResolved;

    bool private initialized;

    event OptionCreated(address indexed short);
    event ShortFunded(address indexed short, uint256 amount);
    event OptionFilled(address indexed long, uint256 premiumPaid, uint256 expiry);
    event OptionExercised(address indexed long, uint256 mtkSpent, uint256 twoTkReceived);
    event OptionExpiredUnused(address indexed short);
    event PriceResolved(string underlyingSymbol, string strikeSymbol, uint256 priceAtExpiry, uint256 resolvedAt);

    function initialize(
        address _short,
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        address _oracle,
        address _optionsBook
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;

        short = _short;
        underlyingToken = IERC20(_underlyingToken);
        strikeToken = IERC20(_strikeToken);
        underlyingSymbol = _underlyingSymbol;
        strikeSymbol = _strikeSymbol;
        strikePrice = _strikePrice;
        optionSize = _optionSize;
        premium = _premium;
        oracle = SimuOracle(_oracle);
        optionsBook = _optionsBook;

        emit OptionCreated(short);
    }

    function fund() external {
        require(msg.sender == optionsBook, "Only OptionsBook can fund");
        require(!isFunded, "Already funded");

        isFunded = true;
        // Tokens are already transferred to this contract by OptionsBook
        
        emit ShortFunded(short, optionSize);
    }

    // Enter position and Pay
    function enterAsLong(address realLong) external {
        require(!isFilled, "Already filled");
        require(isFunded, "Not funded yet");
        require(long == address(0), "Already entered");

        long = realLong;
        isFilled = true;
        expiry = block.timestamp + 5 minutes;

        require(
            strikeToken.transferFrom(realLong, address(this), premium),
            "Premium transfer failed"
        );

        require(
            strikeToken.transfer(short, premium),
            "Premium forwarding failed"
        );

        emit OptionFilled(realLong, premium, expiry);
    }

    function resolve() public {
        require(block.timestamp >= expiry, "Too early");
        require(!isResolved, "Resolved");

        uint256 price = oracle.getDerivedPriceBySymbols(underlyingSymbol, strikeSymbol);
        require(price > 0, "Invalid price");

        priceAtExpiry = price;
        isResolved = true;

        emit PriceResolved(underlyingSymbol, strikeSymbol, price, block.timestamp);
    }

    function exercise(uint256 mtkAmount) external {
        require(msg.sender == long, "Only long");
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isResolved, "Not resolved");

        require(priceAtExpiry > strikePrice, "Not profitable");
        require(mtkAmount > 0, "Zero spend");

        uint256 twoTkAmount = (mtkAmount * 1e18) / strikePrice;
        require(twoTkAmount <= optionSize, "Too much");

        isExercised = true;

        require(strikeToken.transferFrom(long, address(this), mtkAmount), "MTK fail");
        require(strikeToken.transfer(short, mtkAmount), "MTK fwd fail");
        require(underlyingToken.transfer(long, twoTkAmount), "2TK fail");

        OptionsBook(optionsBook).notifyExercised(mtkAmount);

        emit OptionExercised(long, mtkAmount, twoTkAmount);
    }

    function reclaim() external {
        require(msg.sender == short, "Only short");
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isFunded, "Not funded");

        isExercised = true;

        require(underlyingToken.transfer(short, optionSize), "Reclaim failed");

        emit OptionExpiredUnused(short);
    }
}
