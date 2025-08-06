// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SimuOracle.sol";
import "./OptionsBook.sol";

contract QuadraticCallOption {
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

    string public constant optionType = "QUADRATIC_CALL";
    
    // Scaling factor to prevent overflow and maintain reasonable payouts
    // This ensures quadratic payouts don't become astronomically large
    uint256 public constant QUADRATIC_SCALE = 1e18;

    event OptionCreated(address indexed short);
    event ShortFunded(address indexed short, uint256 amount);
    event OptionActivated(address indexed long, uint256 premiumPaid, uint256 expiry);
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

        emit ShortFunded(short, optionSize);
    }

    function enterAsLong(address realLong) external {
        require(msg.sender == optionsBook, "Only OptionsBook can enter");
        require(!isActive, "Already activated");
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

    /**
     * @dev Calculate quadratic payout for call option
     * Formula: profit = (priceAtExpiry - strikePrice)² / QUADRATIC_SCALE * amount
     * This amplifies gains when the option is more in-the-money
     */
    function calculateQuadraticPayout(uint256 amount) internal view returns (uint256) {
        if (priceAtExpiry <= strikePrice) {
            return 0; // Out of the money
        }
        
        uint256 priceDiff = priceAtExpiry - strikePrice;
        
        // Calculate quadratic payout: (priceDiff)² / QUADRATIC_SCALE
        // We divide by QUADRATIC_SCALE to prevent overflow and maintain reasonable scaling
        uint256 quadraticMultiplier = (priceDiff * priceDiff) / QUADRATIC_SCALE;
        
        // Apply the quadratic multiplier to the amount
        return (amount * quadraticMultiplier) / 1e18;
    }

    function exercise(uint256 mtkAmount, address realLong) external {
        require(msg.sender == optionsBook, "Only OptionsBook can exercise");
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isResolved, "Not resolved");
        require(realLong == long, "Not authorized long");

        require(priceAtExpiry > strikePrice, "Not profitable");
        
        // Always use OptionsBook calculation mode for consistent quadratic behavior
        // Calculate the linear profit first
        uint256 priceDiff = priceAtExpiry - strikePrice;
        uint256 linearProfit = (optionSize * priceDiff) / 1e18;
        
        // Apply quadratic multiplier to the linear profit
        uint256 quadraticMultiplier = (priceDiff * priceDiff) / QUADRATIC_SCALE;
        uint256 twoTkAmount = (linearProfit * quadraticMultiplier) / 1e18;
        
        // Calculate corresponding MTK payment for the quadratic payout
        uint256 actualMtkAmount;
        if (twoTkAmount > optionSize) {
            // If quadratic payout exceeds optionSize, cap it and reduce MTK payment proportionally
            twoTkAmount = optionSize;
            // Calculate what portion of the original exercise this represents
            uint256 effectiveQuadraticAmount = (optionSize * 1e18) / quadraticMultiplier;
            actualMtkAmount = (effectiveQuadraticAmount * strikePrice) / 1e18;
        } else {
            // Normal case: calculate MTK payment based on the linear profit needed for this quadratic payout
            uint256 requiredLinearProfit = (twoTkAmount * 1e18) / quadraticMultiplier;
            actualMtkAmount = (requiredLinearProfit * strikePrice) / priceDiff;
        }

        isExercised = true;
        require(underlyingToken.transfer(realLong, twoTkAmount), "2TK fail");
        OptionsBook(optionsBook).notifyExercised(actualMtkAmount);

        emit OptionExercised(realLong, actualMtkAmount, twoTkAmount);
    }

    function reclaim(address realShort) external {
        require(msg.sender == optionsBook, "Only OptionsBook can reclaim");
        require(block.timestamp >= expiry, "Too early");
        require(!isExercised, "Already exercised");
        require(isFunded, "Not funded");
        require(realShort == short, "Not authorized short");

        isExercised = true;

        require(underlyingToken.transfer(realShort, optionSize), "Reclaim failed");

        emit OptionExpiredUnused(realShort);
    }

    // View oracle address directly
    function getOracleAddress() external view returns (address) {
        return address(oracle);
    }
    
    /**
     * @dev View function to preview quadratic payout for given amount
     */
    function previewQuadraticPayout(uint256 amount, uint256 mockPriceAtExpiry) external view returns (uint256) {
        if (mockPriceAtExpiry <= strikePrice) {
            return 0;
        }
        
        uint256 priceDiff = mockPriceAtExpiry - strikePrice;
        uint256 quadraticMultiplier = (priceDiff * priceDiff) / QUADRATIC_SCALE;
        return (amount * quadraticMultiplier) / 1e18;
    }
}