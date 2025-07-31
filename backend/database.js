const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ContractDatabase {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = path.join(__dirname, 'contracts.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    const createContractsTable = `
      CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT UNIQUE NOT NULL,
        short_address TEXT NOT NULL,
        long_address TEXT,
        underlying_token TEXT NOT NULL,
        strike_token TEXT NOT NULL,
        underlying_symbol TEXT NOT NULL,
        strike_symbol TEXT NOT NULL,
        strike_price TEXT NOT NULL,
        option_size TEXT NOT NULL,
        premium TEXT NOT NULL,
        oracle_address TEXT NOT NULL,
        expiry INTEGER,
        status TEXT DEFAULT 'created',
        is_funded BOOLEAN DEFAULT 0,
        is_filled BOOLEAN DEFAULT 0,
        is_resolved BOOLEAN DEFAULT 0,
        is_exercised BOOLEAN DEFAULT 0,
        price_at_expiry TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        funded_at DATETIME,
        filled_at DATETIME,
        resolved_at DATETIME,
        exercised_at DATETIME,
        timer_id TEXT
      )
    `;

    const createEventsTable = `
      CREATE TABLE IF NOT EXISTS contract_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_address TEXT NOT NULL,
        event_type TEXT NOT NULL,
        transaction_hash TEXT,
        block_number INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT,
        FOREIGN KEY (contract_address) REFERENCES contracts (address)
      )
    `;

    this.db.run(createContractsTable, (err) => {
      if (err) {
        console.error('Error creating contracts table:', err);
      } else {
        console.log('Contracts table ready');
      }
    });

    this.db.run(createEventsTable, (err) => {
      if (err) {
        console.error('Error creating events table:', err);
      } else {
        console.log('Events table ready');
      }
    });
  }

  // Add new contract
  addContract(contractData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO contracts (
          address, short_address, underlying_token, strike_token,
          underlying_symbol, strike_symbol, strike_price, option_size,
          premium, oracle_address, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
      `;
      
      const params = [
        contractData.address,
        contractData.short_address,
        contractData.underlying_token,
        contractData.strike_token,
        contractData.underlying_symbol,
        contractData.strike_symbol,
        contractData.strike_price,
        contractData.option_size,
        contractData.premium,
        contractData.oracle_address
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Update contract status
  updateContract(address, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(address);

      const sql = `UPDATE contracts SET ${fields} WHERE address = ?`;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Get contract by address
  getContract(address) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM contracts WHERE address = ?';
      
      this.db.get(sql, [address], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get all active contracts (filled but not resolved/exercised)
  getActiveContracts() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM contracts 
        WHERE is_filled = 1 
        AND is_resolved = 0 
        AND is_exercised = 0
        AND expiry IS NOT NULL
      `;
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get contracts ready for resolution (expired but not resolved)
  getExpiredContracts() {
    return new Promise((resolve, reject) => {
      const now = Math.floor(Date.now() / 1000);
      const sql = `
        SELECT * FROM contracts 
        WHERE is_filled = 1 
        AND is_resolved = 0 
        AND is_exercised = 0
        AND expiry IS NOT NULL
        AND expiry <= ?
      `;
      
      this.db.all(sql, [now], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Add event log
  addEvent(contractAddress, eventType, data = {}) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO contract_events (
          contract_address, event_type, transaction_hash, 
          block_number, data
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      const params = [
        contractAddress,
        eventType,
        data.transactionHash || null,
        data.blockNumber || null,
        JSON.stringify(data)
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Get all contracts
  getAllContracts() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM contracts ORDER BY created_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
        resolve();
      });
    });
  }
}

module.exports = ContractDatabase;