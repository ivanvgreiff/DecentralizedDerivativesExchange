# Decentralized Derivatives Exchange Protocol

**DDX** is a fully on-chain protocol for creating, trading, and settling **customizable financial contracts**. Users can define bespoke payoff logic, post collateral, and settle claims automatically using decentralized oracles. The protocol supports modular, composable derivatives logic and is optimized for gas efficiency, security, and permissionless usage.

---

## Key Feature Goals

- **Custom Payoff Curves**: Deploy contracts with arbitrary payout logic through modular formula contracts.
- **Trustless Settlement**: Collateralized positions are settled based on on-chain price data (e.g., Chainlink).
- **Permissionless Deployment**: Anyone can deploy and trade new derivative instruments via factory contracts.
- **Pluggable Payoff Modules**: Cleanly separated logic allows rapid extension of supported payoff types.
- **EVM-Compatible**: Designed for Ethereum Layer-2s like Optimism and Arbitrum to ensure low fees.

---

## 🏗️ Project Structure

```plaintext
ddx/
├── contracts/
│   ├── OptionFactory.sol           # Creates and registers unique OptionContracts
│   ├── OptionContract.sol          # Stores lifecycle and collateral logic for one option series
│   ├── interfaces/
│   │   └── IPayoffFormula.sol      # Interface for payout modules
│   ├── formulas/
│   │   ├── PayoffLinear.sol        # Vanilla call/put logic
│   │   ├── PayoffDigital.sol       # Binary option logic
│   │   ├── PayoffPiecewise.sol     # Piecewise linear approximation logic
│   │   └── PayoffSpread.sol        # Spread-based structured payoff
│   └── utils/
│       └── ChainlinkOracle.sol     # Price feed integration and validation
│
├── scripts/
│   └── deploy.js                   # Hardhat deployment script
│
├── test/
│   ├── OptionFactory.test.js
│   ├── OptionContract.test.js
│   ├── PayoffFormulas.test.js
│   └── Oracle.test.js
│
├── hardhat.config.js               # Hardhat configuration
├── package.json                    # Project dependencies
├── .gitignore                      # Common ignores
└── README.md
