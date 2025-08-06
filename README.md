# Decentralized Derivatives Exchange Protocol

**DDX** is a fully on-chain protocol for creating, trading, and settling **customizable financial contracts**. Users can define bespoke payoff logic, post collateral, and settle claims automatically using decentralized oracles. The protocol supports modular, composable derivatives logic and is optimized for gas efficiency, security, and permissionless usage.

## 🚀 Quick Start

### Prerequisites
- Node.js v16+
- npm or yarn
- MetaMask browser extension
- Sepolia testnet ETH (for testing)

### One-Command Setup
```bash
git clone <your-repo-url>
cd ddx-protocol
node setup.js
```

### Manual Setup
```bash
# 1. Clone the repository
git clone <your-repo-url>
cd ddx-protocol

# 2. Install all dependencies
npm run install-all

# 3. Configure environment
cp .env.example .env
# Edit .env with your RPC URL and private key

# 4. Start the application
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

---

## 📝 Environment Configuration

1. **Get an Infura/Alchemy RPC URL** for Sepolia testnet
2. **Add a private key** for backend transaction signing (use a test wallet)
3. **Update contract addresses** in `.env` (pre-deployed on Sepolia)

---

## Key Features

- **Custom Payoff Curves**: Deploy contracts with arbitrary payout logic through modular formula contracts.
- **Trustless Settlement**: Collateralized positions are settled based on on-chain price data (e.g., Chainlink).
- **Permissionless Deployment**: Anyone can deploy and trade new derivative instruments via factory contracts.
- **Pluggable Payoff Modules**: Cleanly separated logic allows rapid extension of supported payoff types.
- **EVM-Compatible**: Designed for Ethereum Layer-2s like Optimism and Arbitrum to ensure low fees.

---

## 🏛️ Protocol Architecture

### **Core Components**

**OptionsBook.sol** - The central factory and registry
- Creates call and put option contracts using minimal proxy pattern (EIP-1167)
- Manages option lifecycle: creation, funding, premium payments, resolution
- Handles exercise and reclaim operations for both option types
- Tracks all option metadata and statistics

**Individual Option Contracts**
- **CallOptionContract.sol**: Long profits when underlying price > strike price
- **PutOptionContract.sol**: Long profits when underlying price < strike price
- Each contract manages its own collateral, expiry, and settlement logic

**SimuOracle.sol** - Price oracle for settlement
- Provides price feeds for underlying assets at expiration
- Supports human-readable prices with automatic scaling
- Used for automated option resolution and profit calculation

### **Option Lifecycle**

1. **Creation**: Short position holder creates and funds option via OptionsBook
2. **Entry**: Long position holder pays premium and enters the option (5-minute expiry starts)
3. **Expiration**: Option expires after 5 minutes
4. **Resolution**: Oracle price is fetched and stored on-chain
5. **Exercise/Reclaim**: 
   - **Profitable options**: Long exercises to claim profits
   - **Unprofitable options**: Short reclaims collateral

### **Token Flow**

**Call Options** (Long buys right to purchase underlying at strike price):
- Short deposits: Underlying tokens (2TK) 
- Long pays: Strike tokens (MTK) to exercise
- Long receives: Underlying tokens (2TK)

**Put Options** (Long buys right to sell underlying at strike price):
- Short deposits: Strike tokens (MTK)
- Long pays: Underlying tokens (2TK) to exercise  
- Long receives: Strike tokens (MTK)

---

## 🏗️ Project Structure

```plaintext
ddx-protocol/
├── contracts/                      # Core smart contracts
│   ├── OptionsBook.sol             # Factory and registry for all options
│   ├── CallOptionContract.sol      # Individual call option logic
│   ├── PutOptionContract.sol       # Individual put option logic
│   ├── SimuOracle.sol              # Mock price oracle for testing
│   ├── PayoffFormulaInterface.sol  # Interface for modular payoff logic
│   ├── PayoffLinear.sol            # Linear payoff implementation
│   └── PayoffDigital.sol           # Binary option payoff implementation
│
├── utils/                          # Contract ABIs and utilities
│   ├── OptionsBookABI.json         # Factory contract interface
│   ├── CallOptionContractABI.json  # Call option interface
│   ├── PutOptionContractABI.json   # Put option interface
│   ├── SimuOracleABI.json          # Oracle interface
│   ├── MTKContractABI.json         # Strike token (MTK) interface
│   └── TwoTKContractABI.json       # Underlying token (2TK) interface
│
├── frontend/                       # React.js web application
│   ├── src/
│   │   ├── components/
│   │   │   └── Header.js           # Navigation header
│   │   ├── context/
│   │   │   └── WalletContext.js    # Web3 wallet integration
│   │   ├── pages/
│   │   │   ├── Dashboard.js        # Main dashboard page
│   │   │   ├── CreateOption.js     # Option creation interface
│   │   │   ├── OptionsMarket.js    # Option trading marketplace
│   │   │   ├── OptionDetail.js     # Individual option details
│   │   │   └── MyOptions.js        # User's option portfolio
│   │   ├── App.js                  # Main React application
│   │   └── index.js                # Application entry point
│   ├── package.json                # Frontend dependencies
│   └── build/                      # Production build output
│
├── backend/                        # Node.js API server
│   ├── server.js                   # Express server and API routes
│   ├── resolutionService.js        # Automated option resolution
│   ├── database.js                 # SQLite database operations
│   ├── contracts.db                # SQLite database file
│   └── package.json                # Backend dependencies
│
├── script/                         # Deployment scripts
│   ├── Deploy.s.sol                # Foundry deployment script
│   └── debug-exercise.js           # Testing utilities
│
├── test/                           # Smart contract tests
│   ├── resolveAndExercise.t.sol    # Foundry tests for exercise logic
│   └── *.test.js                   # JavaScript test files
│
├── scripts/                        # Development utilities
│   ├── dev-setup.sh                # Unix setup script
│   ├── dev-setup.bat               # Windows setup script
│   └── setup.js                    # Cross-platform setup
│
├── .env.example                    # Environment configuration template
├── foundry.toml                    # Foundry configuration
├── package.json                    # Root project configuration
└── README.md                       # This file
```

---

## 🧮 Payoff Formulas (Extensible)

The protocol supports modular payoff formulas through the `PayoffFormulaInterface`:

**Currently Implemented:**
- **PayoffQuadratic.sol**: Quadratic payoff (higher premium)
- **PayoffLogarithmic.sol**: Logarithmic payoff (lower premium)
- **PayoffBinary.sol**: Binary option payoff (all-or-nothing)

**Future Extensions:**
- Barrier options (knock-in/knock-out)
- Asian options (path-dependent)
- Spread strategies (bull/bear spreads)
- Custom mathematical formulas

**Adding New Payoffs:**
```solidity
contract CustomPayoff is PayoffFormulaInterface {
    function payout(uint256 price) external pure override returns (uint256) {
        // Your custom payoff logic here
        return customCalculation(price);
    }
}
```

---

## 🔧 Technology Stack

- **Smart Contracts**: Solidity ^0.8.20, OpenZeppelin libraries
- **Development**: Foundry framework for testing and deployment
- **Frontend**: React.js with Web3 integration (ethers.js)
- **Backend**: Node.js/Express with SQLite database
- **Network**: Ethereum Sepolia testnet (production-ready for mainnet)

---

## 📊 Features

✅ **Implemented**:
- Call and Put option creation and trading
- Automated oracle-based settlement 
- Real-time profit/loss calculations
- MetaMask wallet integration
- Optimized RPC usage (2 calls vs 150+ previously)
- Responsive web interface

🚧 **In Development**:
- Additional payoff formulas
- Multi-asset support
- Advanced order types
- Governance mechanisms
