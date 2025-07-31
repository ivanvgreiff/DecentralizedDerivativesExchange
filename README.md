# DDX Protocol - Options Trading Platform

A decentralized options trading platform built with Solidity smart contracts, Express.js backend, and React frontend.

## System Overview

The DDX Protocol allows users to create, trade, and exercise options contracts on the blockchain. The system follows this chronology:

1. **Alice deploys the contract** - Creates a new options contract
2. **Alice approves funding** - Approves the 2TK token contract to spend tokens
3. **Alice funds the contract** - Deposits 30 2TK to back the option
4. **Bob approves premium payment** - Approves MTK token contract to spend tokens
5. **Bob pays premium** - Pays 2 MTK premium and contract pays Alice
6. **Price oracle changes** - Price of 1 2TK changes from 1 MTK to 2 MTK
7. **Backend calls resolve()** - Upon expiry, resolves the final price
8. **Bob exercises option** - Uses 7 MTK to buy 7 2TK (market would yield 3.5 2TK)
9. **Alice receives MTK** - Gets 7 MTK from smart contract
10. **Bob receives 2TK** - Gets 7 2TK from smart contract

## Project Structure

```
ddx-protocol/
├── contracts/                 # Solidity smart contracts
│   ├── OptionContract.sol    # Main options contract
│   ├── OptionFactory.sol     # Factory for creating options
│   ├── SimuOracle.sol        # Mock price oracle
│   └── Payoff*.sol           # Payoff formula contracts
├── sl-contracts/             # Token contracts
│   ├── MyToken.sol           # MTK token
│   └── DoubleToken.sol       # 2TK token
├── backend/                  # Express.js API server
│   ├── server.js             # Main server file
│   ├── package.json          # Backend dependencies
│   └── env.example           # Environment variables template
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/           # Page components
│   │   ├── context/         # React context providers
│   │   └── App.js           # Main app component
│   └── package.json         # Frontend dependencies
└── contract-utils/           # Contract ABIs and utilities
```

## Smart Contracts

### OptionContract.sol
The main options contract that handles:
- Option creation and funding
- Long position entry
- Price resolution via oracle
- Option exercise and settlement

### SimuOracle.sol
A mock price oracle that:
- Manages token prices
- Provides price feeds for options
- Allows price updates for testing

### Token Contracts
- **MyToken.sol (MTK)**: Strike token used for premium payments
- **DoubleToken.sol (2TK)**: Underlying token being traded

## Backend API

The Express.js backend provides RESTful APIs for:
- Blockchain status and connection
- Account and token balances
- Oracle price feeds
- Option contract interactions
- Transaction preparation for MetaMask signing

### Key Endpoints:
- `GET /api/blockchain/status` - Blockchain connection status
- `GET /api/oracle/prices` - Current oracle prices
- `GET /api/option/:address` - Option contract details
- `POST /api/option/create` - Create new option
- `POST /api/option/:address/fund` - Fund option contract
- `POST /api/option/:address/enter` - Enter as long position
- `POST /api/option/:address/resolve` - Resolve option price
- `POST /api/option/:address/exercise` - Exercise option

## Frontend

The React frontend provides:
- **Dashboard**: Overview of platform status
- **Options Market**: Browse and interact with available options
- **Create Option**: Form to create new options contracts
- **My Options**: View user's owned options
- **Option Detail**: Detailed view of specific options

### Features:
- MetaMask wallet integration
- Real-time blockchain data
- Transaction signing via MetaMask
- Modern, responsive UI
- Toast notifications for user feedback

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension
- Foundry (for smart contract development)
- RPC endpoint (Infura, Alchemy, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ddx-protocol
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cd ../backend
   cp env.example .env
   # Edit .env with your contract addresses and RPC URL
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The backend will run on `http://localhost:3001`

2. **Start the frontend**
   ```bash
   cd frontend
   npm start
   ```
   The frontend will run on `http://localhost:3000`

3. **Connect MetaMask**
   - Open your browser and navigate to `http://localhost:3000`
   - Connect your MetaMask wallet
   - Ensure you're connected to the correct network (mainnet, testnet, etc.)

### Contract Deployment

1. **Deploy contracts to your preferred network**
   ```bash
   # Deploy to mainnet, testnet, or your preferred network
   forge script script/Deploy.s.sol --rpc-url https://your-rpc-endpoint.com --broadcast
   ```

2. **Update environment variables**
   - Copy the deployed contract addresses to `backend/.env`
   - Update the RPC_URL and CHAIN_ID in `backend/.env`
   - Update the frontend with contract addresses if needed

### Usage

1. **Create an Option**
   - Navigate to "Create Option" page
   - Fill in the option parameters
   - Submit the transaction via MetaMask

2. **Fund an Option**
   - Go to "Options Market"
   - Find an unfunded option
   - Click "Fund" and approve the transaction

3. **Enter as Long**
   - Find a funded option in the market
   - Click "Enter as Long" and approve the transaction

4. **Resolve and Exercise**
   - Wait for option expiry
   - Resolve the price via oracle
   - Exercise the option if profitable

## Development

### Backend Development
- The backend uses Express.js with ethers.js for blockchain interaction
- API endpoints prepare transaction data for frontend signing
- CORS is configured for frontend communication
- Rate limiting and security middleware included

### Frontend Development
- React with hooks and context for state management
- Styled-components for styling
- React Query for data fetching
- React Router for navigation
- MetaMask integration via ethers.js

### Smart Contract Development
- Solidity contracts with OpenZeppelin libraries
- Comprehensive event logging
- Access control and validation
- Oracle integration for price feeds

## Security Considerations

- All transactions are signed by users via MetaMask
- No private keys stored in the application
- Input validation on both frontend and backend
- Rate limiting to prevent abuse
- CORS configuration for security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
