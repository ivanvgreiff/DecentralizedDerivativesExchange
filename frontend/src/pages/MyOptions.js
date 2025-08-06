import React from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { useWallet } from '../context/WalletContext';
import { User, Clock, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const MyOptionsContainer = styled.div`
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

const RoleBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  
  &.short {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  &.long {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
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

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const MyOptions = () => {
  const { account } = useWallet();

  // Mock data for demonstration - in real app, this would come from blockchain
  const mockMyOptions = [
    {
      contractAddress: '0x1234...',
      role: 'short',
      underlyingSymbol: '2TK',
      strikeSymbol: 'MTK',
      strikePrice: '1.5',
      optionSize: '100',
      premium: '50',
      expiry: Date.now() + 5 * 60 * 1000,
      isFilled: true,
      isExercised: false,
      isFunded: true,
      isResolved: true,
      priceAtExpiry: '2.0'
    },
    {
      contractAddress: '0x5678...',
      role: 'long',
      underlyingSymbol: '2TK',
      strikeSymbol: 'MTK',
      strikePrice: '2.0',
      optionSize: '200',
      premium: '75',
      expiry: Date.now() - 2 * 60 * 1000,
      isFilled: true,
      isExercised: false,
      isFunded: true,
      isResolved: true,
      priceAtExpiry: '2.5'
    }
  ];

  if (!account) {
    return (
      <MyOptionsContainer>
        <Title>Futures Book</Title>
        <EmptyState>
          <AlertTriangle size={48} style={{ marginBottom: '1rem' }} />
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view your options</p>
        </EmptyState>
      </MyOptionsContainer>
    );
  }

  return (
    <MyOptionsContainer>
      <Title>
        Futures Book
      </Title>

      {mockMyOptions.length === 0 ? (
        <EmptyState>
          <AlertTriangle size={48} style={{ marginBottom: '1rem' }} />
          <h3>No Options Found</h3>
          <p>You don't have any options yet. Create or buy some options to get started!</p>
        </EmptyState>
      ) : (
        <OptionsGrid>
          {mockMyOptions.map((option, index) => (
            <OptionCard key={index}>
              <OptionHeader>
                <OptionTitle>
                  {option.underlyingSymbol}/{option.strikeSymbol}
                </OptionTitle>
                <RoleBadge className={option.role}>
                  {option.role === 'short' ? 'Short' : 'Long'}
                </RoleBadge>
              </OptionHeader>

              <OptionDetails>
                <DetailRow>
                  <DetailLabel>Strike Price:</DetailLabel>
                  <DetailValue>{option.strikePrice} {option.strikeSymbol}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>Option Size:</DetailLabel>
                  <DetailValue>{option.optionSize} {option.underlyingSymbol}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>Premium:</DetailLabel>
                  <DetailValue>{option.premium} {option.strikeSymbol}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>Expiry:</DetailLabel>
                  <DetailValue>
                    {new Date(option.expiry).toLocaleString()}
                  </DetailValue>
                </DetailRow>
                {option.priceAtExpiry && (
                  <DetailRow>
                    <DetailLabel>Price at Expiry:</DetailLabel>
                    <DetailValue>{option.priceAtExpiry} {option.strikeSymbol}</DetailValue>
                  </DetailRow>
                )}
                <DetailRow>
                  <DetailLabel>Status:</DetailLabel>
                  <DetailValue>
                    {option.isExercised ? 'Exercised' : 
                     option.expiry < Date.now() ? 'Expired' : 
                     option.isFilled ? 'Active' : 'Funded'}
                  </DetailValue>
                </DetailRow>
              </OptionDetails>
            </OptionCard>
          ))}
        </OptionsGrid>
      )}
    </MyOptionsContainer>
  );
};

export default MyOptions; 