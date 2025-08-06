import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useWallet } from '../context/WalletContext';
import { TrendingUp, DollarSign, Clock, AlertCircle, Search, User, Box, Network } from 'lucide-react';
import axios from 'axios';

const DashboardContainer = styled.div`
  color: white;
`;

const WelcomeSection = styled.div`
  text-align: center;
  margin-bottom: 3rem;
`;

const Title = styled.h1`
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  opacity: 0.8;
  margin-bottom: 2rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
  }
`;

const StatIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #667eea;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
  
  &.updating {
    color: #667eea;
  }
`;

const StatLabel = styled.div`
  opacity: 0.8;
  font-size: 0.9rem;
`;

const ConnectPrompt = styled.div`
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 3rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const ConnectButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
`;

const ActionButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }
`;

const ContractLookup = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 3rem;
`;

const LookupTitle = styled.h3`
  margin-bottom: 1rem;
  color: #667eea;
`;

const LookupForm = styled.div`
  display: flex;
  gap: 1rem;
  align-items: flex-end;
`;

const InputGroup = styled.div`
  flex: 1;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.8;
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

const SearchButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { account, connectWallet } = useWallet();
  const [contractAddress, setContractAddress] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [previousBlockNumber, setPreviousBlockNumber] = useState(null);

  // Fetch network info once and cache permanently
  const { data: networkInfo } = useQuery('networkInfo', async () => {
    const response = await axios.get('/api/blockchain/status');
    return {
      network: response.data.network,
      chainId: response.data.chainId,
      connected: response.data.connected
    };
  }, {
    staleTime: Infinity, // Never consider stale - cache forever
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 5000
  });

  // Fetch current block number every minute
  const { data: blockchainStatus } = useQuery('blockNumber', async () => {
    const response = await axios.get('/api/blockchain/status');
    return response.data;
  }, {
    refetchInterval: 60000, // Every 60 seconds
    staleTime: 50000, // Consider stale after 50 seconds
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 5000
  });

  // Animate block number changes
  React.useEffect(() => {
    if (blockchainStatus?.blockNumber && previousBlockNumber !== null && blockchainStatus.blockNumber !== previousBlockNumber) {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 300);
    }
    setPreviousBlockNumber(blockchainStatus?.blockNumber);
  }, [blockchainStatus?.blockNumber, previousBlockNumber]);


  // Get total volume directly from OptionsBook contract
  const { data: totalVolume = '0' } = useQuery('totalVolume', async () => {
    try {
      // Use the optimized endpoint that we created
      const response = await axios.get('/api/factory/all-contracts');
      
      console.log('📊 Total volume debug:', {
        responseData: response.data,
        totalVolumeRaw: response.data.totalVolume,
        totalVolumeType: typeof response.data.totalVolume
      });
      
      // Use direct total volume from OptionsBook contract (already in wei)
      const totalVolumeWei = response.data.totalVolume || '0';
      
      // Convert from wei to MTK for display
      const totalVolumeNumber = parseFloat(totalVolumeWei);
      const volumeInMTK = totalVolumeNumber / Math.pow(10, 18);
      
      console.log('📊 Volume conversion debug:', {
        totalVolumeWei,
        totalVolumeNumber,
        volumeInMTK,
        finalDisplay: volumeInMTK.toFixed(2)
      });
      
      return volumeInMTK.toFixed(2);
    } catch (error) {
      console.error('❌ Error fetching total volume:', error);
      return '0';
    }
  }, {
    refetchInterval: 60000, // Update every 60 seconds
    staleTime: 0, // Always consider stale to force fresh requests
    cacheTime: 0, // Don't cache the data
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 10000
  });

  const handleContractLookup = (e) => {
    e.preventDefault();
    if (contractAddress.trim()) {
      navigate(`/option/${contractAddress.trim()}`);
    }
  };

  if (!account) {
    return (
      <DashboardContainer>
        <WelcomeSection>
          <Title>Welcome to DDX Protocol</Title>
          <Subtitle>
            Trade options with ease on the decentralized exchange
          </Subtitle>
        </WelcomeSection>
        
        <ConnectPrompt>
          <AlertCircle size={48} style={{ marginBottom: '1rem' }} />
          <h2>Connect Your Wallet</h2>
          <p>Connect your MetaMask wallet to start trading options</p>
          <ConnectButton onClick={connectWallet}>
            Connect Wallet
          </ConnectButton>
        </ConnectPrompt>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
                     <WelcomeSection>
          <Title>Blockchain Layer-3 Protocol for Decentralized Derivatives Exchange</Title>
        </WelcomeSection>

      <StatsGrid>
                 <StatCard>
           <StatIcon>
             <Box />
           </StatIcon>
           <StatValue className={isUpdating ? 'updating' : ''}>
             {blockchainStatus?.blockNumber || '...'}
           </StatValue>
           <StatLabel>Current Block</StatLabel>
         </StatCard>

                 <StatCard>
           <StatIcon>
             <DollarSign />
           </StatIcon>
                       <StatValue>
              {totalVolume || 'Loading...'} MTK
            </StatValue>
            <StatLabel>Total Volume</StatLabel>
         </StatCard>

                 <StatCard>
           <StatIcon>
             <Network />
           </StatIcon>
           <StatValue>
             {networkInfo?.network ? networkInfo.network.charAt(0).toUpperCase() + networkInfo.network.slice(1) : '...'}
           </StatValue>
           <StatLabel>Network</StatLabel>
         </StatCard>
      </StatsGrid>

      <ContractLookup>
        <LookupTitle>
          <Search size={20} style={{ marginRight: '0.5rem' }} />
          Access Option Contract
        </LookupTitle>
        <form onSubmit={handleContractLookup}>
          <LookupForm>
            <InputGroup>
              <Label>Contract Address</Label>
              <Input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
              />
            </InputGroup>
            <SearchButton type="submit" disabled={!contractAddress.trim()}>
              <Search size={16} />
              View Contract
            </SearchButton>
          </LookupForm>
        </form>
      </ContractLookup>

             <QuickActions>
         <ActionButton onClick={() => window.location.href = '/market'}>
           <TrendingUp size={20} />
           Browse Options
         </ActionButton>
         <ActionButton onClick={() => window.location.href = '/create'}>
           <DollarSign size={20} />
           Draft Contract
         </ActionButton>
         <ActionButton onClick={() => window.location.href = '/my-options'}>
           <Clock size={20} />
           Futures Book
         </ActionButton>
         <ActionButton onClick={() => window.location.href = '/my-options'}>
           <User size={20} />
           My Options
         </ActionButton>
       </QuickActions>
    </DashboardContainer>
  );
};

export default Dashboard; 