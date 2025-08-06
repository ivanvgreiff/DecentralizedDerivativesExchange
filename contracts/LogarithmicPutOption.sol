// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SimuOracle.sol";
import "./OptionsBook.sol";

contract LogarithmicCallOption {
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
    uint256 public intensity; // LOG SCALING FACTOR

    uint256 public expiry;
    bool public isActive;
    bool public isExercised;
    bool public isFunded;

    SimuOracle public oracle;
    uint256 public priceAtExpiry;
    bool public isResolved;

    bool private initialized;

    string public constant optionType = "LOG_CALL";

    event OptionCreated(address indexed short);
    event OptionActivated(address indexed long, uint256 premium, uint256 expiry);
    event OptionExercised(address indexed long, uint256 mtkSpent, uint256 twoTkReceived);
    event PriceResolved(string pair, uint256 price);

    modifier onlyOptionsBook() {
        require(msg.sender == optionsBook, "Not OptionsBook");
        _;
    }

    function initialize(
        address _short,
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        uint256 _intensity,
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
        intensity = _intensity;
        oracle = SimuOracle(_oracle);
        optionsBook = _optionsBook;

        emit OptionCreated(_short);
    }

    function fund() external onlyOptionsBook {
        require(!isFunded, "Already funded");
        isFunded = true;
    }

    function enterAsLong(address _long) external onlyOptionsBook {
        require(!isActive && isFunded && long == address(0), "Invalid state");
        long = _long;
        isActive = true;
        expiry = block.timestamp + 5 minutes;
        emit OptionActivated(_long, premium, expiry);
    }

    function resolve() public {
        require(block.timestamp >= expiry && !isResolved, "Too early or already resolved");
        priceAtExpiry = oracle.getDerivedPriceBySymbols(underlyingSymbol, strikeSymbol);
        require(priceAtExpiry > 0, "Invalid oracle price");
        isResolved = true;
        emit PriceResolved(string(abi.encodePacked(underlyingSymbol, "/", strikeSymbol)), priceAtExpiry);
    }

    function exercise(uint256 mtkAmount, address _long) external onlyOptionsBook {
        require(block.timestamp >= expiry && isResolved && !isExercised, "Invalid exercise");
        require(_long == long, "Not long");

        uint256 minPrice = strikePrice + (1e18 / intensity);
        require(priceAtExpiry >= minPrice, "Out of money");

        uint256 logNumerator = intensity * (priceAtExpiry - strikePrice);
        require(logNumerator > 1e18, "Below log domain");

        // Approximate log (natural) using fixed-point
        uint256 payout = approximateLog(logNumerator); // result in 1e18 scaling
        uint256 twoTkPayout = (payout * optionSize) / 1e18;

        if (twoTkPayout > optionSize) {
            twoTkPayout = optionSize;
        }

        require(strikeToken.transferFrom(_long, short, mtkAmount), "MTK transfer failed");
        require(underlyingToken.transfer(_long, twoTkPayout), "2TK transfer failed");

        isExercised = true;
        OptionsBook(optionsBook).notifyExercised(mtkAmount);
        emit OptionExercised(_long, mtkAmount, twoTkPayout);
    }

    function reclaim(address _short) external onlyOptionsBook {
        require(block.timestamp >= expiry && !isExercised, "Can't reclaim");
        require(_short == short, "Not short");
        isExercised = true;
        require(underlyingToken.transfer(_short, optionSize), "Reclaim failed");
    }

    function approximateLog(uint256 x) internal pure returns (uint256) {
        // Rough approximation of ln(x) for x scaled by 1e18
        // ln(x) ≈ log2(x) * ln(2)
        require(x > 0, "Invalid log input");

        uint256 log2 = mostSignificantBit(x) * 1e18 / 1; // crude log2(x)
        return (log2 * 693147180559945309) / 1e18; // ln(2) ≈ 0.6931...
    }

    function mostSignificantBit(uint256 x) internal pure returns (uint256 msb) {
        while (x > 1) {
            x >>= 1;
            msb++;
        }
    }
}
