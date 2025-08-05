const { ethers } = require('ethers');
const ContractDatabase = require('./database');

class ResolutionService {
  constructor(provider) {
    this.provider = provider;
    this.signer = null;
    this.db = new ContractDatabase();
    this.activeTimers = new Map(); // contractAddress -> timerId
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const resolutionEnabled = process.env.RESOLUTION_ENABLED === 'true';
      const privateKey = process.env.PRIVATE_KEY;
      
      if (!resolutionEnabled) {
        console.log('Resolution service disabled by configuration');
        return false;
      }
      
      if (!privateKey || !this.provider) {
        console.log('Resolution service disabled: No private key or provider');
        return false;
      }
      
      this.signer = new ethers.Wallet(privateKey, this.provider);
      console.log('Resolution service initialized with address:', this.signer.address);
      
      // Restore active timers from database on startup
      await this.restoreActiveTimers();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize resolution service:', error);
      return false;
    }
  }

  // Restore timers for existing active contracts on startup
  async restoreActiveTimers() {
    try {
      const activeContracts = await this.db.getActiveContracts();
      console.log(`Restoring timers for ${activeContracts.length} active contracts`);
      
      for (const contract of activeContracts) {
        const timeUntilExpiry = contract.expiry - Math.floor(Date.now() / 1000);
        
        if (timeUntilExpiry > 0) {
          // Contract not yet expired, set timer
          this.scheduleResolution(contract.address, contract.expiry);
          console.log(`⏰ Timer restored for ${contract.address}, expires in ${Math.round(timeUntilExpiry/60)} minutes`);
        } else {
          // Contract already expired, resolve immediately
          console.log(`🚨 Contract ${contract.address} already expired, resolving immediately`);
          await this.resolveContract(contract.address);
        }
      }
    } catch (error) {
      console.error('Error restoring active timers:', error);
    }
  }

  // Add a new contract to tracking
  async addContract(contractData) {
    try {
      await this.db.addContract(contractData);
      await this.db.addEvent(contractData.address, 'CONTRACT_CREATED', {
        transactionHash: contractData.transactionHash
      });
      console.log(`📝 Contract ${contractData.address} added to database`);
    } catch (error) {
      console.error('Error adding contract to database:', error);
    }
  }

  // Handle contract funding event
  async handleFunded(contractAddress, transactionHash) {
    try {
      await this.db.updateContract(contractAddress, {
        is_funded: 1,
        funded_at: new Date().toISOString(),
        status: 'funded'
      });
      
      await this.db.addEvent(contractAddress, 'CONTRACT_FUNDED', {
        transactionHash: transactionHash
      });
      
      console.log(`💰 Contract ${contractAddress} funded`);
    } catch (error) {
      console.error('Error handling funded event:', error);
    }
  }

  // Handle long position entry - THIS IS THE KEY TRIGGER
  async handleLongEntry(contractAddress, longAddress, expiry, transactionHash) {
    try {
      await this.db.updateContract(contractAddress, {
        long_address: longAddress,
        is_filled: 1,
        expiry: expiry,
        filled_at: new Date().toISOString(),
        status: 'filled'
      });
      
      await this.db.addEvent(contractAddress, 'LONG_ENTERED', {
        transactionHash: transactionHash,
        longAddress: longAddress,
        expiry: expiry
      });
      
      // NOW SET THE RESOLUTION TIMER
      this.scheduleResolution(contractAddress, expiry);
      
      console.log(`🎯 Long entered for ${contractAddress}, resolution scheduled for ${new Date(expiry * 1000).toLocaleString()}`);
    } catch (error) {
      console.error('Error handling long entry:', error);
    }
  }

  // Schedule resolution at exact expiry time
  scheduleResolution(contractAddress, expiryTimestamp) {
    // Clear existing timer if any
    if (this.activeTimers.has(contractAddress)) {
      clearTimeout(this.activeTimers.get(contractAddress));
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiryTimestamp - now;

    if (timeUntilExpiry <= 0) {
      // Already expired, resolve immediately
      setImmediate(() => this.resolveContract(contractAddress));
      return;
    }

    // Set timer for exact expiry
    const timerId = setTimeout(async () => {
      await this.resolveContract(contractAddress);
      this.activeTimers.delete(contractAddress);
    }, timeUntilExpiry * 1000);

    this.activeTimers.set(contractAddress, timerId);
    
    console.log(`⏰ Resolution timer set for ${contractAddress} in ${Math.round(timeUntilExpiry/60)} minutes`);
  }

  // Resolve a specific contract
  async resolveContract(contractAddress) {
    if (!this.signer) {
      console.error('Resolution service not initialized');
      return;
    }

    try {
      console.log(`🔄 Resolving contract: ${contractAddress}`);
      
      // Load contract ABI
      const OptionContractABI = require('../contract-utils/OptionContractABI.json');
      const optionContract = new ethers.Contract(contractAddress, OptionContractABI, this.signer);
      
      // Double-check contract state before resolving
      const [isActive, isResolved, isExercised] = await Promise.all([
        optionContract.isActive(),
        optionContract.isResolved(),
        optionContract.isExercised()
      ]);

      if (!isActive) {
        console.log(`⚠️ Contract ${contractAddress} not filled, skipping resolution`);
        return;
      }

      if (isResolved) {
        console.log(`⚠️ Contract ${contractAddress} already resolved`);
        await this.db.updateContract(contractAddress, {
          is_resolved: 1,
          status: 'resolved'
        });
        return;
      }

      if (isExercised) {
        console.log(`⚠️ Contract ${contractAddress} already exercised`);  
        await this.db.updateContract(contractAddress, {
          is_exercised: 1,
          status: 'exercised'
        });
        return;
      }

      // Execute resolution
      const tx = await optionContract.resolve();
      console.log(`📡 Resolution transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Contract ${contractAddress} resolved successfully! Gas used: ${receipt.gasUsed.toString()}`);
      
      // Update database
      await this.db.updateContract(contractAddress, {
        is_resolved: 1,
        resolved_at: new Date().toISOString(),
        status: 'resolved'
      });
      
      await this.db.addEvent(contractAddress, 'CONTRACT_RESOLVED', {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      });

      // Clean up timer
      if (this.activeTimers.has(contractAddress)) {
        this.activeTimers.delete(contractAddress);
      }

    } catch (error) {
      console.error(`❌ Error resolving contract ${contractAddress}:`, error.message);
      
      // If contract has issues, mark it in database
      await this.db.addEvent(contractAddress, 'RESOLUTION_FAILED', {
        error: error.message
      });
    }
  }

  // Handle exercise event
  async handleExercise(contractAddress, transactionHash) {
    try {
      await this.db.updateContract(contractAddress, {
        is_exercised: 1,
        exercised_at: new Date().toISOString(),
        status: 'exercised'
      });
      
      await this.db.addEvent(contractAddress, 'CONTRACT_EXERCISED', {
        transactionHash: transactionHash
      });
      
      // Clear any pending resolution timer
      if (this.activeTimers.has(contractAddress)) {
        clearTimeout(this.activeTimers.get(contractAddress));
        this.activeTimers.delete(contractAddress);
      }
      
      console.log(`💪 Contract ${contractAddress} exercised`);
    } catch (error) {
      console.error('Error handling exercise event:', error);
    }
  }

  // Manual resolution trigger
  async resolveExpiredContracts() {
    try {
      const expiredContracts = await this.db.getExpiredContracts();
      console.log(`Found ${expiredContracts.length} expired contracts to resolve`);
      
      for (const contract of expiredContracts) {
        await this.resolveContract(contract.address);
      }
      
      return expiredContracts.length;
    } catch (error) {
      console.error('Error resolving expired contracts:', error);
      return 0;
    }
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.isInitialized,
      signerAddress: this.signer?.address,
      activeTimers: this.activeTimers.size,
      timerDetails: Array.from(this.activeTimers.keys())
    };
  }

  // Cleanup on shutdown
  async shutdown() {
    console.log('Shutting down resolution service...');
    
    // Clear all active timers
    for (const timerId of this.activeTimers.values()) {
      clearTimeout(timerId);
    }
    this.activeTimers.clear();
    
    // Close database
    await this.db.close();
    
    console.log('Resolution service shutdown complete');
  }
}

module.exports = ResolutionService;