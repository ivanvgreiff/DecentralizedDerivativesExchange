import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useWallet } from '../context/WalletContext';
import { Plus, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';

const CreateContainer = styled.div`
  color: white;
  max-width: 800px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
`;

const Form = styled.form`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
  
  option {
    background: #2a2a2a;
    color: white;
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const InfoBox = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-left: 4px solid #667eea;
`;

const SuccessBox = styled.div`
  background: rgba(34, 197, 94, 0.1);
  border: 2px solid rgba(34, 197, 94, 0.3);
  border-radius: 16px;
  padding: 2rem;
  margin: 2rem 0;
  text-align: center;
`;

const SuccessTitle = styled.h3`
  color: #22c55e;
  margin-bottom: 1rem;
  font-size: 1.5rem;
`;

const CopyableField = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  word-break: break-all;
`;

const CopyButton = styled.button`
  background: #22c55e;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  margin-left: 1rem;
  flex-shrink: 0;
  
  &:hover {
    background: #16a34a;
  }
`;

const NavigateButton = styled(Button)`
  margin-top: 1rem !important;
`;

const TokenInfo = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const CreateOption = () => {
  const navigate = useNavigate();
  const { account, sendTransaction } = useWallet();
  const [formData, setFormData] = useState({
    underlyingToken: '',
    strikeToken: '',
    underlyingSymbol: '',
    strikeSymbol: '',
    strikePrice: '',
    optionSize: '',
    premium: '',
    oracle: ''
  });
  const [optionType, setOptionType] = useState('call'); // 'call' or 'put'
  const [payoffType, setPayoffType] = useState('Linear'); // 'Linear', 'Quadratic', 'Logarithmic'
  const [isCreating, setIsCreating] = useState(false);
  const [contractDeploymentInfo, setContractDeploymentInfo] = useState(null);

  // Fetch oracle prices for token selection
  const { data: oraclePrices } = useQuery('oraclePrices', async () => {
    const response = await axios.get('/api/oracle/prices');
    return response.data;
  }, {
    enabled: false // Don't auto-fetch on page load
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    console.log('Wallet address:', account);
    console.log('Network info from MetaMask:', window.ethereum?.networkVersion);
    console.log('Option parameters:', {
      optionType,
      underlyingToken: formData.underlyingToken,
      strikeToken: formData.strikeToken,
      optionSize: formData.optionSize,
      oracle: formData.oracle
    });

    setIsCreating(true);
    
    // Show initial loading message
    const loadingToast = toast.loading('Preparing transactions...');
    
    try {
      // Step 1: Get transaction data from backend
      const requestData = {
        ...formData,
        userAddress: account,
        payoffType: payoffType
      };
      const endpoint = optionType === 'call' ? '/api/option/create-call' : '/api/option/create-put';
      const response = await axios.post(endpoint, requestData);
      
      // Check if backend detected transaction would fail
      if (!response.data.success) {
        const errorMsg = response.data.details || response.data.error || 'Unknown error';
        toast.dismiss(loadingToast);
        toast.error(`Contract Error: ${errorMsg}`);
        return;
      }
      
      if (response.data.success && response.data.data) {
        const { approveTransaction, createTransaction, tokenToApprove, amountToApprove, optionsBookAddress } = response.data.data;
        
        // Step 2: Check current allowance
        toast.dismiss(loadingToast);
        toast.loading('Checking token allowance...');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const tokenContract = new ethers.Contract(
          tokenToApprove,
          ['function allowance(address owner, address spender) view returns (uint256)'],
          provider
        );
        
        const currentAllowance = await tokenContract.allowance(account, optionsBookAddress);
        const requiredAmount = ethers.getBigInt(amountToApprove);
        
        console.log('Current allowance:', ethers.formatUnits(currentAllowance, 18));
        console.log('Required amount:', ethers.formatUnits(requiredAmount, 18));
        
        // Step 3: Send separate approval transaction if needed (force for testing new contract)
        if (currentAllowance < requiredAmount || true) {
          toast.dismiss();
          toast.loading('Please approve token spending... (Transaction 1/2)');
          
          console.log('Sending approval transaction:', approveTransaction);
          const approveTx = await sendTransaction(approveTransaction);
          
          if (approveTx) {
            toast.loading('Waiting for approval confirmation... (Transaction 1/2)');
            await approveTx.wait();
            toast.success('✅ Token approval confirmed!');
          } else {
            throw new Error('Approval transaction failed');
          }
        } else {
          toast.success('✅ Token already approved!');
        }
        
        // Step 4: Send separate option creation transaction
        toast.loading('Please confirm option creation... (Transaction 2/2)');
        
        console.log('Sending option creation transaction:', createTransaction);
        console.log('🔍 DEBUG: Transaction details:');
        console.log('  - To:', createTransaction.to);
        console.log('  - Data length:', createTransaction.data.length);
        console.log('  - Gas estimation...');
        
        // Try to estimate gas first to get better error info
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const gasEstimate = await provider.estimateGas({
            to: createTransaction.to,
            data: createTransaction.data,
            from: account
          });
          console.log('✅ Gas estimate successful:', gasEstimate.toString());
        } catch (gasError) {
          console.error('❌ Gas estimation failed:', gasError);
          console.error('❌ Gas error details:', {
            code: gasError.code,
            reason: gasError.reason,
            data: gasError.data,
            transaction: gasError.transaction
          });
          
          // Try to decode the error
          if (gasError.data) {
            console.error('❌ Raw error data:', gasError.data);
          }
          
          throw new Error(`Gas estimation failed: ${gasError.reason || gasError.message}`);
        }
        
        const tx = await sendTransaction(createTransaction);
        
        if (tx) {
          toast.loading('Waiting for option creation confirmation...');
          
          // Wait for confirmation
          const receipt = await tx.wait();
          const deployTxHash = tx.hash;
          
          toast.success('Option created successfully!');
          
          // Extract contract address from the transaction logs
          // OptionsBook factory emits OptionCreated event with the new contract address
          let contractAddress = null;
          try {
            console.log('Extracting contract address from transaction receipt...');
            
            // Look for OptionCreated event in the logs
            const optionCreatedLog = receipt.logs.find(log => {
              // OptionsBook OptionCreated event has 3 topics: event signature, creator, instance
              return log.topics && log.topics.length === 3;
            });
            
            if (optionCreatedLog) {
              // The contract address is the second indexed parameter (topics[2])
              contractAddress = ethers.getAddress('0x' + optionCreatedLog.topics[2].slice(26));
              console.log('✅ Extracted contract address from logs:', contractAddress);
            }
          } catch (error) {
            console.warn('Failed to extract contract address from logs:', error);
          }
          
          // Auto-register the contract in the database
          if (contractAddress && ethers.isAddress(contractAddress)) {
            try {
              console.log('Auto-registering contract in database...');
              await axios.post('/api/contracts/auto-register', {
                transactionHash: deployTxHash,
                contractAddress: contractAddress,
                optionType: optionType,
                shortAddress: account,
                underlyingToken: formData.underlyingToken,
                strikeToken: formData.strikeToken,
                underlyingSymbol: formData.underlyingSymbol,
                strikeSymbol: formData.strikeSymbol,
                strikePrice: formData.strikePrice,
                optionSize: formData.optionSize,
                premium: formData.premium,
                oracle: formData.oracle
              });
              console.log('✅ Contract auto-registered successfully');
            } catch (error) {
              console.warn('Failed to auto-register contract:', error);
            }
          }
          
          // Fallback: use transaction hash if we can't get the contract address
          if (!contractAddress) {
            contractAddress = `Transaction: ${deployTxHash.substring(0, 10)}...`;
          }
          
        toast.success(`${optionType === 'call' ? 'Call' : 'Put'} option contract deployed at: ${contractAddress}`);
        console.log('Deploy transaction hash:', deployTxHash);
        console.log('Contract address:', contractAddress);
        
        // Show success message - no auto-navigation
        setContractDeploymentInfo({
          txHash: deployTxHash,
          contractAddress: contractAddress
        });
        
        // Reset form
        setFormData({
          underlyingToken: '',
          strikeToken: '',
          underlyingSymbol: '',
          strikeSymbol: '',
          strikePrice: '',
          optionSize: '',
          premium: '',
          oracle: ''
        });
        }
      }
    } catch (error) {
      console.error('Error creating option:', error);
      
      // Dismiss any loading toasts
      toast.dismiss();
      
      // Handle specific error types
      let errorMessage = 'Failed to create option contract';
      
      if (error.code === 4001) {
        errorMessage = 'Transaction cancelled by user';
      } else if (error.message && error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (error.message && error.message.includes('missing revert data')) {
        errorMessage = `Transaction failed - likely insufficient tokens. For ${optionType} options, you need ${formData.optionSize} ${optionType === 'call' ? formData.underlyingSymbol : formData.strikeSymbol} tokens in your wallet.`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  if (!account) {
    return (
      <CreateContainer>
        <Title>Create Option</Title>
        <InfoBox>
          <AlertTriangle size={20} style={{ marginBottom: '0.5rem' }} />
          <p>Please connect your wallet to create options</p>
        </InfoBox>
      </CreateContainer>
    );
  }

  return (
    <CreateContainer>
      <Title>
        <Plus size={32} style={{ marginRight: '0.5rem' }} />
        Create New {payoffType} {optionType === 'call' ? 'Call' : 'Put'} Option
      </Title>

      <InfoBox>
        <DollarSign size={20} style={{ marginBottom: '0.5rem' }} />
        <p><strong>Two-Transaction Process:</strong> First you'll approve token spending, then create the option contract. You'll see 2 separate MetaMask popups.</p>
      </InfoBox>

      <Form onSubmit={handleSubmit}>
        <InfoBox>
          <h3>Option Details</h3>
          <p>Create a new {optionType === 'call' ? 'call' : 'put'} options contract for trading</p>
          {optionType === 'call' ? (
            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
              <p>Call Option: Long can buy 2TK at strike price using MTK</p>
              <p style={{ color: '#fbbf24', marginTop: '0.5rem' }}>
                ⚠️ You need {formData.optionSize || 'X'} 2TK tokens in your wallet to create this option
              </p>
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
              <p>Put Option: Long can sell 2TK at strike price for MTK</p>
              <p style={{ color: '#fbbf24', marginTop: '0.5rem' }}>
                ⚠️ You need {formData.optionSize || 'X'} 2TK tokens in your wallet to create this option
              </p>
            </div>
          )}
        </InfoBox>

        <FormGroup>
          <Label>Option Type</Label>
          <Select
            value={optionType}
            onChange={(e) => setOptionType(e.target.value)}
            required
          >
            <option value="call">Call Option</option>
            <option value="put">Put Option</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Payoff Type</Label>
          <Select
            value={payoffType}
            onChange={(e) => setPayoffType(e.target.value)}
            required
          >
            <option value="Linear">Linear</option>
            <option value="Quadratic">Quadratic</option>
            <option value="Logarithmic">Logarithmic</option>
          </Select>
        </FormGroup>

        <TokenInfo>
          <FormGroup>
            <Label>Underlying Token Address</Label>
            <Input
              type="text"
              name="underlyingToken"
              value={formData.underlyingToken}
              onChange={handleInputChange}
              placeholder="0x..."
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Strike Token Address</Label>
            <Input
              type="text"
              name="strikeToken"
              value={formData.strikeToken}
              onChange={handleInputChange}
              placeholder="0x..."
              required
            />
          </FormGroup>
        </TokenInfo>

        <TokenInfo>
          <FormGroup>
            <Label>Underlying Symbol</Label>
            <Input
              type="text"
              name="underlyingSymbol"
              value={formData.underlyingSymbol}
              onChange={handleInputChange}
              placeholder="2TK"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Strike Symbol</Label>
            <Input
              type="text"
              name="strikeSymbol"
              value={formData.strikeSymbol}
              onChange={handleInputChange}
              placeholder="MTK"
              required
            />
          </FormGroup>
        </TokenInfo>

        <FormGroup>
          <Label>Strike Price (in MTK per 2TK)</Label>
          <Input
            type="number"
            name="strikePrice"
            value={formData.strikePrice}
            onChange={handleInputChange}
            placeholder="1.5"
            step="0.01"
            min="0"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label>Option Size (amount of 2TK tokens)</Label>
          <Input
            type="number"
            name="optionSize"
            value={formData.optionSize}
            onChange={handleInputChange}
            placeholder="100"
            min="0"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label>Premium (amount of MTK tokens)</Label>
          <Input
            type="number"
            name="premium"
            value={formData.premium}
            onChange={handleInputChange}
            placeholder="50"
            min="0"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label>Oracle Address</Label>
          <Input
            type="text"
            name="oracle"
            value={formData.oracle}
            onChange={handleInputChange}
            placeholder="0x..."
            required
          />
        </FormGroup>

        <Button type="submit" disabled={isCreating}>
          {isCreating ? 'Processing...' : `Create ${optionType === 'call' ? 'Call' : 'Put'} Option (2 Transactions)`}
        </Button>
      </Form>

      {contractDeploymentInfo && (
        <SuccessBox>
          <SuccessTitle>✅ {optionType === 'call' ? 'Call' : 'Put'} Option Contract Created Successfully!</SuccessTitle>
          
          <CopyableField>
            <div>
              <strong>Transaction Hash:</strong><br />
              {contractDeploymentInfo.txHash}
            </div>
            <CopyButton onClick={() => copyToClipboard(contractDeploymentInfo.txHash)}>
              Copy
            </CopyButton>
          </CopyableField>
          
          <CopyableField>
            <div>
              <strong>Contract Address:</strong><br />
              {contractDeploymentInfo.contractAddress}
            </div>
            <CopyButton onClick={() => copyToClipboard(contractDeploymentInfo.contractAddress)}>
              Copy
            </CopyButton>
          </CopyableField>
          
          <p style={{ margin: '1rem 0', opacity: 0.9 }}>
            You can now:<br />
            1. Fund the contract (as the short seller)<br />
            2. Have someone enter as long position
          </p>
          
          <NavigateButton 
            className="primary" 
            onClick={() => navigate(`/option/${contractDeploymentInfo.contractAddress}`)}
          >
            View Contract Details
          </NavigateButton>
          
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '1rem' }}>
            Click the button above when ready to manage your contract
          </p>
        </SuccessBox>
      )}

      {oraclePrices?.prices && (
        <InfoBox style={{ marginTop: '2rem' }}>
          <h3>Available Tokens</h3>
          <p>Current tokens in the oracle:</p>
          <ul>
            {oraclePrices.prices.map((price, index) => (
              <li key={index}>
                {price.symbol}: {price.realPrice} (Address: {price.tokenAddress})
              </li>
            ))}
          </ul>
        </InfoBox>
      )}
    </CreateContainer>
  );
};

export default CreateOption; 