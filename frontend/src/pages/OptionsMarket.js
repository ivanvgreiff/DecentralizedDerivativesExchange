import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { useWallet } from '../context/WalletContext';
import { TrendingUp, DollarSign, Clock, Eye, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';

const MarketContainer = styled.div`
  color: white;
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
`;

const OptionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
`;

const OptionCard = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
  }
`;

const OptionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const OptionTitle = styled.h3`
  font-size: 1.2rem;
  margin: 0;
`;

const OptionStatus = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  
  &.funded {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  &.filled {
    background: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }
  
  &.expired {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }
  
  &.exercised {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }
  
  &.reclaimed {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  
  &.not-engaged {
    background: rgba(147, 197, 253, 0.3);
    color: #93c5fd;
  }
`;

const OptionDetails = styled.div`
  margin-bottom: 1rem;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailLabel = styled.span`
  opacity: 0.8;
  font-size: 0.9rem;
`;

const DetailValue = styled.span`
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const Button = styled.button`
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }
  
  &.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const FilterSection = styled.div`
  margin-bottom: 2rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
`;

const FilterButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: ${props => props.active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const OptionsMarket = () => {
  const { account, sendTransaction } = useWallet();
  const [filter, setFilter] = useState('all');
  const [selectedOption, setSelectedOption] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const navigate = useNavigate();

  // Update current time every second for real-time countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format token amounts - handles both wei values and simple numbers from database
  const formatTokenAmount = (amount, symbol) => {
    if (!amount) return `0 ${symbol}`;
    
    const numValue = parseFloat(amount);
    
    // If the number is very large (> 1000), assume it's in wei format
    if (numValue >= 1000) {
      try {
        // eslint-disable-next-line no-undef
        const weiAmount = BigInt(amount);
        const etherAmount = Number(weiAmount) / Math.pow(10, 18);
        const formatted = etherAmount.toFixed(6).replace(/\.?0+$/, '');
        return `${formatted} ${symbol}`;
      } catch (error) {
        // If BigInt conversion fails, try parsing as scientific notation
        if (typeof amount === 'string' && amount.includes('e')) {
          const etherAmount = numValue / Math.pow(10, 18);
          const formatted = etherAmount.toFixed(6).replace(/\.?0+$/, '');
          return `${formatted} ${symbol}`;
        }
      }
    }
    
    // For small numbers (database values), use as-is
    const formatted = numValue.toFixed(6).replace(/\.?0+$/, '');
    return `${formatted} ${symbol}`;
  };

  // Format expiry display with real-time countdown
  const formatExpiry = (option) => {
    if (!option.expiry) return 'Not set';
    
    // If option is not yet engaged (not funded or not active), show activation message
    if (!option.isFunded || !option.isActive) {
      return '5 minutes upon activation';
    }
    
    // If option is engaged, show countdown or expiry date
    const expiryTime = option.expiry * 1000; // Convert to milliseconds
    const timeRemaining = expiryTime - currentTime;
    
    // If expired or exercised, show actual expiry date
    if (timeRemaining <= 0 || option.isExercised) {
      const expiryDate = new Date(expiryTime);
      return `${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    // Calculate countdown for active options
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
  };

  // Fetch options from current OptionsBook factory (on-chain source of truth)
  const { data: optionsData, isLoading } = useQuery(
    'options',
    async () => {
      const response = await axios.get('/api/factory/all-contracts');
      return response.data.contracts || [];
    },
    {
      refetchInterval: 120000, // Refetch every 2 minutes instead of 1  
      staleTime: 60000, // Stale time set to 60 seconds
      retry: 1, // Only retry once
      retryDelay: 10000 // 10 second delay between retries
    }
  );

  const options = optionsData || [];

  const filteredOptions = options.filter(option => {
    if (filter === 'all') return true;
    if (filter === 'available' && !option.isActive) return true;
    if (filter === 'filled' && option.isActive) return true;
    if (filter === 'expired' && option.expiry && option.expiry * 1000 < currentTime) return true;
    return false;
  });

  const getStatus = (option) => {
    if (option.isExercised) return { text: 'Exercised', class: 'exercised' };
    
    // Check if option is not engaged (not funded or not active)
    if (!option.isFunded || !option.isActive) {
      return { text: 'Not Engaged', class: 'not-engaged' };
    }
    
    // Check if expired but not resolved (only if option is engaged)
    if (option.expiry && option.expiry * 1000 < currentTime && !option.isResolved) {
      return { text: 'Unresolved', class: 'expired' };
    }
    
    // Check if expired and resolved but not exercised (means it was reclaimed)
    if (option.expiry && option.expiry * 1000 < currentTime && option.isResolved && !option.isExercised) {
      return { text: 'Reclaimed', class: 'reclaimed' };
    }
    
    if (option.isActive) return { text: 'Active', class: 'filled' };
    if (option.isFunded) return { text: 'Funded', class: 'funded' };
    return { text: 'Created', class: 'funded' };
  };

  const handleFund = async (contractAddress) => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const response = await axios.post(`/api/option/${contractAddress}/fund`);
      
      if (response.data.success) {
        const tx = await sendTransaction(response.data.data);
        if (tx) {
          toast.success('Option funded successfully!');
        }
      }
    } catch (error) {
      console.error('Error funding option:', error);
      toast.error('Failed to fund option');
    }
  };

  const handleEnter = async (contractAddress) => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Show initial loading message
    const loadingToast = toast.loading('Preparing enter as long transactions...');

    try {
      console.log('Attempting to enter option with contract address:', contractAddress);
      const response = await axios.post(`/api/option/${contractAddress}/enter`);
      console.log('Enter response:', response.data);
      
      if (response.data.success && response.data.data) {
        const { approveTransaction, enterTransaction, premiumToken, premiumAmount, optionsBookAddress } = response.data.data;
        
        // Step 1: Check current allowance
        toast.dismiss(loadingToast);
        toast.loading('Checking premium token allowance...');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const tokenContract = new ethers.Contract(
          premiumToken,
          ['function allowance(address owner, address spender) view returns (uint256)'],
          provider
        );
        
        const currentAllowance = await tokenContract.allowance(account, optionsBookAddress);
        const requiredAmount = ethers.getBigInt(premiumAmount);
        
        console.log('Current allowance:', ethers.formatUnits(currentAllowance, 18));
        console.log('Required premium:', ethers.formatUnits(requiredAmount, 18));
        
        // Step 2: Send separate approval transaction if needed
        if (currentAllowance < requiredAmount) {
          toast.dismiss();
          toast.loading('Please approve premium token spending... (Transaction 1/2)');
          
          console.log('Sending approval transaction:', approveTransaction);
          const approveTx = await sendTransaction(approveTransaction);
          
          if (approveTx) {
            toast.loading('Waiting for approval confirmation... (Transaction 1/2)');
            await approveTx.wait();
            toast.success('✅ Premium token approval confirmed!');
          } else {
            throw new Error('Premium approval transaction failed');
          }
        } else {
          toast.success('✅ Premium tokens already approved!');
        }
        
        // Step 3: Send separate enter as long transaction
        toast.loading('Please confirm entering as long... (Transaction 2/2)');
        
        console.log('Sending enter as long transaction:', enterTransaction);
        const tx = await sendTransaction(enterTransaction);
        
        if (tx) {
          toast.loading('Waiting for enter as long confirmation...');
          
          // Wait for confirmation
          await tx.wait();
          
          toast.success('Entered as long successfully!');
          
          // Notify backend about long entry event
          try {
            await axios.post(`/api/contracts/${contractAddress}/long-entered`, {
              longAddress: account,
              expiry: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes from now
              transactionHash: tx.hash
            });
            console.log('Long entry recorded in database');
          } catch (error) {
            console.warn('Failed to record long entry:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error entering option:', error);
      
      // Dismiss any loading toasts
      toast.dismiss();
      
      // Handle specific error types
      let errorMessage = 'Failed to enter option';
      
      if (error.code === 4001) {
        errorMessage = 'Transaction cancelled by user';
      } else if (error.message && error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(`Failed to enter option: ${errorMessage}`);
    }
  };

  const handleReclaim = async (contractAddress) => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const response = await axios.post(`/api/option/${contractAddress}/reclaim`);
      
      if (response.data.success) {
        console.log('Reclaim transaction data:', response.data.data);
        
        // Send the transaction to MetaMask
        const tx = await sendTransaction(response.data.data);
        if (tx) {
          toast.success('Reclaim transaction sent! Waiting for confirmation...');
          
          // Wait for confirmation
          await tx.wait();
          
          // Clear cache to get fresh data
          await axios.post('/api/factory/clear-cache');
          
          toast.success('Option resolved and funds reclaimed successfully!');
        }
      }
    } catch (error) {
      console.error('Error reclaiming option:', error);
      
      // Enhanced error logging
      if (error.message && error.message.includes('execution reverted')) {
        console.error('Reclaim transaction reverted. Possible reasons:');
        console.error('1. User is not the short position holder');
        console.error('2. Option is not expired yet');
        console.error('3. Option was already exercised');
        console.error('4. Option was already reclaimed');
      }
      
      toast.error('Failed to reclaim option');
    }
  };

  const handleResolveAndExercise = async (contractAddress, option) => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Calculate the maximum MTK amount that can be exercised
      // Based on the formula: twoTkAmount = (mtkAmount * 1e18) / strikePrice
      // And the constraint: twoTkAmount <= optionSize
      // So: mtkAmount <= (optionSize * strikePrice) / 1e18
      const maxMtkAmount = (option.optionSize * option.strikePrice) / 1e18;
      
      console.log('Calculated max MTK amount for exercise:', maxMtkAmount);
      
      const response = await axios.post(`/api/option/${contractAddress}/resolveAndExercise`, {
        mtkAmount: maxMtkAmount.toString()
      });
      
      if (response.data.success) {
        console.log('Resolve and exercise transaction data:', response.data.data);
        
        const { approveTransaction, resolveAndExerciseTransaction } = response.data.data;
        
        // Step 1: Approve MTK spending
        toast.loading('Approving MTK spending... (Step 1/2)');
        const approveTx = await sendTransaction(approveTransaction);
        if (approveTx) {
          await approveTx.wait();
          toast.success('✅ MTK approval confirmed!');
        } else {
          throw new Error('MTK approval failed');
        }
        
        // Step 2: Resolve and exercise via OptionsBook
        toast.loading('Executing resolve and exercise... (Step 2/2)');
        const resolveAndExerciseTx = await sendTransaction(resolveAndExerciseTransaction);
        if (resolveAndExerciseTx) {
          await resolveAndExerciseTx.wait();
          toast.success('✅ Option resolved and exercised successfully!');
          
          // Clear cache to get fresh data
          await axios.post('/api/factory/clear-cache');
        } else {
          throw new Error('Resolve and exercise failed');
        }
      }
    } catch (error) {
      console.error('Error resolving and exercising option:', error);
      
      // Enhanced error logging
      if (error.message && error.message.includes('execution reverted')) {
        console.error('Resolve and exercise transaction reverted. Possible reasons:');
        console.error('1. User is not the long position holder');
        console.error('2. Option is not expired yet');
        console.error('3. Option was already exercised');
        console.error('4. Option was already resolved');
        console.error('5. Price at expiry is not profitable');
      }
      
      toast.error('Failed to resolve and exercise option');
    }
  };

  



  return (
    <MarketContainer>
      <Title>
        Options Book
      </Title>

      <FilterSection>
        <span>Filter:</span>
        <FilterButton 
          active={filter === 'all'} 
          onClick={() => setFilter('all')}
        >
          All Options
        </FilterButton>
        <FilterButton 
          active={filter === 'available'} 
          onClick={() => setFilter('available')}
        >
          Available
        </FilterButton>
                 <FilterButton 
           active={filter === 'filled'} 
           onClick={() => setFilter('filled')}
         >
           Active
         </FilterButton>
        <FilterButton 
          active={filter === 'expired'} 
          onClick={() => setFilter('expired')}
        >
          Expired
        </FilterButton>
      </FilterSection>

      {isLoading ? (
        <EmptyState>
          <h3>Loading options...</h3>
          <p>Fetching available options from the blockchain.</p>
        </EmptyState>
      ) : filteredOptions.length === 0 ? (
        <EmptyState>
          <AlertTriangle size={48} style={{ marginBottom: '1rem' }} />
          <h3>No options found</h3>
          <p>No options match your current filter criteria.</p>
        </EmptyState>
      ) : (
        <OptionsGrid>
          {filteredOptions.map((option, index) => {
            const status = getStatus(option);
            const isExpired = option.expiry && option.expiry * 1000 < currentTime;
            const canEnter = !option.isActive && !isExpired;
            
            // Check user roles
            const isLongPosition = option.long && account && option.long.toLowerCase() === account.toLowerCase();
            const isShortPosition = option.short && account && option.short.toLowerCase() === account.toLowerCase();
            
            const canExercise = option.isActive && isExpired && !option.isExercised && !option.isResolved && isLongPosition;
            const canReclaim = option.isActive && isExpired && !option.isExercised && !option.isResolved && isShortPosition;
            
            // Debug logging for exercise button logic
            if (isExpired && !option.isExercised) {
              console.log(`Debug for option ${option.address}:`, {
                isActive: option.isActive,
                isExpired: isExpired,
                isExercised: option.isExercised,
                long: option.long,
                account: account,
                isLongPosition: isLongPosition,
                canExercise: canExercise,
                canReclaim: canReclaim
              });
            }
            


            return (
              <OptionCard key={index}>
                <OptionHeader>
                  <OptionTitle>
                    {(() => {
                      const payoffType = option.payoffType || 'Linear';
                      const optionType = option.type === 'call' ? 'Call' : option.type === 'put' ? 'Put' : 'Option';
                      return `${payoffType} ${optionType}`;
                    })()}
                  </OptionTitle>
                  <OptionStatus className={status.class}>
                    {status.text}
                  </OptionStatus>
                </OptionHeader>

                <OptionDetails>
                  <DetailRow>
                    <DetailLabel>Strike Price:</DetailLabel>
                    <DetailValue>{formatTokenAmount(option.strikePrice, option.strikeSymbol || 'MTK')}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Option Size:</DetailLabel>
                    <DetailValue>{formatTokenAmount(option.optionSize, option.underlyingSymbol || '2TK')}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Premium:</DetailLabel>
                    <DetailValue>{formatTokenAmount(option.premium, option.strikeSymbol || 'MTK')}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Expiry:</DetailLabel>
                    <DetailValue>
                      {formatExpiry(option)}
                    </DetailValue>
                  </DetailRow>
                                     <DetailRow>
                     <DetailLabel>Price of {option.underlyingSymbol || '2TK'} at Expiry:</DetailLabel>
                     <DetailValue>
                       {(() => {
                         // Use resolutionStatus if available, otherwise fall back to current logic
                         if (option.resolutionStatus) {
                           switch (option.resolutionStatus) {
                             case 'active':
                               return 'Not yet expired';
                             case 'resolved':
                               return formatTokenAmount(option.priceAtExpiry, option.strikeSymbol || 'MTK');
                             case 'exercised':
                               return formatTokenAmount(option.priceAtExpiry, option.strikeSymbol || 'MTK');
                             case 'needs_resolution':
                               return '? MTK';
                             default:
                               return '? MTK';
                           }
                         } else {
                           // Fallback logic for older response format
                           const isExpired = option.expiry && option.expiry * 1000 < currentTime;
                           if (!isExpired) {
                             return 'Not yet expired';
                           } else if (option.isResolved) {
                             return formatTokenAmount(option.priceAtExpiry, option.strikeSymbol || 'MTK');
                           } else {
                             return '? MTK';
                           }
                         }
                       })()}
                     </DetailValue>
                   </DetailRow>
                </OptionDetails>

                <ActionButtons>
                  {!option.isActive && (
                    <Button 
                      className="primary" 
                      onClick={() => handleEnter(option.address)}
                    >
                      <TrendingUp size={16} />
                      Enter as Long
                    </Button>
                  )}
                  
                  
                  
                  {canExercise && (
                    <Button 
                      className="primary" 
                      onClick={() => handleResolveAndExercise(option.address, option)}
                    >
                      <DollarSign size={16} />
                      Exercise
                    </Button>
                  )}
                  
                  {canReclaim && (
                    <Button 
                      className="primary" 
                      onClick={() => handleReclaim(option.address)}
                    >
                      <DollarSign size={16} />
                      Reclaim Funds
                    </Button>
                  )}
                  
                  <Button 
                    className="secondary" 
                    onClick={() => navigate(`/option/${option.address}`)}
                  >
                    <Eye size={16} />
                    View Details
                  </Button>
                </ActionButtons>
              </OptionCard>
            );
          })}
        </OptionsGrid>
      )}
    </MarketContainer>
  );
};

export default OptionsMarket; 