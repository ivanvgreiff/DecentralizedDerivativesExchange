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
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
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
        const optionContract = new ethers.Contract(contract.address, CallOptionContractABI, provider);
        const [isFilled, isResolved, isExercised, isFunded, long, expiry, priceAtExpiry] = await Promise.all([
          optionContract.isFilled(),
          optionContract.isResolved(),
          optionContract.isExercised(),
          optionContract.isFunded(),
          optionContract.long(),
          optionContract.expiry(),
          optionContract.priceAtExpiry()
        ]);
        
        // Update database if state differs
        const updates = {};
        if (isFunded !== Boolean(contract.is_funded)) {
          updates.is_funded = isFunded ? 1 : 0;
          if (isFunded) {
            updates.funded_at = new Date().toISOString();
          }
        }
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
          if (isExercised && !contract.exercised_at) {
            updates.exercised_at = new Date().toISOString();
          }
        }
        // Also check if exercised but missing timestamp
        if (isExercised && contract.is_exercised && !contract.exercised_at) {
          updates.exercised_at = new Date().toISOString();
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
    
    // Set up periodic health check
    setInterval(async () => {
      try {
        if (provider) {
          await provider.getBlockNumber();
          console.log('✅ Blockchain connection healthy');
        }
      } catch (error) {
        console.error('❌ Blockchain connection lost, attempting to reconnect...');
        await initializeBlockchain();
      }
    }, 30000); // Check every 30 seconds
    
  } catch (error) {
    console.error('Failed to connect to blockchain:', error);
    console.error('Provider will be undefined - blockchain operations will fail');
  }
}

// Contract ABIs for new architecture
const CallOptionContractABI = require('../contract-utils/CallOptionContractABI.json');
const PutOptionContractABI = require('../contract-utils/PutOptionContractABI.json');
const OptionsBookABI = require('../contract-utils/OptionsBookABI.json');
const TransactionBundlerABI = require('../contract-utils/TransactionBundlerABI.json');
const SimuOracleABI = require('../contract-utils/SimuOracleABI.json');
const MTKABI = require('../contract-utils/MTKContractABI.json');
const TwoTKABI = require('../contract-utils/TwoTKContractABI.json');

// Legacy MultiCall - will be deprecated
const OptionMultiCallABI = require('../contract-utils/OptionMultiCallABI.json');
const ENTER_AND_APPROVE = process.env.ENTER_AND_APPROVE;

// New contract addresses
const CONTRACT_ADDRESSES = {
  PUT_OPTION_IMPL: process.env.PUT_OPTION_IMPL || '0xBa98d3a3609e2D19147DDF291d384c242948960B',
  CALL_OPTION_IMPL: process.env.CALL_OPTION_IMPL || '0xBe5E00aE934329B0A0758442503101BF9F0A2291', 
  OPTIONS_BOOK: process.env.OPTIONS_BOOK || '0x118AFE7A98F4348BdC95D7231d638b799CaEd324',
  TRANSACTION_BUNDLER: process.env.TRANSACTION_BUNDLER || '0xDA8357473AaBC0D0568fAF8889D0d9bf4cae0b23'
};

// Check if ENTER_AND_APPROVE is configured
if (!ENTER_AND_APPROVE) {
  console.warn('⚠️ ENTER_AND_APPROVE environment variable not set - bundled transactions will not work');
}

// Log contract addresses being used
console.log('📋 Using contract addresses:');
console.log('  CALL_OPTION_IMPL:', CONTRACT_ADDRESSES.CALL_OPTION_IMPL);
console.log('  PUT_OPTION_IMPL:', CONTRACT_ADDRESSES.PUT_OPTION_IMPL);
console.log('  OPTIONS_BOOK:', CONTRACT_ADDRESSES.OPTIONS_BOOK);
console.log('  TRANSACTION_BUNDLER:', CONTRACT_ADDRESSES.TRANSACTION_BUNDLER);

// New resolution service with database
const ResolutionService = require('./resolutionService');
let resolutionService;

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    provider: !!provider,
    resolutionService: !!resolutionService
  });
});

// Get blockchain status
app.get('/api/blockchain/status', async (req, res) => {
  try {
    if (!provider) {
      // Return mock data when provider is not available
      console.log('❌ Provider not initialized, returning mock data');
      return res.json({
        connected: false,
        blockNumber: 12345,
        network: 'localhost',
        chainId: '31337'
      });
    }
    
    console.log('🔍 Fetching blockchain status...');
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`✅ Blockchain status: Block ${blockNumber}, Network ${network.name}`);
    
    res.json({
      connected: true,
      blockNumber,
      network: network.name,
      chainId: network.chainId.toString()
    });
  } catch (error) {
    console.error('❌ Blockchain status error:', error.message);
    console.error('Error stack:', error.stack);
    // Return mock data on error
    res.json({
      connected: false,
      blockNumber: 12345,
      network: 'localhost',
      chainId: '31337'
    });
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
      // Return mock data when oracle address is not configured
      console.log('Oracle address not configured, returning mock data');
      return res.json({ 
        prices: [
          {
            tokenAddress: '0x1234567890123456789012345678901234567890',
            symbol: 'MTK',
            realPrice: '1000000000000000000',
            price1e18: '1000000000000000000',
            lastUpdated: Math.floor(Date.now() / 1000).toString()
          }
        ] 
      });
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
    console.error('Oracle prices error:', error);
    // Return mock data on error
    res.json({ 
      prices: [
        {
          tokenAddress: '0x1234567890123456789012345678901234567890',
          symbol: 'MTK',
          realPrice: '1000000000000000000',
          price1e18: '1000000000000000000',
          lastUpdated: Math.floor(Date.now() / 1000).toString()
        }
      ] 
    });
  }
});

// Helper function to detect contract type (call vs put option)
async function detectContractType(contractAddress) {
  console.log(`Detecting contract type for ${contractAddress}`);
  
  try {
    // First check if contract exists by calling a basic method
    const basicContract = new ethers.Contract(contractAddress, CallOptionContractABI, provider);
    await basicContract.strikePrice();
    console.log('Contract exists, testing for call option...');
    
    // Try to call getMaxSpendableMTK - only exists in call options
    await basicContract.getMaxSpendableMTK();
    console.log('Contract is a call option');
    return 'call';
  } catch (callError) {
    console.log('Not a call option, testing for put option...', callError.message);
    
    try {
      // Try to call getMaxReceivableMTK - only exists in put options  
      const putContract = new ethers.Contract(contractAddress, PutOptionContractABI, provider);
      await putContract.getMaxReceivableMTK();
      console.log('Contract is a put option');
      return 'put';
    } catch (putError) {
      console.error('Put option test failed:', putError.message);
      
      // Try to check if contract exists at all
      try {
        const code = await provider.getCode(contractAddress);
        if (code === '0x') {
          throw new Error(`No contract deployed at address ${contractAddress}`);
        } else {
          throw new Error(`Contract exists but unable to determine type. Call error: ${callError.message}, Put error: ${putError.message}`);
        }
      } catch (codeError) {
        throw new Error(`Failed to check contract existence: ${codeError.message}`);
      }
    }
  }
}

// Get option contract details with automatic type detection
app.get('/api/option/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    // Detect contract type
    const contractType = await detectContractType(contractAddress);
    const optionABI = contractType === 'call' ? CallOptionContractABI : PutOptionContractABI;
    const optionContract = new ethers.Contract(contractAddress, optionABI, provider);
    
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
      contractType,
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
    console.error('Error fetching option contract details:', error);
    res.status(500).json({ 
      error: 'Failed to get option contract details',
      details: error.message 
    });
  }
});

// Create call option using new TransactionBundler + OptionsBook architecture
app.post('/api/option/create-call', async (req, res) => {
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
      userAddress
    } = req.body;
    
    // Validate required fields
    if (!underlyingToken || !strikeToken || !oracle || !userAddress) {
      return res.status(400).json({ 
        error: 'Missing required contract addresses or user address' 
      });
    }
    
    console.log('Creating call option with new architecture');
    console.log('Option size:', optionSize, 'Strike price:', strikePrice);
    
    const optionSizeWei = ethers.parseUnits(optionSize.toString(), 18);
    const strikePriceWei = ethers.parseUnits(strikePrice.toString(), 18);
    const premiumWei = ethers.parseUnits(premium.toString(), 18);
    
    // For call options, short deposits underlying tokens (optionSize amount)
    const amountToApprove = optionSizeWei;
    const tokenToApprove = underlyingToken; // 2TK
    
    // Create OptionsBook contract instance
    const optionsBookContract = new ethers.Contract(CONTRACT_ADDRESSES.OPTIONS_BOOK, OptionsBookABI, provider);
    
    // Prepare the create option transaction (user will approve separately)
    const createTxData = optionsBookContract.interface.encodeFunctionData('createAndFundCallOption', [
      userAddress,              // tokenHolder (user address)
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePriceWei,
      optionSizeWei,
      premiumWei,
      oracle
    ]);
    
    // Check user's token balance first
    try {
      console.log('🔍 Checking user token balance...');
      const tokenContract = new ethers.Contract(tokenToApprove, [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)"
      ], provider);
      
      const balance = await tokenContract.balanceOf(userAddress);
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();
      
      console.log(`💰 User ${userAddress} has ${ethers.formatUnits(balance, decimals)} ${symbol}`);
      console.log(`📝 Required: ${ethers.formatUnits(amountToApprove, decimals)} ${symbol}`);
      
      if (balance < amountToApprove) {
        return res.status(400).json({
          error: 'Insufficient token balance',
          details: `You have ${ethers.formatUnits(balance, decimals)} ${symbol} but need ${ethers.formatUnits(amountToApprove, decimals)} ${symbol}`,
          userBalance: ethers.formatUnits(balance, decimals),
          required: ethers.formatUnits(amountToApprove, decimals),
          token: symbol
        });
      }
    } catch (balanceError) {
      console.error('❌ Token balance check failed:', balanceError.message);
      return res.status(400).json({
        error: 'Token contract error',
        details: `Cannot read token at ${tokenToApprove}: ${balanceError.message}`,
        tokenAddress: tokenToApprove
      });
    }

    // Test individual components to isolate the failure
    try {
      console.log('🧪 Testing individual components...');
      
      // Test 1: Check if user has approved tokens to OptionsBook (simplified architecture)
      const tokenContract = new ethers.Contract(tokenToApprove, [
        "function allowance(address owner, address spender) view returns (uint256)"
      ], provider);
      
      const currentAllowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESSES.OPTIONS_BOOK);
      console.log(`📋 Current allowance: ${ethers.formatUnits(currentAllowance, 18)} 2TK`);
      
      // Test 2: Try just encoding the new bundled call
      console.log('🧪 Testing new bundled call encoding...');
      const testApproveResult = await optionsBookContract.interface.encodeFunctionData('approveAndCreateCallOption', [
        underlyingToken,
        strikeToken,
        underlyingSymbol,
        strikeSymbol,
        strikePriceWei,
        optionSizeWei,
        premiumWei,
        oracle
      ]);
      
      // Test 3: Check if OptionsBook exists and has correct implementation addresses
      const optionsBookReadContract = new ethers.Contract(CONTRACT_ADDRESSES.OPTIONS_BOOK, [
        "function callOptionImplementation() view returns (address)",
        "function putOptionImplementation() view returns (address)"
      ], provider);
      
      const callImpl = await optionsBookReadContract.callOptionImplementation();
      const putImpl = await optionsBookReadContract.putOptionImplementation();
      console.log(`📋 OptionsBook Call Implementation: ${callImpl}`);
      console.log(`📋 OptionsBook Put Implementation: ${putImpl}`);
      console.log(`📋 Expected Call Implementation: ${CONTRACT_ADDRESSES.CALL_OPTION_IMPL}`);
      console.log(`📋 Expected Put Implementation: ${CONTRACT_ADDRESSES.PUT_OPTION_IMPL}`);
      
      // Skip static call test for two-transaction approach
      console.log('✅ Two-transaction approach - skipping static call test');
    } catch (testError) {
      console.warn('⚠️ Testing components failed (expected for two-transaction approach):', testError.message);
    }

    // Debug: Check if the new OptionsBook contract exists and has the right function
    try {
      console.log('🔍 DEBUG: Verifying OptionsBook contract...');
      const code = await provider.getCode(CONTRACT_ADDRESSES.OPTIONS_BOOK);
      console.log('📋 Contract code length:', code.length);
      
      if (code === '0x') {
        console.error('❌ OptionsBook contract not found at address:', CONTRACT_ADDRESSES.OPTIONS_BOOK);
        return res.status(400).json({
          error: 'OptionsBook contract not deployed',
          address: CONTRACT_ADDRESSES.OPTIONS_BOOK
        });
      }
      
      // Check token approval status before attempting transaction
      console.log('🔍 Checking token approval status...');
      const tokenContract = new ethers.Contract(underlyingToken, [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function balanceOf(address account) view returns (uint256)',
        'function symbol() view returns (string)'
      ], provider);
      
      try {
        const [userBalance, allowance, tokenSymbol] = await Promise.all([
          tokenContract.balanceOf(userAddress),
          tokenContract.allowance(userAddress, CONTRACT_ADDRESSES.OPTIONS_BOOK),
          tokenContract.symbol()
        ]);
        
        const requiredAmount = ethers.parseEther(optionSize.toString());
        
        console.log('📊 Token Status Check:');
        console.log(`   Token: ${tokenSymbol} (${underlyingToken})`);
        console.log(`   User Balance: ${ethers.formatEther(userBalance)} tokens`);
        console.log(`   Required Amount: ${ethers.formatEther(requiredAmount)} tokens`);
        console.log(`   Current Allowance: ${ethers.formatEther(allowance)} tokens`);
        console.log(`   OptionsBook Address: ${CONTRACT_ADDRESSES.OPTIONS_BOOK}`);
        
        if (userBalance < requiredAmount) {
          return res.status(400).json({
            error: 'Insufficient token balance',
            details: {
              required: ethers.formatEther(requiredAmount),
              available: ethers.formatEther(userBalance),
              token: tokenSymbol
            }
          });
        }
        
        if (allowance < requiredAmount) {
          return res.status(400).json({
            error: 'Insufficient token allowance - user must approve OptionsBook first',
            details: {
              required: ethers.formatEther(requiredAmount),
              currentAllowance: ethers.formatEther(allowance),
              token: tokenSymbol,
              spender: CONTRACT_ADDRESSES.OPTIONS_BOOK
            }
          });
        }
        
        console.log('✅ Token approval check passed');
        
      } catch (approvalError) {
        console.error('❌ Token approval check failed:', approvalError.message);
        return res.status(500).json({
          error: 'Failed to check token approval status',
          details: approvalError.message
        });
      }
      
    } catch (debugError) {
      console.error('❌ Debug check failed:', debugError);
    }

    // Return separate approve and create transactions
    res.json({
      success: true,
      message: 'Call option creation transactions prepared (separate approve + create)',
      data: {
        // Transaction 1: Approve tokens
        approveTransaction: {
          to: tokenToApprove,
          data: new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']).encodeFunctionData('approve', [CONTRACT_ADDRESSES.OPTIONS_BOOK, amountToApprove]),
          value: '0x0',
          description: 'Approve OptionsBook to spend tokens'
        },
        // Transaction 2: Create option
        createTransaction: {
          to: CONTRACT_ADDRESSES.OPTIONS_BOOK,
          data: createTxData,
          value: '0x0',
          description: 'Create and fund call option'
        },
        tokenToApprove: tokenToApprove,
        amountToApprove: amountToApprove.toString(),
        optionsBookAddress: CONTRACT_ADDRESSES.OPTIONS_BOOK
      }
    });
  } catch (error) {
    console.error('Error creating call option:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to create call option contract',
      details: error.message 
    });
  }
});

// Create put option using new TransactionBundler + OptionsBook architecture
app.post('/api/option/create-put', async (req, res) => {
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
      userAddress
    } = req.body;
    
    // Validate required fields
    if (!underlyingToken || !strikeToken || !oracle || !userAddress) {
      return res.status(400).json({ 
        error: 'Missing required contract addresses or user address' 
      });
    }
    
    console.log('Creating put option with new architecture');
    console.log('Option size:', optionSize, 'Strike price:', strikePrice);
    
    const optionSizeWei = ethers.parseUnits(optionSize.toString(), 18);
    const strikePriceWei = ethers.parseUnits(strikePrice.toString(), 18);
    const premiumWei = ethers.parseUnits(premium.toString(), 18);
    
    // For put options, short deposits strike tokens (optionSize * strikePrice amount)
    const amountToApprove = (optionSizeWei * strikePriceWei) / ethers.parseUnits("1", 18);
    const tokenToApprove = strikeToken; // MTK
    
    console.log('Put option funding calculation:');
    console.log('Option size (wei):', optionSizeWei.toString());
    console.log('Strike price (wei):', strikePriceWei.toString());
    console.log('Amount to approve (wei):', amountToApprove.toString());
    
    // Create OptionsBook contract instance
    const optionsBookContract = new ethers.Contract(CONTRACT_ADDRESSES.OPTIONS_BOOK, OptionsBookABI, provider);
    
    // Prepare the create option transaction (user will approve separately)
    const createTxData = optionsBookContract.interface.encodeFunctionData('createAndFundPutOption', [
      userAddress,              // tokenHolder (user address)
      underlyingToken,
      strikeToken,
      underlyingSymbol,
      strikeSymbol,
      strikePriceWei,
      optionSizeWei,
      premiumWei,
      oracle
    ]);
    
    // Return separate approve and create transactions
    res.json({
      success: true,
      message: 'Put option creation transactions prepared (separate approve + create)',
      data: {
        // Transaction 1: Approve tokens
        approveTransaction: {
          to: tokenToApprove,
          data: new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']).encodeFunctionData('approve', [CONTRACT_ADDRESSES.OPTIONS_BOOK, amountToApprove]),
          value: '0x0',
          description: 'Approve OptionsBook to spend tokens'
        },
        // Transaction 2: Create option  
        createTransaction: {
          to: CONTRACT_ADDRESSES.OPTIONS_BOOK,
          data: createTxData,
          value: '0x0',
          description: 'Create and fund put option'
        },
        tokenToApprove: tokenToApprove,
        amountToApprove: amountToApprove.toString(),
        optionsBookAddress: CONTRACT_ADDRESSES.OPTIONS_BOOK
      }
    });
  } catch (error) {
    console.error('Error creating put option:', error);
    console.error('Error details:', error.message);
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
    
    // Detect contract type and use appropriate ABI
    const contractType = await detectContractType(contractAddress);
    const optionABI = contractType === 'call' ? CallOptionContractABI : PutOptionContractABI;
    const optionContract = new ethers.Contract(contractAddress, optionABI, provider);
    
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

// Enter as long using new TransactionBundler + OptionsBook architecture  
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
    
    // Detect contract type and use appropriate ABI
    const contractType = await detectContractType(contractAddress);
    const optionABI = contractType === 'call' ? CallOptionContractABI : PutOptionContractABI;
    const optionContract = new ethers.Contract(contractAddress, optionABI, provider);
    
    // Get contract details - for both call and put, premium is paid in strike token (MTK)
    const strikeToken = await optionContract.strikeToken();
    const premium = await optionContract.premium();
    
    console.log('Contract type:', contractType);
    console.log('Strike token (premium token):', strikeToken);
    console.log('Premium:', premium.toString());
    
    // Create OptionsBook contract instance
    const optionsBookContract = new ethers.Contract(CONTRACT_ADDRESSES.OPTIONS_BOOK, OptionsBookABI, provider);
    
    // Prepare the enter as long transaction (user will approve separately)
    const enterTxData = optionsBookContract.interface.encodeFunctionData('enterAndPayPremium', [
      contractAddress,                // optionContract
      strikeToken,                    // premiumToken (MTK for both call and put)
      premium                         // premiumAmount
    ]);
    
    // Return separate approve and enter transactions
    res.json({
      success: true,
      message: 'Enter as long transactions prepared (separate approve + enter)',
      data: {
        // Transaction 1: Approve premium tokens
        approveTransaction: {
          to: strikeToken,
          data: new ethers.Interface(['function approve(address spender, uint256 amount) returns (bool)']).encodeFunctionData('approve', [CONTRACT_ADDRESSES.OPTIONS_BOOK, premium]),
          value: '0x0',
          description: 'Approve OptionsBook to spend premium tokens'
        },
        // Transaction 2: Enter as long
        enterTransaction: {
          to: CONTRACT_ADDRESSES.OPTIONS_BOOK,
          data: enterTxData,
          value: '0x0',
          description: `Enter ${contractType} option as long`
        },
        contractType: contractType,
        premiumToken: strikeToken,
        premiumAmount: premium.toString(),
        optionsBookAddress: CONTRACT_ADDRESSES.OPTIONS_BOOK,
        optionContractAddress: contractAddress
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
    
    // Detect contract type and use appropriate ABI
    const contractType = await detectContractType(contractAddress);
    const optionABI = contractType === 'call' ? CallOptionContractABI : PutOptionContractABI;
    const optionContract = new ethers.Contract(contractAddress, optionABI, provider);
    
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
    console.log('Amount for exercise:', mtkAmount);
    
    // Detect contract type and use appropriate ABI
    const contractType = await detectContractType(contractAddress);
    const optionABI = contractType === 'call' ? CallOptionContractABI : PutOptionContractABI;
    const optionContract = new ethers.Contract(contractAddress, optionABI, provider);
    
    // Get contract details to determine strike token
    const strikeToken = await optionContract.strikeToken();
    
    // For call options: exercise with MTK amount (strike token)
    // For put options: exercise with 2TK amount (underlying token)
    let exerciseAmountWei, exerciseToken;
    
    if (contractType === 'call') {
      // Call option: spend MTK to get 2TK
      exerciseAmountWei = ethers.parseUnits(mtkAmount.toString(), 18);
      exerciseToken = strikeToken; // MTK
      console.log('Call option - MTK amount (wei):', exerciseAmountWei.toString());
    } else {
      // Put option: sell 2TK to get MTK  
      exerciseAmountWei = ethers.parseUnits(mtkAmount.toString(), 18);
      const underlyingToken = await optionContract.underlyingToken();
      exerciseToken = underlyingToken; // 2TK
      console.log('Put option - 2TK amount (wei):', exerciseAmountWei.toString());
    }
    
    console.log('Strike/underlying token:', exerciseToken);
    
    // Create MultiCall contract instance
    const multiCallContract = new ethers.Contract(ENTER_AND_APPROVE, OptionMultiCallABI, provider);
    
    // Prepare MultiCall transaction data for approveAndExercise
    const multiCallData = multiCallContract.interface.encodeFunctionData('approveAndExercise', [
      exerciseToken,
      contractAddress,
      exerciseAmountWei
    ]);
    
    // Return single transaction for the frontend to execute
    res.json({
      success: true,
      message: 'Single MultiCall exercise transaction prepared for MetaMask signing',
      data: {
        to: ENTER_AND_APPROVE,
        data: multiCallData,
        value: '0x0',
        description: `Approve ${contractType === 'call' ? 'MTK' : '2TK'} and exercise ${contractType} option (bundled)`
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

// 404 handler moved to end of file

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

// Debug endpoint to check transaction details
app.post('/api/admin/check-transaction', async (req, res) => {
  try {
    const { txHash } = req.body;
    
    if (!provider) {
      return res.status(500).json({ error: 'Provider not initialized' });
    }
    
    console.log('Checking transaction:', txHash);
    
    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    // If transaction failed, try to get failure reason
    let failureReason = null;
    if (receipt && receipt.status === 0) {
      try {
        // Try to simulate the transaction to get revert reason
        await provider.call(tx, tx.blockNumber);
      } catch (error) {
        failureReason = error.message;
      }
    }
    
    res.json({
      transaction: tx ? {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice?.toString(),
        data: tx.data,
        nonce: tx.nonce,
        blockNumber: tx.blockNumber
      } : null,
      receipt: receipt ? {
        status: receipt.status,
        contractAddress: receipt.contractAddress,
        gasUsed: receipt.gasUsed.toString(),
        logs: receipt.logs.length,
        failed: receipt.status === 0
      } : null,
      failureReason
    });
  } catch (error) {
    console.error('Error checking transaction:', error);
    res.status(500).json({ 
      error: 'Failed to check transaction',
      details: error.message 
    });
  }
});

// TEMPORARY SIMPLE CONTRACTS ROUTE FOR DEBUGGING
app.get('/api/contracts/simple', (req, res) => {
  console.log('SIMPLE CONTRACTS ROUTE HIT!');
  res.json({ contracts: [] });
});

// Get all contracts from OptionsBook factory
app.get('/api/contracts/all', async (req, res) => {
  console.log('GET /api/contracts/all - Request received');
  
  try {
    if (!provider) {
      return res.status(500).json({ error: 'Provider not initialized' });
    }
    
    // Create OptionsBook contract instance
    const optionsBook = new ethers.Contract(CONTRACT_ADDRESSES.OPTIONS_BOOK, OptionsBookABI, provider);
    
    // Get all put and call options from OptionsBook
    console.log('Fetching options from OptionsBook...');
    const [putOptions, callOptions] = await Promise.all([
      optionsBook.getAllPutOptions(),
      optionsBook.getAllCallOptions()
    ]);
    
    console.log(`Found ${putOptions.length} put options and ${callOptions.length} call options`);
    
    // Fetch details for each option contract
    const allOptions = [];
    
    // Process put options
    for (const putAddress of putOptions) {
      try {
        const putContract = new ethers.Contract(putAddress, PutOptionContractABI, provider);
        const [
          short, long, underlyingToken, strikeToken, underlyingSymbol, strikeSymbol,
          strikePrice, optionSize, premium, expiry, isFilled, isExercised, isFunded,
          oracle, priceAtExpiry, isResolved, exercisedVolume
        ] = await Promise.all([
          putContract.short(), putContract.long(), putContract.underlyingToken(),
          putContract.strikeToken(), putContract.underlyingSymbol(), putContract.strikeSymbol(),
          putContract.strikePrice(), putContract.optionSize(), putContract.premium(),
          putContract.expiry(), putContract.isFilled(), putContract.isExercised(),
          putContract.isFunded(), putContract.oracle(), putContract.priceAtExpiry(),
          putContract.isResolved(), putContract.exercisedVolume()
        ]);
        
        allOptions.push({
          address: putAddress,
          contractType: 'put',
          short, long, underlyingToken, strikeToken, underlyingSymbol, strikeSymbol,
          strikePrice: strikePrice.toString(), optionSize: optionSize.toString(),
          premium: premium.toString(), expiry: expiry.toString(),
          isFilled, isExercised, isFunded, oracle,
          priceAtExpiry: priceAtExpiry.toString(), isResolved,
          exercisedVolume: exercisedVolume.toString()
        });
      } catch (error) {
        console.error(`Error fetching put option ${putAddress}:`, error.message);
      }
    }
    
    // Process call options
    for (const callAddress of callOptions) {
      try {
        const callContract = new ethers.Contract(callAddress, CallOptionContractABI, provider);
        const [
          short, long, underlyingToken, strikeToken, underlyingSymbol, strikeSymbol,
          strikePrice, optionSize, premium, expiry, isFilled, isExercised, isFunded,
          oracle, priceAtExpiry, isResolved, exercisedVolume
        ] = await Promise.all([
          callContract.short(), callContract.long(), callContract.underlyingToken(),
          callContract.strikeToken(), callContract.underlyingSymbol(), callContract.strikeSymbol(),
          callContract.strikePrice(), callContract.optionSize(), callContract.premium(),
          callContract.expiry(), callContract.isFilled(), callContract.isExercised(),
          callContract.isFunded(), callContract.oracle(), callContract.priceAtExpiry(),
          callContract.isResolved(), callContract.exercisedVolume()
        ]);
        
        allOptions.push({
          address: callAddress,
          contractType: 'call', 
          short, long, underlyingToken, strikeToken, underlyingSymbol, strikeSymbol,
          strikePrice: strikePrice.toString(), optionSize: optionSize.toString(),
          premium: premium.toString(), expiry: expiry.toString(),
          isFilled, isExercised, isFunded, oracle,
          priceAtExpiry: priceAtExpiry.toString(), isResolved,
          exercisedVolume: exercisedVolume.toString()
        });
      } catch (error) {
        console.error(`Error fetching call option ${callAddress}:`, error.message);
      }
    }
    
    res.json({ contracts: allOptions });
  } catch (error) {
    console.error('Error fetching contracts from OptionsBook:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contracts',
      details: error.message 
    });
  }
});

// Debug endpoint to check contract status
app.get('/api/debug/contracts', async (req, res) => {
  try {
    if (!provider) {
      return res.status(500).json({ error: 'Provider not initialized' });
    }

    const results = {};
    
    // Check each contract
    for (const [name, address] of Object.entries(CONTRACT_ADDRESSES)) {
      try {
        const code = await provider.getCode(address);
        results[name] = {
          address,
          exists: code !== '0x',
          codeLength: code.length
        };
      } catch (error) {
        results[name] = {
          address,
          exists: false,
          error: error.message
        };
      }
    }

    res.json({ success: true, contracts: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: List all registered routes
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log('Registered route:', r.route.path, Object.keys(r.route.methods));
  }
});

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
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