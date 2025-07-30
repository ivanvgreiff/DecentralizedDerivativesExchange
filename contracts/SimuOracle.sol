// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimuOracle - A mock oracle with human-readable and fixed-point prices
contract SimuOracle {
    address public owner;

    struct TokenData {
        uint256 price1e18;    // For internal use, scaled (e.g., 2e18)
        uint256 realPrice;    // Human-readable price (e.g., 2)
        uint256 lastUpdated;
        string symbol;
    }

    mapping(address => TokenData) public tokenPrices;
    mapping(string => address) public symbolToToken;
    mapping(address => bool) private knownTokens;

    address[] public allTokens;

    event PriceSet(address indexed token, string symbol, uint256 realPrice, uint256 price1e18);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Set price for a token using human-readable value (auto-scaled to 1e18)
    /// @param token The token's contract address
    /// @param symbol Human-readable symbol like "MTK"
    /// @param realPrice Human-readable price (e.g., 2 for 2.00)
    function setPrice(
        address token,
        string calldata symbol,
        uint256 realPrice
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(realPrice > 0, "Price must be > 0");

        uint256 scaledPrice = realPrice * 1e18;

        if (!knownTokens[token]) {
            allTokens.push(token);
            knownTokens[token] = true;
        }

        tokenPrices[token] = TokenData({
            price1e18: scaledPrice,
            realPrice: realPrice,
            lastUpdated: block.timestamp,
            symbol: symbol
        });

        symbolToToken[symbol] = token;

        emit PriceSet(token, symbol, realPrice, scaledPrice);
    }

    /// @notice Get token price by address
    function getPrice(address token) external view returns (
        uint256 realPrice,
        uint256 price1e18,
        uint256 lastUpdated,
        string memory symbol
    ) {
        TokenData memory data = tokenPrices[token];
        require(data.lastUpdated != 0, "Token not set");
        return (data.realPrice, data.price1e18, data.lastUpdated, data.symbol);
    }

    /// @notice Get token price by symbol
    function getPriceBySymbol(string calldata symbol) external view returns (
        uint256 realPrice,
        uint256 price1e18,
        uint256 lastUpdated,
        address token
    ) {
        token = symbolToToken[symbol];
        require(token != address(0), "Symbol not found");

        TokenData memory data = tokenPrices[token];
        return (data.realPrice, data.price1e18, data.lastUpdated, token);
    }

    /// @notice Get tokenA/tokenB price using symbols
    function getDerivedPriceBySymbols(string calldata symbolA, string calldata symbolB) external view returns (uint256 derivedPrice1e18) {
        address tokenA = symbolToToken[symbolA];
        address tokenB = symbolToToken[symbolB];
        require(tokenA != address(0) && tokenB != address(0), "Invalid symbol");

        TokenData memory a = tokenPrices[tokenA];
        TokenData memory b = tokenPrices[tokenB];
        require(a.price1e18 > 0 && b.price1e18 > 0, "Missing prices");

        return (a.price1e18 * 1e18) / b.price1e18;
    }

    /// @notice Number of tokens tracked
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /// @notice Get token address at index
    function getTokenAt(uint256 index) external view returns (address) {
        return allTokens[index];
    }

    /// @notice Get all token data
    function getAllTokenData() external view returns (
        address[] memory tokens,
        string[] memory symbols,
        uint256[] memory realPrices,
        uint256[] memory price1e18s,
        uint256[] memory timestamps
    ) {
        uint256 len = allTokens.length;
        tokens = new address[](len);
        symbols = new string[](len);
        realPrices = new uint256[](len);
        price1e18s = new uint256[](len);
        timestamps = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            address token = allTokens[i];
            TokenData memory data = tokenPrices[token];
            tokens[i] = token;
            symbols[i] = data.symbol;
            realPrices[i] = data.realPrice;
            price1e18s[i] = data.price1e18;
            timestamps[i] = data.lastUpdated;
        }
    }
}
