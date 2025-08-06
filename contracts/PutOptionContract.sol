// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SimuOracle.sol";
import "./OptionsBook.sol";

contract PutOptionContract {
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
    bool public isActive;
    bool public isExercised;
    bool public isFunded;

    SimuOracle public oracle;
    uint256 public priceAtExpiry;
    bool public isResolved;

    bool private initialized;

    string public constant optionType = "PUT"; // exposed option type

    event OptionCreated(address indexed short);
    event ShortFunded(address indexed short, uint256 amount);
    event OptionActivated(address indexed long, uint256 premiumPaid, uint256 expiry);
    event OptionExercised(address indexed long, uint256 twoTkSpent, uint256 mtkReceived);
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

        emit ShortFunded(short, optionSize);
    }

    function enterAsLong(address realLong) external {
        require(msg.sender == optionsBook, "Only OptionsBook can enter");
        require(!isActive, "Already Activated");
        require(isFunded, "Not funded yet");
        require(long == address(0), "Already entered");

        long = realLong;
        isActive = true;
        expiry = block.timestamp + 5 minutes;

        emit OptionActivated(realLong, premium, expiry);
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

    function exercise(uint256 mtkAmount, address realLong) external {
        require(msg.sender == optionsBook, "Only OptionsBook can exercise");
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isResolved, "Not resolved");
        require(realLong == long, "Not authorized long");

        require(priceAtExpiry < strikePrice, "Not profitable");

        // Always use OptionsBook calculation mode for consistent linear behavior
        // For linear put options, calculate based on profitability
        uint256 priceDiff = strikePrice - priceAtExpiry;
        uint256 profitablePortion = (optionSize * priceDiff) / strikePrice;
        
        // The amount of 2TK we can profitably exchange  
        uint256 twoTkAmount = profitablePortion;
        if (twoTkAmount > optionSize) {
            twoTkAmount = optionSize;
        }
        
        // Calculate the actual MTK payout for this 2TK amount
        uint256 actualStrikePayout = (twoTkAmount * strikePrice) / 1e18;

        isExercised = true;
        require(strikeToken.transfer(realLong, actualStrikePayout), "MTK payout fail");

        OptionsBook(optionsBook).notifyExercised(actualStrikePayout);

        emit OptionExercised(realLong, actualStrikePayout, twoTkAmount);
    }


    function reclaim(address realShort) external {
        require(msg.sender == optionsBook, "Only OptionsBook can reclaim");
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isFunded, "Not funded");
        require(realShort == short, "Not authorized short");

        isExercised = true;

        require(strikeToken.transfer(realShort, optionSize), "Reclaim failed");

        emit OptionExpiredUnused(realShort);
    }

    // New getter to expose oracle address
    function getOracleAddress() external view returns (address) {
        return address(oracle);
    }
}
