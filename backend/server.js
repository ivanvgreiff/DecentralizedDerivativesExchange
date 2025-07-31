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

// Blockchain setup
let provider;
let signer;

// Initialize blockchain connection
function initializeBlockchain() {
  try {
    // Connect to configured RPC endpoint
    const rpcUrl = process.env.RPC_URL || 'https://your-rpc-endpoint.com';
    
    // Create provider without ENS resolution
    provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Disable ENS resolution by overriding the getResolver method
    provider.getResolver = async () => null;
    
    console.log('Connected to blockchain network');
  } catch (error) {
    console.error('Failed to connect to blockchain:', error);
  }
}

// Contract ABIs (you'll need to import these from your compiled contracts)
const OptionContractABI = require('../contract-utils/OptionContractABI.json');
const SimuOracleABI = require('../contract-utils/SimuOracleABI.json');
const MTKABI = require('../contract-utils/MTKContractABI.json');
const TwoTKABI = require('../contract-utils/TwoTKContractABI.json');

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

// Create option contract (requires transaction)
app.post('/api/option/create', async (req, res) => {
  try {
    const {
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePrice,
      optionSize,
      premium,
      oracle
    } = req.body;
    
    // Validate required fields
    if (!underlyingToken || !strikeToken || !oracle) {
      return res.status(400).json({ 
        error: 'Missing required contract addresses' 
      });
    }
    
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
      ethers.parseUnits(optionSize.toString(), 18),
      ethers.parseUnits(premium.toString(), 18),
      oracle
    );
    
    // Return deployment transaction data for frontend to sign
    res.json({
      success: true,
      message: 'Contract deployment data prepared for MetaMask signing',
      data: {
        data: deployTx.data,
        value: '0x0'
      }
    });
  } catch (error) {
    console.error('Error creating option:', error);
    res.status(500).json({ error: 'Failed to create option contract' });
  }
});

// Fund option contract
app.post('/api/option/:contractAddress/fund', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    // Return transaction data for frontend to sign
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
    res.status(500).json({ error: 'Failed to prepare fund transaction' });
  }
});

// Enter as long (buy option)
app.post('/api/option/:contractAddress/enter', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    const enterData = optionContract.interface.encodeFunctionData('enterAsLong');
    
    res.json({
      success: true,
      message: 'Enter as long transaction prepared for MetaMask signing',
      data: {
        to: contractAddress,
        data: enterData,
        value: '0x0'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to prepare enter transaction' });
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

// Exercise option
app.post('/api/option/:contractAddress/exercise', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const { mtkAmount } = req.body;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    const exerciseData = optionContract.interface.encodeFunctionData('exercise', [mtkAmount]);
    
    res.json({
      success: true,
      message: 'Exercise transaction prepared for MetaMask signing',
      data: {
        to: contractAddress,
        data: exerciseData,
        value: '0x0'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to prepare exercise transaction' });
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
app.post('/api/option/:contractAddress/fund', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
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
    res.status(500).json({ error: 'Failed to prepare fund transaction' });
  }
});

// Enter as long endpoint - now triggers resolution timer
app.post('/api/option/:contractAddress/enter', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    const enterData = optionContract.interface.encodeFunctionData('enterAsLong');
    
    res.json({
      success: true,
      message: 'Enter as long transaction prepared for MetaMask signing',
      data: {
        to: contractAddress,
        data: enterData,
        value: '0x0'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to prepare enter transaction' });
  }
});

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

// Get all contracts from database
app.get('/api/contracts/all', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const contracts = await resolutionService.db.getAllContracts();
    res.json({ contracts });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeBlockchain();
  
  // Initialize automated resolution service after a short delay
  setTimeout(() => {
    initializeResolutionService();
  }, 2000);
}); 