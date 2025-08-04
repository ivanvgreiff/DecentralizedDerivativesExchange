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

// WORKING SINGLE CONTRACT ROUTE AT THE TOP
app.get('/api/contracts/:contractAddress/details', async (req, res) => {
  console.log('TOP CONTRACT DETAILS ROUTE HIT!');
  try {
    const { contractAddress } = req.params;
    
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const contract = await resolutionService.db.getContract(contractAddress);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found in database' });
    }
    
    // Transform the data to ensure proper conditional fields
    const transformedContract = {
      contractAddress: contract.address,
      short: contract.short_address,
      long: contract.long_address || '0x0000000000000000000000000000000000000000',
      underlyingToken: contract.underlying_token,
      strikeToken: contract.strike_token,
      underlyingSymbol: contract.underlying_symbol,
      strikeSymbol: contract.strike_symbol,
      strikePrice: contract.strike_price,
      optionSize: contract.option_size,
      premium: contract.premium,
      oracle: contract.oracle_address,
      expiry: contract.expiry,
      isFunded: Boolean(contract.is_funded),
      isFilled: Boolean(contract.is_filled),
      isResolved: Boolean(contract.is_resolved),
      isExercised: Boolean(contract.is_exercised),
      // Only include price at expiry if resolved AND expired
      priceAtExpiry: (contract.is_resolved && contract.expiry && contract.expiry * 1000 < Date.now()) 
        ? contract.price_at_expiry 
        : null,
      status: contract.status,
      createdAt: contract.created_at,
      fundedAt: contract.funded_at,
      filledAt: contract.filled_at,
      resolvedAt: contract.resolved_at,
      exercisedAt: contract.exercised_at
    };
    
    res.json({ contract: transformedContract });
  } catch (error) {
    console.error('Error fetching contract details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contract details',
      details: error.message 
    });
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

// FIX DATA INTEGRITY FOR EXERCISED CONTRACTS
app.post('/api/admin/fix-exercised-data', async (req, res) => {
  console.log('FIXING EXERCISED DATA INTEGRITY');
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    // Find all contracts that are marked as exercised but don't have exercised_at timestamp
    const contracts = await resolutionService.db.getAllContracts();
    let fixedCount = 0;
    
    for (const contract of contracts) {
      if (contract.is_exercised && !contract.exercised_at) {
        console.log(`Fixing exercised_at for contract ${contract.address}`);
        
        // Set exercised_at to the resolved_at time (best guess) or current time
        const exercisedAt = contract.resolved_at || new Date().toISOString();
        
        await resolutionService.db.updateContract(contract.address, {
          exercised_at: exercisedAt
        });
        
        fixedCount++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `Fixed exercised_at timestamps for ${fixedCount} contracts`
    });
  } catch (error) {
    console.error('Error fixing exercised data:', error);
    res.status(500).json({ error: 'Failed to fix exercised data' });
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

// OptionsBook ABI for factory pattern
const OptionsBookABI = [
  'function createAndFundCallOption(address _underlyingToken, address _strikeToken, string memory _underlyingSymbol, string memory _strikeSymbol, uint256 _strikePrice, uint256 _optionSize, uint256 _premium, address _oracle) external returns (address)',
  'function createAndFundPutOption(address _underlyingToken, address _strikeToken, string memory _underlyingSymbol, string memory _strikeSymbol, uint256 _strikePrice, uint256 _optionSize, uint256 _premium, address _oracle) external returns (address)',
  'function getAllCallOptions() external view returns (address[] memory)',
  'function getAllPutOptions() external view returns (address[] memory)'
];

// Contract addresses from environment (NO FALLBACKS - MUST BE IN .env)
const OPTIONSBOOK_ADDRESS = process.env.OPTIONS_BOOK;
const CALL_IMPL_ADDRESS = process.env.CALL_OPTION_IMPL;
const PUT_IMPL_ADDRESS = process.env.PUT_OPTION_IMPL;

// Validate that all required addresses are provided
if (!OPTIONSBOOK_ADDRESS) {
  console.error('❌ OPTIONS_BOOK not found in environment variables');
  process.exit(1);
}
if (!CALL_IMPL_ADDRESS) {
  console.error('❌ CALL_OPTION_IMPL not found in environment variables');
  process.exit(1);
}
if (!PUT_IMPL_ADDRESS) {
  console.error('❌ PUT_OPTION_IMPL not found in environment variables');
  process.exit(1);
}

console.log('✅ Contract addresses loaded from .env:');
console.log('  OPTIONS_BOOK:', OPTIONSBOOK_ADDRESS);
console.log('  CALL_OPTION_IMPL:', CALL_IMPL_ADDRESS);
console.log('  PUT_OPTION_IMPL:', PUT_IMPL_ADDRESS);

// Query current OptionsBook factory for all actual contracts
app.get('/api/factory/all-contracts', async (req, res) => {
  try {
    console.log('🔍 Factory endpoint called');
    console.log('Provider available:', !!provider);
    console.log('OptionsBook address:', OPTIONSBOOK_ADDRESS);
    
    if (!provider) {
      return res.status(500).json({ error: 'Provider not initialized' });
    }
    
    const optionsBookContract = new ethers.Contract(OPTIONSBOOK_ADDRESS, OptionsBookABI, provider);
    console.log('OptionsBook contract created');
    
    // Get all call and put options from the CURRENT factory
    console.log('Calling getAllCallOptions...');
    const callOptions = await optionsBookContract.getAllCallOptions();
    console.log('Call options:', callOptions);
    
    console.log('Calling getAllPutOptions...');
    const putOptions = await optionsBookContract.getAllPutOptions();
    console.log('Put options:', putOptions);
    
    // Get detailed info for each contract from current factory
    const allContracts = [];
    
    for (const address of callOptions) {
      try {
        const optionContract = new ethers.Contract(address, OptionContractABI, provider);
        const [short, long, isFunded, isFilled, isExercised, isResolved, expiry, strikePrice, optionSize, premium] = await Promise.all([
          optionContract.short(),
          optionContract.long(),
          optionContract.isFunded(),
          optionContract.isFilled(),
          optionContract.isExercised(),
          optionContract.isResolved(),
          optionContract.expiry(),
          optionContract.strikePrice(),
          optionContract.optionSize(),
          optionContract.premium()
        ]);
        
        allContracts.push({
          address,
          type: 'call',
          short,
          long,
          isFunded,
          isFilled,
          isExercised,
          isResolved,
          expiry: expiry.toString(),
          strikePrice: strikePrice.toString(),
          optionSize: optionSize.toString(),
          premium: premium.toString()
        });
      } catch (error) {
        console.error(`Error querying call option ${address}:`, error.message);
      }
    }
    
    for (const address of putOptions) {
      try {
        const optionContract = new ethers.Contract(address, OptionContractABI, provider);
        const [short, long, isFunded, isFilled, isExercised, isResolved, expiry, strikePrice, optionSize, premium] = await Promise.all([
          optionContract.short(),
          optionContract.long(),
          optionContract.isFunded(),
          optionContract.isFilled(),
          optionContract.isExercised(),
          optionContract.isResolved(),
          optionContract.expiry(),
          optionContract.strikePrice(),
          optionContract.optionSize(),
          optionContract.premium()
        ]);
        
        allContracts.push({
          address,
          type: 'put',
          short,
          long,
          isFunded,
          isFilled,
          isExercised,
          isResolved,
          expiry: expiry.toString(),
          strikePrice: strikePrice.toString(),
          optionSize: optionSize.toString(),
          premium: premium.toString()
        });
      } catch (error) {
        console.error(`Error querying put option ${address}:`, error.message);
      }
    }
    
    res.json({ 
      optionsBookAddress: OPTIONSBOOK_ADDRESS,
      callOptionsCount: callOptions.length,
      putOptionsCount: putOptions.length,
      contracts: allContracts
    });
  } catch (error) {
    console.error('Error querying factory contracts:', error);
    res.status(500).json({ error: 'Failed to query factory contracts' });
  }
});


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

// Create call option using OptionsBook factory
app.post('/api/option/create-call', async (req, res) => {
  try {
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
      userAddress
    } = req.body;
    
    if (!underlyingToken || !strikeToken || !oracle || !userAddress) {
      return res.status(400).json({ 
        error: 'Missing required contract addresses or user address' 
      });
    }
    
    const optionSizeWei = ethers.parseUnits(optionSize.toString(), 18);
    const strikePriceWei = ethers.parseUnits(strikePrice.toString(), 18);
    const premiumWei = ethers.parseUnits(premium.toString(), 18);
    
    // Create OptionsBook contract instance
    const optionsBookContract = new ethers.Contract(OPTIONSBOOK_ADDRESS, OptionsBookABI, provider);
    
    // For call options, user needs to approve underlying token (2TK) to OptionsBook
    const tokenContract = new ethers.Contract(underlyingToken, TwoTKABI, provider);
    
    // Prepare approve transaction data
    const approveData = tokenContract.interface.encodeFunctionData('approve', [OPTIONSBOOK_ADDRESS, optionSizeWei]);
    
    // Prepare createAndFundCallOption transaction data
    const createData = optionsBookContract.interface.encodeFunctionData('createAndFundCallOption', [
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePriceWei,
      optionSizeWei,
      premiumWei,
      oracle
    ]);
    
    res.json({
      success: true,
      message: 'Call option transactions prepared for MetaMask signing',
      data: {
        approveTransaction: {
          to: underlyingToken,
          data: approveData,
          value: '0x0'
        },
        createTransaction: {
          to: OPTIONSBOOK_ADDRESS,
          data: createData,
          value: '0x0'
        },
        tokenToApprove: underlyingToken,
        amountToApprove: optionSizeWei.toString(),
        optionsBookAddress: OPTIONSBOOK_ADDRESS
      }
    });
  } catch (error) {
    console.error('Error creating call option:', error);
    res.status(500).json({ 
      error: 'Failed to create call option contract',
      details: error.message 
    });
  }
});

// Create put option using OptionsBook factory
app.post('/api/option/create-put', async (req, res) => {
  try {
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
      userAddress
    } = req.body;
    
    if (!underlyingToken || !strikeToken || !oracle || !userAddress) {
      return res.status(400).json({ 
        error: 'Missing required contract addresses or user address' 
      });
    }
    
    const optionSizeWei = ethers.parseUnits(optionSize.toString(), 18);
    const strikePriceWei = ethers.parseUnits(strikePrice.toString(), 18);
    const premiumWei = ethers.parseUnits(premium.toString(), 18);
    
    // For put options, user needs to deposit strike tokens (MTK) = (optionSize * strikePrice) / 1e18
    const mtkToSend = (optionSizeWei * strikePriceWei) / ethers.parseUnits('1', 18);
    
    // Create OptionsBook contract instance
    const optionsBookContract = new ethers.Contract(OPTIONSBOOK_ADDRESS, OptionsBookABI, provider);
    
    // For put options, user needs to approve strike token (MTK) to OptionsBook
    const tokenContract = new ethers.Contract(strikeToken, MTKABI, provider);
    
    // Prepare approve transaction data
    const approveData = tokenContract.interface.encodeFunctionData('approve', [OPTIONSBOOK_ADDRESS, mtkToSend]);
    
    // Prepare createAndFundPutOption transaction data
    const createData = optionsBookContract.interface.encodeFunctionData('createAndFundPutOption', [
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePriceWei,
      optionSizeWei,
      premiumWei,
      oracle
    ]);
    
    res.json({
      success: true,
      message: 'Put option transactions prepared for MetaMask signing',
      data: {
        approveTransaction: {
          to: strikeToken,
          data: approveData,
          value: '0x0'
        },
        createTransaction: {
          to: OPTIONSBOOK_ADDRESS,
          data: createData,
          value: '0x0'
        },
        tokenToApprove: strikeToken,
        amountToApprove: mtkToSend.toString(),
        optionsBookAddress: OPTIONSBOOK_ADDRESS
      }
    });
  } catch (error) {
    console.error('Error creating put option:', error);
    res.status(500).json({ 
      error: 'Failed to create put option contract',
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

// Enter as long (buy option) - simple direct contract call
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
    
    console.log('Processing enter request for contract:', contractAddress);
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    // Get contract details to determine strike token and premium
    const strikeToken = await optionContract.strikeToken();
    const premium = await optionContract.premium();
    
    console.log('Strike token:', strikeToken);
    console.log('Premium:', premium.toString());
    
    // Prepare approve transaction data
    const tokenContract = new ethers.Contract(strikeToken, MTKABI, provider);
    const approveData = tokenContract.interface.encodeFunctionData('approve', [contractAddress, premium]);
    
    // Prepare enterAsLong transaction data
    const enterData = optionContract.interface.encodeFunctionData('enterAsLong');
    
    // Return both transactions for the frontend to execute separately
    res.json({
      success: true,
      message: 'Enter as long transactions prepared for MetaMask signing',
      data: {
        approveTransaction: {
          to: strikeToken,
          data: approveData,
          value: '0x0'
        },
        enterTransaction: {
          to: contractAddress,
          data: enterData,
          value: '0x0'
        },
        premiumToken: strikeToken,
        premiumAmount: premium.toString(),
        contractAddress: contractAddress
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

// Exercise option - simple direct contract call
app.post('/api/option/:contractAddress/exercise', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const { mtkAmount } = req.body;
    
    console.log('Processing exercise request for contract:', contractAddress);
    console.log('MTK amount to spend:', mtkAmount);
    
    const optionContract = new ethers.Contract(contractAddress, OptionContractABI, provider);
    
    // Get contract details to determine strike token
    const strikeToken = await optionContract.strikeToken();
    
    // Convert mtkAmount to wei (assuming it comes as a number)
    const mtkAmountWei = ethers.parseUnits(mtkAmount.toString(), 18);
    
    console.log('Strike token:', strikeToken);
    console.log('MTK amount (wei):', mtkAmountWei.toString());
    
    // Prepare approve transaction data
    const tokenContract = new ethers.Contract(strikeToken, MTKABI, provider);
    const approveData = tokenContract.interface.encodeFunctionData('approve', [contractAddress, mtkAmountWei]);
    
    // Prepare exercise transaction data
    const exerciseData = optionContract.interface.encodeFunctionData('exercise', [mtkAmountWei]);
    
    // Return both transactions for the frontend to execute separately
    res.json({
      success: true,
      message: 'Exercise transactions prepared for MetaMask signing',
      data: {
        approveTransaction: {
          to: strikeToken,
          data: approveData,
          value: '0x0'
        },
        exerciseTransaction: {
          to: contractAddress,
          data: exerciseData,
          value: '0x0'
        },
        strikeToken: strikeToken,
        mtkAmount: mtkAmountWei.toString(),
        contractAddress: contractAddress
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

// Register new contract in database (called after OptionsBook creation)
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

// Auto-register newly created contracts from OptionsBook transactions
app.post('/api/contracts/auto-register', async (req, res) => {
  try {
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const { 
      transactionHash,
      contractAddress,
      optionType,
      shortAddress,
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePrice,
      optionSize,
      premium,
      oracle
    } = req.body;
    
    // Prepare contract data for database
    const contractData = {
      address: contractAddress,
      short_address: shortAddress,
      underlying_token: underlyingToken,
      strike_token: strikeToken,
      underlying_symbol: underlyingSymbol,
      strike_symbol: strikeSymbol,
      strike_price: strikePrice,
      option_size: optionSize,
      premium: premium,
      oracle_address: oracle,
      option_type: optionType,
      is_funded: true, // Created via OptionsBook, so automatically funded
      transaction_hash: transactionHash,
      created_at: new Date().toISOString(),
      funded_at: new Date().toISOString()
    };
    
    await resolutionService.addContract(contractData);
    
    console.log(`✅ Auto-registered ${optionType} option contract: ${contractAddress}`);
    
    res.json({ 
      success: true, 
      message: 'Contract auto-registered successfully',
      address: contractAddress
    });
  } catch (error) {
    console.error('Auto-registration error:', error);
    res.status(500).json({ error: 'Failed to auto-register contract' });
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

// Get all contracts from database (MUST come before /:contractAddress route)
app.get('/api/contracts/all', async (req, res) => {
  console.log('GET /api/contracts/all - Request received');
  console.log('Resolution service available:', !!resolutionService);
  
  try {
    if (!resolutionService) {
      console.log('Resolution service not ready, returning empty array');
      return res.json({ contracts: [] });
    }
    
    const contracts = await resolutionService.db.getAllContracts();
    console.log('Found contracts in database:', contracts.length);
    res.json({ contracts });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch contracts',
      details: error.message 
    });
  }
});

// Get specific contract from database
app.get('/api/contracts/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    if (!resolutionService) {
      return res.status(500).json({ error: 'Resolution service not initialized' });
    }
    
    const contract = await resolutionService.db.getContract(contractAddress);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found in database' });
    }
    
    res.json({ contract });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contract',
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