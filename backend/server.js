const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Test route at the top to verify Express is working
app.get('/api/test-top', (req, res) => {
  console.log('TOP TEST ROUTE HIT!');
  res.json({ message: 'Top test route working' });
});

// WORKING CONTRACT REGISTRATION ROUTE AT THE TOP
app.post('/api/contracts/register-top', async (req, res) => {
  console.log('TOP REGISTER ROUTE HIT!');
  try {
    if (!resolutionService) {
      console.log('Resolution service not ready');
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const contractData = req.body;
    console.log('Registering contract:', contractData.address);
    await resolutionService.addContract(contractData);
    
    res.json({ success: true, message: 'Contract registered' });
  } catch (error) {
    console.error('Error registering contract:', error);
    res.status(500).json({ error: 'Failed to register contract' });
  }
});

// MOVE CONTRACTS ROUTE TO THE TOP FOR TESTING
app.get('/api/contracts/all-top', async (req, res) => {
  console.log('TOP CONTRACTS ROUTE HIT!');
  try {
    // We need to wait for resolution service to be initialized
    if (!resolutionService) {
      console.log('Resolution service not ready, returning empty array');
      return res.json({ contracts: [] });
    }
    
    const contracts = await resolutionService.db.getAllContracts();
    console.log('Found contracts in database:', contracts.length);
    res.json({ contracts });
  } catch (error) {
    console.error('Error fetching contracts from top route:', error);
    res.json({ contracts: [] });
  }
});

// WORKING MANUAL RESOLUTION ROUTE AT THE TOP
app.post('/api/admin/resolve-expired-top', async (req, res) => {
  console.log('TOP RESOLVE EXPIRED ROUTE HIT!');
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const resolvedCount = await resolutionService.resolveExpiredContracts();
    res.json({ 
      success: true, 
      message: `Resolution check completed`,
      resolvedCount: resolvedCount
    });
  } catch (error) {
    console.error('Manual resolution error:', error);
    res.status(500).json({ error: 'Failed to run resolution check' });
  }
});

// SYNC DATABASE WITH BLOCKCHAIN STATE
app.post('/api/admin/sync-database-top', async (req, res) => {
  console.log('TOP SYNC DATABASE ROUTE HIT!');
  try {
    if (!resolutionService || !provider) {
      return res.status(500).json({ error: 'Services not initialized' });
    }
    
    // Get all contracts from database
    const contracts = await resolutionService.db.getAllContracts();
    let syncedCount = 0;
    
    for (const contract of contracts) {
      try {
        console.log(`Syncing contract ${contract.address}...`);
        
        // Get on-chain state
        const optionContract = new ethers.Contract(contract.address, OptionContractABI, provider);
        const [isFilled, isResolved, isExercised, long, expiry, priceAtExpiry] = await Promise.all([
          optionContract.isFilled(),
          optionContract.isResolved(),
          optionContract.isExercised(),
          optionContract.long(),
          optionContract.expiry(),
          optionContract.priceAtExpiry()
        ]);
        
        // Update database if state differs
        const updates = {};
        if (isFilled !== Boolean(contract.is_filled)) {
          updates.is_filled = isFilled ? 1 : 0;
          if (isFilled && !contract.long_address) {
            updates.long_address = long;
            updates.expiry = expiry.toString();
            updates.filled_at = new Date().toISOString();
          }
        }
        if (isResolved !== Boolean(contract.is_resolved)) {
          updates.is_resolved = isResolved ? 1 : 0;
        }
        if (isExercised !== Boolean(contract.is_exercised)) {
          updates.is_exercised = isExercised ? 1 : 0;
        }
        if (isResolved && priceAtExpiry.toString() !== '0' && !contract.price_at_expiry) {
          updates.price_at_expiry = priceAtExpiry.toString();
        }
        
        if (Object.keys(updates).length > 0) {
          await resolutionService.db.updateContract(contract.address, updates);
          console.log(`Updated contract ${contract.address}:`, updates);
          syncedCount++;
        }
        
      } catch (error) {
        console.error(`Error syncing contract ${contract.address}:`, error.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Database sync completed`,
      syncedCount: syncedCount
    });
  } catch (error) {
    console.error('Database sync error:', error);
    res.status(500).json({ error: 'Failed to sync database' });
  }
});

// Blockchain setup
let provider;
let signer;

// Initialize blockchain connection
async function initializeBlockchain() {
  try {
    // Connect to configured RPC endpoint
    const rpcUrl = process.env.RPC_URL || 'https://your-rpc-endpoint.com';
    console.log('Attempting to connect to RPC URL:', rpcUrl);
    
    // Create provider without ENS resolution
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test the connection
    const network = await provider.getNetwork();
    console.log('Connected to blockchain network:', network.name, 'Chain ID:', network.chainId);
    
  } catch (error) {
    console.error('Failed to connect to blockchain:', error);
    console.error('Provider will be undefined - blockchain operations will fail');
  }
}

// Contract ABIs (you'll need to import these from your compiled contracts)
const OptionContractABI = require('../contract-utils/OptionContractABI.json');
const SimuOracleABI = require('../contract-utils/SimuOracleABI.json');
const MTKABI = require('../contract-utils/MTKContractABI.json');
const TwoTKABI = require('../contract-utils/TwoTKContractABI.json');
const OptionMultiCallABI = require('../contract-utils/OptionMultiCallABI.json');

// MultiCall contract address from environment
const ENTER_AND_APPROVE = process.env.ENTER_AND_APPROVE;

// Check if ENTER_AND_APPROVE is configured
if (!ENTER_AND_APPROVE) {
  console.warn('⚠️ ENTER_AND_APPROVE environment variable not set - bundled transactions will not work');
}

// New resolution service with database
const ResolutionService = require('./resolutionService');
let resolutionService;

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get blockchain status
app.get('/api/blockchain/status', async (req, res) => {
  try {
    if (!provider) {
      return res.status(500).json({ error: 'Blockchain provider not initialized' });
    }
    
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    res.json({
      connected: true,
      blockNumber,
      network: network.name,
      chainId: network.chainId.toString()
    });
  } catch (error) {
    console.error('Blockchain status error:', error);
    res.status(500).json({ error: 'Failed to get blockchain status' });
  }
});

// Get account balance
app.get('/api/account/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await provider.getBalance(address);
    res.json({
      address,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get token balance
app.get('/api/token/:tokenAddress/balance/:userAddress', async (req, res) => {
  try {
    const { tokenAddress, userAddress } = req.params;
    const tokenContract = new ethers.Contract(tokenAddress, MTKABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    
    res.json({
      tokenAddress,
      userAddress,
      symbol,
      balance: ethers.formatUnits(balance, decimals),
      balanceRaw: balance.toString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get token balance' });
  }
});

// Get oracle prices
app.get('/api/oracle/prices', async (req, res) => {
  try {
    const oracleAddress = process.env.ORACLE_ADDRESS;
    if (!oracleAddress) {
      return res.status(500).json({ error: 'Oracle address not configured' });
    }
    
    const oracleContract = new ethers.Contract(oracleAddress, SimuOracleABI, provider);
    const tokenCount = await oracleContract.getTokenCount();
    
    const prices = [];
    for (let i = 0; i < tokenCount; i++) {
      const tokenAddress = await oracleContract.getTokenAt(i);
      const [realPrice, price1e18, lastUpdated, symbol] = await oracleContract.getPrice(tokenAddress);
      prices.push({
        tokenAddress,
        symbol,
        realPrice: realPrice.toString(),
        price1e18: price1e18.toString(),
        lastUpdated: lastUpdated.toString()
      });
    }
    
    res.json({ prices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get oracle prices' });
  }
});

// Get option contract details
app.get('/api/option/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    const [
      short,
      long,
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePrice,
      optionSize,
      premium,
      expiry,
      isFilled,
      isExercised,
      isFunded,
      oracle,
      priceAtExpiry,
      isResolved
    ] = await Promise.all([
      optionContract.short(),
      optionContract.long(),
      optionContract.underlyingToken(),
      optionContract.strikeToken(),
      optionContract.underlyingSymbol(),
      optionContract.strikeSymbol(),
      optionContract.strikePrice(),
      optionContract.optionSize(),
      optionContract.premium(),
      optionContract.expiry(),
      optionContract.isFilled(),
      optionContract.isExercised(),
      optionContract.isFunded(),
      optionContract.oracle(),
      optionContract.priceAtExpiry(),
      optionContract.isResolved()
    ]);
    
    res.json({
      contractAddress,
      short,
      long,
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePrice: strikePrice.toString(),
      optionSize: optionSize.toString(),
      premium: premium.toString(),
      expiry: expiry.toString(),
      isFilled,
      isExercised,
      isFunded,
      oracle,
      priceAtExpiry: priceAtExpiry.toString(),
      isResolved
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get option contract details' });
  }
});

// Create option contract with bundled approve + create transactions
app.post('/api/option/create', async (req, res) => {
  try {
    // Check if provider is initialized
    if (!provider) {
      return res.status(500).json({ 
        error: 'Blockchain provider not initialized',
        details: 'The server could not connect to the blockchain network'
      });
    }

    const {
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePrice,
      optionSize,
      premium,
      oracle,
      userAddress // Frontend needs to provide the user's address
    } = req.body;
    
    // Validate required fields
    if (!underlyingToken || !strikeToken || !oracle || !userAddress) {
      return res.status(400).json({ 
        error: 'Missing required contract addresses or user address' 
      });
    }
    
    const optionSizeWei = ethers.parseUnits(optionSize.toString(), 18);
    
    // Create contract factory for deployment
    const compiledContract = require('../out/OptionContract.sol/OptionContract.json');
    const contractFactory = new ethers.ContractFactory(
      OptionContractABI,
      compiledContract.bytecode.object,
      provider
    );
    
    // Get the deployment transaction data (bytecode + constructor)
    const deployTx = await contractFactory.getDeployTransaction(
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      ethers.parseUnits(strikePrice.toString(), 18),
      optionSizeWei,
      ethers.parseUnits(premium.toString(), 18),
      oracle
    );
    
    // Predict the contract address that will be deployed
    // We need the user's current nonce to predict the address
    const userNonce = await provider.getTransactionCount(userAddress);
    const predictedAddress = ethers.getCreateAddress({
      from: userAddress,
      nonce: userNonce + 1 // +1 because first tx will be approve, second will be deploy
    });
    
    // Create ERC20 contract instance for the underlying token to prepare approve transaction
    // Underlying token is usually 2TK, but use a standard ERC20 ABI
    const tokenABI = TwoTKABI; // Both token contracts should have standard ERC20 interface
    
    const tokenContract = new ethers.Contract(underlyingToken, tokenABI, provider);
    
    // Prepare approve transaction data for the predicted contract address
    const approveData = tokenContract.interface.encodeFunctionData('approve', [predictedAddress, optionSizeWei]);
    
    // Return both transactions for the frontend to execute sequentially
    res.json({
      success: true,
      message: 'Approve + Create Option transactions prepared for MetaMask signing',
      data: {
        transactions: [
          {
            to: underlyingToken,
            data: approveData,
            value: '0x0',
            description: 'Approve tokens for option contract'
          },
          {
            to: null, // Contract creation
            data: deployTx.data,
            value: '0x0',
            description: 'Create option contract'
          }
        ],
        predictedAddress,
        optionSize: optionSizeWei.toString()
      }
    });
  } catch (error) {
    console.error('Error creating option:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to create option contract',
      details: error.message 
    });
  }
});

// Fund option contract (approval should already be done during creation)
app.post('/api/option/:contractAddress/fund', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    // Prepare fund transaction data
    const fundData = optionContract.interface.encodeFunctionData('fund');
    
    res.json({
      success: true,
      message: 'Fund transaction prepared for MetaMask signing',
      data: {
        to: contractAddress,
        data: fundData,
        value: '0x0'
      }
    });
  } catch (error) {
    console.error('Error preparing fund transaction:', error);
    res.status(500).json({ error: 'Failed to prepare fund transaction' });
  }
});

// Enter as long (buy option) using MultiCall contract for single transaction
app.post('/api/option/:contractAddress/enter', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    // Validate contract address format
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      return res.status(400).json({ 
        error: 'Invalid contract address format',
        address: contractAddress 
      });
    }
    
    // Check if ENTER_AND_APPROVE is configured
    if (!ENTER_AND_APPROVE) {
      return res.status(500).json({
        error: 'ENTER_AND_APPROVE environment variable not configured',
        details: 'The MultiCall contract address is not set in environment variables'
      });
    }
    
    console.log('Processing enter request for contract:', contractAddress);
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    // Get contract details to determine strike token and premium
    const strikeToken = await optionContract.strikeToken();
    const premium = await optionContract.premium();
    
    console.log('Strike token:', strikeToken);
    console.log('Premium:', premium.toString());
    
    // Create MultiCall contract instance
    const multiCallContract = new ethers.Contract(ENTER_AND_APPROVE, OptionMultiCallABI, provider);
    
    // Prepare MultiCall transaction data
    const multiCallData = multiCallContract.interface.encodeFunctionData('approveAndEnterAsLong', [
      strikeToken,
      contractAddress,
      premium
    ]);
    
    // Return single transaction for the frontend to execute
    res.json({
      success: true,
      message: 'Single MultiCall transaction prepared for MetaMask signing',
      data: {
        to: ENTER_AND_APPROVE,
        data: multiCallData,
        value: '0x0',
        description: 'Approve premium and enter as long position (bundled)'
      }
    });
  } catch (error) {
    console.error('Error preparing enter transaction:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to prepare enter transaction',
      details: error.message 
    });
  }
});

// Resolve option
app.post('/api/option/:contractAddress/resolve', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    const resolveData = optionContract.interface.encodeFunctionData('resolve');
    
    res.json({
      success: true,
      message: 'Resolve transaction prepared for MetaMask signing',
      data: {
        to: contractAddress,
        data: resolveData,
        value: '0x0'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to prepare resolve transaction' });
  }
});

// Exercise option using MultiCall contract for single transaction
app.post('/api/option/:contractAddress/exercise', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const { mtkAmount } = req.body;
    
    // Check if ENTER_AND_APPROVE is configured
    if (!ENTER_AND_APPROVE) {
      return res.status(500).json({
        error: 'ENTER_AND_APPROVE environment variable not configured',
        details: 'The MultiCall contract address is not set in environment variables'
      });
    }
    
    console.log('Processing exercise request for contract:', contractAddress);
    console.log('MTK amount to spend:', mtkAmount);
    
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    // Get contract details to determine strike token
    const strikeToken = await optionContract.strikeToken();
    
    // Convert mtkAmount to wei (assuming it comes as a number)
    const mtkAmountWei = ethers.parseUnits(mtkAmount.toString(), 18);
    
    console.log('Strike token:', strikeToken);
    console.log('MTK amount (wei):', mtkAmountWei.toString());
    
    // Create MultiCall contract instance
    const multiCallContract = new ethers.Contract(ENTER_AND_APPROVE, OptionMultiCallABI, provider);
    
    // Prepare MultiCall transaction data for approveAndExercise
    const multiCallData = multiCallContract.interface.encodeFunctionData('approveAndExercise', [
      strikeToken,
      contractAddress,
      mtkAmountWei
    ]);
    
    // Return single transaction for the frontend to execute
    res.json({
      success: true,
      message: 'Single MultiCall exercise transaction prepared for MetaMask signing',
      data: {
        to: ENTER_AND_APPROVE,
        data: multiCallData,
        value: '0x0',
        description: 'Approve MTK and exercise option (bundled)'
      }
    });
  } catch (error) {
    console.error('Error preparing exercise transaction:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to prepare exercise transaction',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize new resolution service
async function initializeResolutionService() {
  try {
    resolutionService = new ResolutionService(provider);
    const initialized = await resolutionService.initialize();
    
    if (initialized) {
      console.log('✅ Event-driven resolution service ready');
    }
  } catch (error) {
    console.error('Failed to initialize resolution service:', error);
  }
}

// Manual resolution trigger
app.post('/api/admin/resolve-expired', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const resolvedCount = await resolutionService.resolveExpiredContracts();
    res.json({ 
      success: true, 
      message: `Resolution check completed`,
      resolvedCount: resolvedCount
    });
  } catch (error) {
    console.error('Manual resolution error:', error);
    res.status(500).json({ error: 'Failed to run resolution check' });
  }
});

// Get resolution service status
app.get('/api/admin/resolution-status', (req, res) => {
  if (!resolutionService) {
    return res.json({ initialized: false });
  }
  
  res.json(resolutionService.getStatus());
});

// Fund contract endpoint - now triggers database update

// Register new contract in database
app.post('/api/contracts/register', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const contractData = req.body;
    
    // Validate required fields
    if (!contractData.address || !ethers.isAddress(contractData.address)) {
      return res.status(400).json({ error: 'Invalid contract address' });
    }
    
    await resolutionService.addContract(contractData);
    
    res.json({ 
      success: true, 
      message: 'Contract registered in database',
      address: contractData.address
    });
  } catch (error) {
    console.error('Contract registration error:', error);
    res.status(500).json({ error: 'Failed to register contract' });
  }
});

// Handle contract funded event
app.post('/api/contracts/:contractAddress/funded', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const { contractAddress } = req.params;
    const { transactionHash } = req.body;
    
    await resolutionService.handleFunded(contractAddress, transactionHash);
    
    res.json({ success: true, message: 'Funded event recorded' });
  } catch (error) {
    console.error('Error handling funded event:', error);
    res.status(500).json({ error: 'Failed to handle funded event' });
  }
});

// Handle long entry event - THE KEY TRIGGER
app.post('/api/contracts/:contractAddress/long-entered', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const { contractAddress } = req.params;
    const { longAddress, expiry, transactionHash } = req.body;
    
    await resolutionService.handleLongEntry(contractAddress, longAddress, expiry, transactionHash);
    
    res.json({ success: true, message: 'Long entry recorded and resolution timer set' });
  } catch (error) {
    console.error('Error handling long entry:', error);
    res.status(500).json({ error: 'Failed to handle long entry' });
  }
});

// Handle exercise event
app.post('/api/contracts/:contractAddress/exercised', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const { contractAddress } = req.params;
    const { transactionHash } = req.body;
    
    await resolutionService.handleExercise(contractAddress, transactionHash);
    
    res.json({ success: true, message: 'Exercise event recorded' });
  } catch (error) {
    console.error('Error handling exercise event:', error);
    res.status(500).json({ error: 'Failed to handle exercise event' });
  }
});

// Test route to isolate the issue
app.get('/api/test', (req, res) => {
  console.log('TEST ROUTE HIT!');
  res.json({ message: 'Test route working' });
});

// TEMPORARY SIMPLE CONTRACTS ROUTE FOR DEBUGGING
app.get('/api/contracts/simple', (req, res) => {
  console.log('SIMPLE CONTRACTS ROUTE HIT!');
  res.json({ contracts: [] });
});

// Get all contracts from database
app.get('/api/contracts/all', async (req, res) => {
  console.log('GET /api/contracts/all - Request received');
  console.log('Resolution service available:', !!resolutionService);
  
  try {
    // SIMPLIFIED: Just return empty array for now
    console.log('Returning empty contracts for debugging');
    res.json({ contracts: [] });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch contracts',
      details: error.message 
    });
  }
});

// Debug: List all registered routes
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log('Registered route:', r.route.path, Object.keys(r.route.methods));
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeBlockchain();
  
  // Initialize automated resolution service after a short delay
  setTimeout(async () => {
    await initializeResolutionService();
  }, 2000);
}); 