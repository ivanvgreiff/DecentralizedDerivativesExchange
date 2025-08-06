import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { useWallet } from '../context/WalletContext';
import { ArrowLeft, DollarSign, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';

const DetailContainer = styled.div`
  color: white;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 20px;
  min-height: calc(100vh - 120px);
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  transition: all 0.3s ease;
  font-size: 0.95rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 3rem;
  text-align: center;
  font-weight: 600;
  letter-spacing: -0.5px;
`;

const DetailCard = styled.div`
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
`;

const DetailSection = styled.div`
  margin-bottom: 3rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1.4rem;
  margin-bottom: 1.5rem;
  color: #ffffff;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  
  &::before {
    content: '';
    width: 4px;
    height: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 2px;
  }
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
`;

const DetailLabel = styled.span`
  opacity: 0.8;
  font-size: 0.95rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
`;

const DetailValue = styled.span`
  font-weight: 600;
  font-size: 0.95rem;
  word-break: break-all;
  text-align: right;
  max-width: 60%;
  font-family: 'Courier New', monospace;
  
  @media (max-width: 768px) {
    max-width: 50%;
    font-size: 0.85rem;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 3rem;
  justify-content: center;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const Button = styled.button`
  flex: 1;
  min-width: 180px;
  max-width: 250px;
  padding: 1.25rem 2rem;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  
  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
  }
  
  &.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 768px) {
    min-width: 100%;
    max-width: none;
    padding: 1rem 1.5rem;
  }
`;

const StatusBadge = styled.span`
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 600;
  
  &.funded {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  
  &.filled {
    background: rgba(34, 197, 94, 0.3);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.5);
  }
  
  &.expired {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }
  
  &.exercised {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }
  
  &.not-engaged {
    background: rgba(147, 197, 253, 0.3);
    color: #93c5fd;
    border: 1px solid rgba(147, 197, 253, 0.5);
  }
`;

const ExerciseInputSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 2rem;
  margin-top: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const ExerciseTitle = styled.h4`
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
  color: #ffffff;
  font-weight: 600;
`;

const ExerciseInput = styled.input`
  width: 100%;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1.1rem;
  margin-bottom: 1rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
  
  &.error {
    border-color: #ef4444;
  }
`;

const ExerciseMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
`;

const MetricCard = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const MetricLabel = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 0.5rem;
`;

const MetricValue = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${props => props.positive ? '#22c55e' : props.negative ? '#ef4444' : 'white'};
`;

const ExerciseButtons = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ExerciseSummary = styled.div`
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const SummaryTitle = styled.h4`
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #667eea;
  font-weight: 600;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
`;

const HighlightCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
`;

const HighlightLabel = styled.div`
  font-size: 0.85rem;
  opacity: 0.8;
  margin-bottom: 0.5rem;
`;

const HighlightValue = styled.div`
  font-size: 1.2rem;
  font-weight: 700;
  color: ${props => props.positive ? '#22c55e' : props.negative ? '#ef4444' : '#667eea'};
`;

const FinalPnLSection = styled.div`
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 16px;
  padding: 2rem;
  margin-top: 2rem;
`;

const PnLTitle = styled.h3`
  font-size: 1.4rem;
  margin-bottom: 1.5rem;
  color: #22c55e;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PnLGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
`;

const PnLCard = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
`;

const PnLLabel = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
`;

const PnLValue = styled.div`
  font-size: 1.3rem;
  font-weight: 700;
  color: ${props => props.positive ? '#22c55e' : props.negative ? '#ef4444' : '#ffffff'};
  margin-bottom: 0.5rem;
`;

const PnLSubtext = styled.div`
  font-size: 0.8rem;
  opacity: 0.7;
  font-style: italic;
`;

const LivePriceSection = styled.div`
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
`;

const LivePriceTitle = styled.h4`
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #22c55e;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LivePriceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

const LivePriceCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
`;

const LivePriceLabel = styled.div`
  font-size: 0.85rem;
  opacity: 0.8;
  margin-bottom: 0.5rem;
`;

const LivePriceValue = styled.div`
  font-size: 1.3rem;
  font-weight: 700;
  color: #22c55e;
  margin-bottom: 0.25rem;
`;

const LivePriceTime = styled.div`
  font-size: 0.75rem;
  opacity: 0.6;
  font-style: italic;
`;

const PriceChangeIndicator = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: ${props => props.positive ? '#22c55e' : props.negative ? '#ef4444' : '#fbbf24'};
  margin-left: 0.5rem;
`;

const OptionDetail = () => {
  const { contractAddress } = useParams();
  const { account, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [exerciseAmount, setExerciseAmount] = useState('');
  const [showExerciseInput, setShowExerciseInput] = useState(false);
  const [livePrices, setLivePrices] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);

  const formatAddress = (address) => {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return 'Not filled';
    }
    return address;
  };

  // Format large numbers by dividing by 10^18
  const formatTokenAmount = (amount, symbol) => {
    if (!amount) return `0 ${symbol}`;
    
    // Handle wei values (large numbers that might be in scientific notation)
    try {
      // eslint-disable-next-line no-undef
      const weiAmount = BigInt(amount);
      const etherAmount = Number(weiAmount) / Math.pow(10, 18);
      
      // Format to avoid scientific notation and remove trailing zeros
      const formatted = etherAmount.toFixed(6).replace(/\.?0+$/, '');
      return `${formatted} ${symbol}`;
    } catch (error) {
      // If BigInt conversion fails, the value might be in scientific notation
      if (typeof amount === 'string' && amount.includes('e')) {
        const numValue = parseFloat(amount);
        // Convert from wei to ether (divide by 10^18)
        const etherAmount = numValue / Math.pow(10, 18);
        const formatted = etherAmount.toFixed(6).replace(/\.?0+$/, '');
        return `${formatted} ${symbol}`;
      }
      
      // Fallback: try parsing as float
      const numValue = parseFloat(amount);
      const formatted = numValue.toFixed(6).replace(/\.?0+$/, '');
      return `${formatted} ${symbol}`;
    }
  };

  // Format expiry display
  const formatExpiry = (expiry, isActive, isFunded) => {
    if (!expiry) return 'Not set';
    
    // If option is not yet engaged (not funded or not active), show activation message
    if (!isFunded || !isActive) {
      return '5 minutes upon activation';
    }
    
    // If option is engaged, show actual expiry date
    return new Date(expiry * 1000).toLocaleString();
  };

  // Calculate exercise metrics with optional live price override
  const calculateExerciseMetrics = (amount, useLivePrice = false) => {
    if (!optionData || !amount || amount <= 0) return null;
    
    // Determine which price to use for calculations
    let effectivePriceAtExpiry = optionData.priceAtExpiry || 0;
    let priceSource = 'contract';
    
    if (useLivePrice && livePrices.underlying && livePrices.underlying.price1e18) {
      effectivePriceAtExpiry = livePrices.underlying.price1e18;
      priceSource = 'live';
    }
    
    // Determine option type (call or put)
    const isCallOption = optionData.optionType === 'CALL';
    const isPutOption = optionData.optionType === 'PUT';
    
    console.log('Calculating exercise metrics with:', {
      amount,
      strikePrice: optionData.strikePrice,
      priceAtExpiry: optionData.priceAtExpiry,
      effectivePriceAtExpiry,
      priceSource,
      optionSize: optionData.optionSize,
      isResolved: optionData.isResolved,
      isExercised: optionData.isExercised,
      livePriceAvailable: !!livePrices.underlying,
      optionType: optionData.optionType,
      isCallOption,
      isPutOption
    });
    
    // eslint-disable-next-line no-undef
    const amountWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, 18)));
    // eslint-disable-next-line no-undef
    const strikePriceWei = BigInt(optionData.strikePrice);
    // eslint-disable-next-line no-undef
    const priceAtExpiryWei = BigInt(effectivePriceAtExpiry);
    // eslint-disable-next-line no-undef
    const optionSizeWei = BigInt(optionData.optionSize);
    
    // Calculate how much 2TK user gets: (mtkAmount * 1e18) / strikePrice
    // This matches the smart contract formula
    // eslint-disable-next-line no-undef
    const twoTkAmount = (amountWei * BigInt(Math.pow(10, 18))) / strikePriceWei;
    
    // Check if amount exceeds limit
    const exceedsLimit = twoTkAmount > optionSizeWei;
    
    // Check if option is resolved and has priceAtExpiry (or live price)
    const isResolved = optionData.isResolved && priceAtExpiryWei > 0;
    const hasLivePrice = useLivePrice && livePrices.underlying && priceAtExpiryWei > 0;
    
    // Calculate percentage gain based on option type
    // For calls: ((priceAtExpiry - strikePrice) / strikePrice) * 100
    // For puts: ((strikePrice - priceAtExpiry) / strikePrice) * 100
    // eslint-disable-next-line no-undef
    const percentGain = isResolved ? 
      (isPutOption ? 
        Number((strikePriceWei - priceAtExpiryWei) * 100n / strikePriceWei) : // Put: profit when price drops
        Number((priceAtExpiryWei - strikePriceWei) * 100n / strikePriceWei)   // Call: profit when price rises
      ) : 0;
    
    // Calculate market value and profit based on option type
    let marketValueWei = 0n;
    let netProfit = 0;
    let roiPercent = 0;
    let profitFromPriceDiff = 0;
    
    if (isResolved || hasLivePrice) {
      if (isCallOption) {
        // CALL OPTION: Long profits when priceAtExpiry > strikePrice
        // Market Value = amount of 2TK received * current market price
        // eslint-disable-next-line no-undef
        marketValueWei = twoTkAmount * priceAtExpiryWei / BigInt(Math.pow(10, 18));
        
        // Profit from favorable price movement
        if (priceAtExpiryWei > strikePriceWei) {
          // eslint-disable-next-line no-undef
          profitFromPriceDiff = Number(twoTkAmount * (priceAtExpiryWei - strikePriceWei) / BigInt(Math.pow(10, 18))) / Math.pow(10, 18);
        }
      } else if (isPutOption) {
        // PUT OPTION: Long profits when priceAtExpiry < strikePrice
        // Check if put is profitable for long position
        const isPutProfitable = priceAtExpiryWei < strikePriceWei;
        
        if (isPutProfitable) {
          // Put is profitable - long can sell 2TK at strike price when market price is lower
          // Market Value = amount of MTK they receive for their 2TK at strike price
          // eslint-disable-next-line no-undef
          marketValueWei = twoTkAmount * strikePriceWei / BigInt(Math.pow(10, 18));
          
          // Profit from favorable price movement (put profits when price drops)
          // eslint-disable-next-line no-undef
          profitFromPriceDiff = Number(twoTkAmount * (strikePriceWei - priceAtExpiryWei) / BigInt(Math.pow(10, 18))) / Math.pow(10, 18);
        } else {
          // Put is out of the money - not profitable to exercise
          // This happens when priceAtExpiry >= strikePrice (unfavorable for put holder)
          marketValueWei = 0n;
          profitFromPriceDiff = 0;
        }
      } else {
        // Fallback to call option logic if type is unknown
        // eslint-disable-next-line no-undef
        marketValueWei = twoTkAmount * priceAtExpiryWei / BigInt(Math.pow(10, 18));
        if (priceAtExpiryWei > strikePriceWei) {
          // eslint-disable-next-line no-undef
          profitFromPriceDiff = Number(twoTkAmount * (priceAtExpiryWei - strikePriceWei) / BigInt(Math.pow(10, 18))) / Math.pow(10, 18);
        }
      }
    }
    
    // Calculate total cost (exercise amount + premium already paid)
    // eslint-disable-next-line no-undef
    const premiumPaidWei = BigInt(optionData.premium || 0);
    const totalCostWei = amountWei + premiumPaidWei;
    
    // Convert to readable numbers
    const marketValue = Number(marketValueWei) / Math.pow(10, 18); // MTK value of what long received
    const totalCost = Number(totalCostWei) / Math.pow(10, 18); // Total MTK spent (exercise + premium)
    
    // Net profit = Market value of what you receive - Total cost to get it
    netProfit = marketValue - totalCost;
    roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
    
    // Calculate max spendable based on option type
    let maxSpendableWei;
    if (isPutOption) {
      // For puts: max is the full option size in 2TK tokens
      maxSpendableWei = optionSizeWei;
    } else {
      // For calls: max is optionSize * strikePrice / 1e18 in MTK tokens
      // eslint-disable-next-line no-undef
      maxSpendableWei = optionSizeWei * strikePriceWei / BigInt(Math.pow(10, 18));
    }
    
    return {
      twoTkAmount: Number(twoTkAmount) / Math.pow(10, 18),
      exceedsLimit,
      percentGain,
      profitFromPriceDiff, // Profit from favorable price movement
      marketValueMTK: marketValue, // MTK value of what long received 
      totalCost, // Total MTK spent (exercise + premium)
      netProfit, // Actual profit/loss
      roiPercent, // Return on investment percentage
      maxSpendable: Number(maxSpendableWei) / Math.pow(10, 18),
      isResolved: isResolved || hasLivePrice,
      priceAtExpiry: effectivePriceAtExpiry,
      priceSource,
      hasLivePrice,
      livePriceValue: useLivePrice ? parseFloat(livePrices.underlying?.priceFormatted || 0) : null,
      isCallOption,
      isPutOption
    };
  };

  // Fetch option details - blockchain only
  const { data: optionData, isLoading: isLoadingOption } = useQuery(
    ['option', contractAddress],
    async () => {
      try {
        // Get data directly from blockchain
        const response = await axios.get(`/api/option/${contractAddress}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching option data from blockchain:', error);
        throw error;
      }
    },
    {
      enabled: !!contractAddress,
      retry: 1,
      retryDelay: 2000
    }
  );

  // Fetch live prices from oracle
  const fetchLivePrice = async (tokenAddress, tokenSymbol) => {
    try {
      const response = await axios.get(`/api/oracle/price/${tokenAddress}`);
      return {
        ...response.data,
        symbol: tokenSymbol || response.data.symbol
      };
    } catch (error) {
      console.warn(`Failed to fetch live price for ${tokenSymbol}:`, error);
      return null;
    }
  };

  // Auto-fetch live prices when option data loads
  React.useEffect(() => {
    const fetchAllLivePrices = async () => {
      if (!optionData || !optionData.underlyingToken) return;
      
      setPriceLoading(true);
      try {
        // Fetch prices for both underlying and strike tokens
        const [underlyingPrice, strikePrice] = await Promise.all([
          fetchLivePrice(optionData.underlyingToken, optionData.underlyingSymbol),
          fetchLivePrice(optionData.strikeToken, optionData.strikeSymbol)
        ]);

        setLivePrices({
          underlying: underlyingPrice,
          strike: strikePrice,
          lastFetchTime: Date.now()
        });
      } catch (error) {
        console.error('Error fetching live prices:', error);
      } finally {
        setPriceLoading(false);
      }
    };

    if (optionData && showExerciseInput) {
      fetchAllLivePrices();
      // Set up interval to refresh prices every 60 seconds
      const priceInterval = setInterval(fetchAllLivePrices, 60000);
      return () => clearInterval(priceInterval);
    }
  }, [optionData, showExerciseInput]);

  // Auto-set maximum amount when data loads
  React.useEffect(() => {
    if (optionData && !exerciseAmount && showExerciseInput) {
      const maxSpendable = calculateExerciseMetrics('1')?.maxSpendable;
      if (maxSpendable) {
        setExerciseAmount(maxSpendable.toFixed(2));
      }
    }
  }, [optionData, showExerciseInput, exerciseAmount]);

  // Calculate exercise metrics after optionData is available (contract prices)
  const exerciseMetrics = calculateExerciseMetrics(exerciseAmount, false);
  
  // Calculate live price metrics when available
  const liveExerciseMetrics = livePrices.underlying ? calculateExerciseMetrics(exerciseAmount, true) : null;
  
  // Calculate final P&L for exercised options (using max spendable amount)
  const finalPnL = optionData?.isExercised ? (() => {
    // Calculate max spendable: optionSize * strikePrice / 1e18
    const maxSpendable = (Number(optionData.optionSize) * Number(optionData.strikePrice)) / Math.pow(10, 36);
    return calculateExerciseMetrics(maxSpendable.toFixed(2));
  })() : null;

  const handleFund = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`/api/option/${contractAddress}/fund`);
      
      if (response.data.success) {
        const tx = await sendTransaction(response.data.data);
        if (tx) {
          toast.success('Transaction sent! Waiting for confirmation...');
          
          // Wait for confirmation
          await tx.wait();
          
          // Notify backend about funding event
          try {
            await axios.post(`/api/contracts/${contractAddress}/funded`, {
              transactionHash: tx.hash
            });
            console.log('Funded event recorded in database');
          } catch (error) {
            console.warn('Failed to record funded event:', error);
          }
          
          toast.success('Option funded successfully!');
        }
      }
    } catch (error) {
      console.error('Error funding option:', error);
      toast.error('Failed to fund option');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnter = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`/api/option/${contractAddress}/enter`, {
        userAddress: account
      });
      
      if (response.data.success) {
        const { approveTransaction, enterTransaction } = response.data.data;
        
        // First, send the approve transaction
        toast.success('Sending approve transaction...');
        const approveTx = await sendTransaction(approveTransaction);
        if (!approveTx) {
          toast.error('Approve transaction failed');
          return;
        }
        
        // Wait for approve transaction confirmation
        await approveTx.wait();
        toast.success('Approve transaction confirmed!');
        
        // Then, send the enter transaction
        toast.success('Sending enter transaction...');
        const enterTx = await sendTransaction(enterTransaction);
        if (!enterTx) {
          toast.error('Enter transaction failed');
          return;
        }
        
        // Wait for enter transaction confirmation
        await enterTx.wait();
        toast.success('Enter transaction confirmed!');
        
        // Calculate expiry (current time + 5 minutes for demo, you can adjust this)
        const expiry = Math.floor(Date.now() / 1000) + (5 * 60); // 5 minutes from now
        
        // THIS IS THE KEY EVENT - triggers resolution timer
        try {
          await axios.post(`/api/contracts/${contractAddress}/long-entered`, {
            longAddress: account,
            expiry: expiry,
            transactionHash: enterTx.hash
          });
          console.log('Long entry recorded - resolution timer started!');
        } catch (error) {
          console.warn('Failed to record long entry:', error);
        }
        
        toast.success(`Long position entered! Option expires in 5 minutes and will auto-resolve.`);
      }
    } catch (error) {
      console.error('Error entering option:', error);
      toast.error('Failed to enter option');
    } finally {
      setIsLoading(false);
    }
  };



  const handleExercise = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!exerciseAmount || exerciseAmount <= 0) {
      toast.error('Please enter a valid exercise amount');
      return;
    }

    if (exerciseMetrics?.exceedsLimit) {
      toast.error(`Amount too large. Maximum spendable: ${exerciseMetrics.maxSpendable.toFixed(2)} MTK`);
      return;
    }

    const mtkAmount = exerciseAmount;
    
    setIsLoading(true);
    try {
      // For put options, send 2TK amount; for call options, send MTK amount
      const isPutOption = optionData.optionType === 'PUT';
      const requestBody = isPutOption 
        ? { twoTkAmount: mtkAmount } // For puts, user specifies how much 2TK to sell
        : { mtkAmount: mtkAmount };  // For calls, user specifies how much MTK to spend
      
      console.log('Exercise request:', { 
        optionType: optionData.optionType, 
        requestBody 
      });
      
      const response = await axios.post(`/api/option/${contractAddress}/resolveAndExercise`, requestBody);
      
      if (response.data.success) {
        console.log('Transaction data:', response.data.data);
        const { approveTransaction, resolveAndExerciseTransaction } = response.data.data;
        
        // Step 1: Send approve transaction
        const tokenSymbol = isPutOption ? optionData.underlyingSymbol : optionData.strikeSymbol;
        toast.success(`Approving ${tokenSymbol} spending... (Transaction 1/2)`);
        const approveTx = await sendTransaction(approveTransaction);
        if (!approveTx) {
          toast.error('Approve transaction failed');
          return;
        }
        await approveTx.wait();
        toast.success(`✅ ${tokenSymbol} spending approved!`);
        
        // Step 2: Send resolveAndExercise transaction to OptionsBook
        toast.success('Executing resolve and exercise... (Transaction 2/2)');
        const resolveAndExerciseTx = await sendTransaction(resolveAndExerciseTransaction);
        if (!resolveAndExerciseTx) {
          toast.error('Resolve and exercise transaction failed');
          return;
        }
        await resolveAndExerciseTx.wait();
        
        // Clear cache to get fresh data
        await axios.post('/api/factory/clear-cache');
        
        toast.success('✅ Option resolved and exercised successfully!');
      }
    } catch (error) {
      console.error('Error exercising option:', error);
      
      // Enhanced error logging
      if (error.message && error.message.includes('execution reverted')) {
        console.error('Transaction reverted. Possible reasons:');
        console.error('1. User is not the long position holder');
        console.error('2. Option is not expired yet');
        console.error('3. Option is already exercised');
        console.error('4. Option is not resolved');
        console.error('5. Exercise is not profitable (priceAtExpiry <= strikePrice)');
        console.error('6. Invalid MTK amount');
      }
      
      toast.error('Failed to exercise option');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReclaim = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const getStatus = () => {
    if (!optionData) return { text: 'Loading...', class: 'funded' };
    if (optionData.isExercised) return { text: 'Exercised', class: 'exercised' };
    
    // Check if option is not engaged (not funded or not active)
    if (!optionData.isFunded || !optionData.isActive) {
      return { text: 'Not Engaged', class: 'not-engaged' };
    }
    
    // Check if expired but not resolved (only if option is engaged)
    if (optionData.expiry && Date.now() > optionData.expiry * 1000 && !optionData.isResolved) {
      return { text: 'Unresolved', class: 'expired' };
    }
    
    // Check if expired and resolved
    if (optionData.expiry && Date.now() > optionData.expiry * 1000 && optionData.isResolved) {
      return { text: 'Expired', class: 'expired' };
    }
    
    if (optionData.isActive) return { text: 'Active', class: 'filled' };
    if (optionData.isFunded) return { text: 'Funded', class: 'funded' };
    return { text: 'Created', class: 'funded' };
  };

  const status = getStatus();

  if (isLoadingOption) {
    return (
      <DetailContainer>
        <Title>Loading option details...</Title>
      </DetailContainer>
    );
  }

  if (!optionData) {
    return (
      <DetailContainer>
        <BackButton onClick={() => window.history.back()}>
          <ArrowLeft size={16} />
          Back
        </BackButton>
        <Title>Option Not Found</Title>
        <DetailCard>
          <AlertTriangle size={48} style={{ marginBottom: '1rem' }} />
          <p>The option contract could not be found or loaded.</p>
        </DetailCard>
      </DetailContainer>
    );
  }

  return (
    <DetailContainer>
             <BackButton onClick={() => window.history.back()}>
         Back to Market
       </BackButton>

      <Title>{optionData.optionType === 'CALL' ? 'Call Option' : optionData.optionType === 'PUT' ? 'Put Option' : 'Option'} Details</Title>

      <DetailCard>
        <DetailSection>
          <SectionTitle>Contract Information</SectionTitle>
          <DetailGrid>
            <DetailRow>
              <DetailLabel>Contract Address:</DetailLabel>
              <DetailValue title={contractAddress}>{formatAddress(contractAddress)}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Status:</DetailLabel>
              <DetailValue>
                <StatusBadge className={status.class}>{status.text}</StatusBadge>
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Short Position:</DetailLabel>
              <DetailValue title={optionData.short}>{formatAddress(optionData.short)}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Long Position:</DetailLabel>
              <DetailValue title={optionData.long}>{formatAddress(optionData.long)}</DetailValue>
            </DetailRow>
          </DetailGrid>
        </DetailSection>

        <DetailSection>
          <SectionTitle>Token Information</SectionTitle>
          <DetailGrid>
            <DetailRow>
              <DetailLabel>Underlying Token:</DetailLabel>
              <DetailValue>{optionData.underlyingSymbol || '2TK'} ({formatAddress(optionData.underlyingToken)})</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Strike Token:</DetailLabel>
              <DetailValue>{optionData.strikeSymbol || 'MTK'} ({formatAddress(optionData.strikeToken)})</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Strike Price:</DetailLabel>
              <DetailValue>{formatTokenAmount(optionData.strikePrice, optionData.strikeSymbol || 'MTK')}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Option Size:</DetailLabel>
              <DetailValue>{formatTokenAmount(optionData.optionSize, optionData.underlyingSymbol || '2TK')}</DetailValue>
            </DetailRow>
          </DetailGrid>
        </DetailSection>

        <DetailSection>
          <SectionTitle>Trading Information</SectionTitle>
          <DetailGrid>
            <DetailRow>
              <DetailLabel>Premium:</DetailLabel>
              <DetailValue>{formatTokenAmount(optionData.premium, optionData.strikeSymbol || 'MTK')}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Expiry:</DetailLabel>
              <DetailValue>
                {formatExpiry(optionData.expiry, optionData.isActive, optionData.isFunded)}
              </DetailValue>
            </DetailRow>
                         <DetailRow>
               <DetailLabel>Price of {optionData.underlyingSymbol || '2TK'} at Expiry:</DetailLabel>
               <DetailValue>
                 {(() => {
                   // Use resolutionStatus if available for better messaging
                   if (optionData.resolutionStatus) {
                     switch (optionData.resolutionStatus) {
                       case 'active':
                         return 'Not yet expired';
                       case 'resolved':
                         return formatTokenAmount(optionData.priceAtExpiry, optionData.strikeSymbol || 'MTK');
                       case 'exercised':
                         return formatTokenAmount(optionData.priceAtExpiry, optionData.strikeSymbol || 'MTK');
                       case 'needs_resolution':
                         return '? MTK (Needs Resolution)';
                       default:
                         return 'Status unknown';
                     }
                   } else {
                     // Fallback logic for older response format
                     const isExpired = optionData.expiry && Date.now() > optionData.expiry * 1000;
                     if (!isExpired) {
                       return 'Not yet expired';
                     } else if (optionData.isResolved) {
                       return formatTokenAmount(optionData.priceAtExpiry, optionData.strikeSymbol || 'MTK');
                     } else {
                       return 'Expired - Needs Resolution';
                     }
                   }
                 })()}
               </DetailValue>
             </DetailRow>
             
             {/* Show current live oracle price for comparison */}
             {livePrices.underlying && (
               <DetailRow>
                 <DetailLabel>Current Oracle Price:</DetailLabel>
                 <DetailValue>
                   {formatTokenAmount(livePrices.underlying.price1e18, optionData.strikeSymbol || 'MTK')}
                   <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '0.5rem' }}>
                     (Live from Oracle)
                   </span>
                   {(() => {
                     const currentPrice = Number(livePrices.underlying.price1e18);
                     const strikePrice = Number(optionData.strikePrice);
                     const isPutOption = optionData.optionType === 'PUT';
                     const isCallOption = optionData.optionType === 'CALL';
                     
                     if (isPutOption) {
                       const isProfitable = currentPrice < strikePrice;
                       return (
                         <span style={{ 
                           fontSize: '0.8em', 
                           marginLeft: '0.5rem',
                           color: isProfitable ? '#22c55e' : '#ef4444',
                           fontWeight: '500'
                         }}>
                           {isProfitable ? '✓ In the Money' : '✗ Out of the Money'}
                         </span>
                       );
                     } else if (isCallOption) {
                       const isProfitable = currentPrice > strikePrice;
                       return (
                         <span style={{ 
                           fontSize: '0.8em', 
                           marginLeft: '0.5rem',
                           color: isProfitable ? '#22c55e' : '#ef4444',
                           fontWeight: '500'
                         }}>
                           {isProfitable ? '✓ In the Money' : '✗ Out of the Money'}
                         </span>
                       );
                     }
                     return null;
                   })()}
                 </DetailValue>
               </DetailRow>
             )}
            <DetailRow>
              <DetailLabel>Options Book:</DetailLabel>
              <DetailValue title={optionData.optionsBook}>{formatAddress(optionData.optionsBook)}</DetailValue>
            </DetailRow>
          </DetailGrid>
        </DetailSection>

        <ActionButtons>
          {!optionData.isFunded && (
            <Button 
              className="primary" 
              onClick={handleFund}
              disabled={isLoading}
            >
              <DollarSign size={16} />
              Fund Option
            </Button>
          )}
          
          {!optionData.isActive && optionData.isFunded && (
            <Button 
              className="primary" 
              onClick={handleEnter}
              disabled={isLoading}
            >
              <TrendingUp size={16} />
              Enter as Long
            </Button>
          )}
          
          
          
          {(() => {
            const longMatchesAccount = optionData.long && account && optionData.long.toLowerCase() === account.toLowerCase();
            const isExpired = optionData.expiry && Date.now() > optionData.expiry * 1000;
            const canExercise = optionData.isActive && isExpired && !optionData.isExercised && longMatchesAccount;
            
            console.log('Exercise button debug:', {
              isActive: optionData.isActive,
              isExpired: isExpired,
              isResolved: optionData.isResolved,
              isExercised: optionData.isExercised,
              long: optionData.long,
              account: account,
              longMatchesAccount: longMatchesAccount,
              canExercise: canExercise
            });
            
            return canExercise && (
              <Button 
                className="secondary" 
                onClick={() => setShowExerciseInput(!showExerciseInput)}
              >
                <DollarSign size={16} />
                {showExerciseInput ? 'Hide Exercise' : 'Exercise Option'}
              </Button>
            );
          })()}
          
          {(() => {
            const shortMatchesAccount = optionData.short && account && optionData.short.toLowerCase() === account.toLowerCase();
            const isExpired = optionData.expiry && Date.now() > optionData.expiry * 1000;
            const canReclaim = optionData.isActive && isExpired && !optionData.isExercised && !optionData.isResolved && shortMatchesAccount;
            
            console.log('Reclaim button debug:', {
              isActive: optionData.isActive,
              isExpired: isExpired,
              isExercised: optionData.isExercised,
              isResolved: optionData.isResolved,
              short: optionData.short,
              account: account,
              shortMatchesAccount: shortMatchesAccount,
              canReclaim: canReclaim
            });
            
            return canReclaim && (
              <Button 
                className="secondary" 
                onClick={handleReclaim}
                disabled={isLoading}
              >
                <DollarSign size={16} />
                Reclaim Funds
              </Button>
            );
          })()}
        </ActionButtons>
      </DetailCard>

      {/* Final P&L Summary for Exercised Options */}
      {optionData?.isExercised && finalPnL && (
        <DetailCard>
          <FinalPnLSection>
            <PnLTitle>
              💰 Final Profit & Loss Summary
            </PnLTitle>
            <PnLGrid>
              <PnLCard>
                <PnLLabel>Total Cost</PnLLabel>
                <PnLValue>{finalPnL.totalCost.toFixed(2)} MTK</PnLValue>
                <PnLSubtext>Exercise + Premium Paid</PnLSubtext>
              </PnLCard>
              
              <PnLCard>
                <PnLLabel>Market Value Received</PnLLabel>
                <PnLValue positive={finalPnL.marketValueMTK > 0} {...(finalPnL.marketValueMTK === 0 && { negative: true })}>
                  {finalPnL.marketValueMTK.toFixed(2)} MTK
                </PnLValue>
                <PnLSubtext>
                  {finalPnL.isPutOption ? 
                    (finalPnL.marketValueMTK > 0 ? 
                      `Put exercised: sold ${finalPnL.twoTkAmount.toFixed(2)} ${optionData.underlyingSymbol} at strike price` :
                      `Put expired out of money - no value received`
                    ) :
                    `${finalPnL.twoTkAmount.toFixed(2)} ${optionData.underlyingSymbol} @ ${formatTokenAmount(optionData.priceAtExpiry, optionData.strikeSymbol)}`
                  }
                </PnLSubtext>
              </PnLCard>
              
              <PnLCard>
                <PnLLabel>Net Profit/Loss</PnLLabel>
                <PnLValue positive={finalPnL.netProfit > 0} {...(finalPnL.netProfit < 0 && { negative: true })}>
                  {finalPnL.netProfit > 0 ? '+' : ''}{finalPnL.netProfit.toFixed(2)} MTK
                </PnLValue>
                <PnLSubtext>{finalPnL.netProfit > 0 ? 'Profitable Trade' : 'Loss on Trade'}</PnLSubtext>
              </PnLCard>
              
              <PnLCard>
                <PnLLabel>Total Return on Investment</PnLLabel>
                <PnLValue positive={finalPnL.roiPercent > 0} {...(finalPnL.roiPercent < 0 && { negative: true })}>
                  {finalPnL.roiPercent > 0 ? '+' : ''}{finalPnL.roiPercent.toFixed(1)}%
                </PnLValue>
                <PnLSubtext>
                  {finalPnL.isPutOption ? 
                    `Price movement: ${finalPnL.percentGain > 0 ? '+' : ''}${finalPnL.percentGain.toFixed(1)}% (puts profit on decline)` :
                    `vs Strike Price: +${finalPnL.percentGain.toFixed(1)}%`
                  }
                </PnLSubtext>
              </PnLCard>
              
              <PnLCard>
                <PnLLabel>Exercise Efficiency</PnLLabel>
                <PnLValue positive>
                  {((finalPnL.twoTkAmount / (Number(optionData.optionSize) / Math.pow(10, 18))) * 100).toFixed(1)}%
                </PnLValue>
                <PnLSubtext>of Available Option Size</PnLSubtext>
              </PnLCard>
              
              <PnLCard>
                <PnLLabel>Price Movement</PnLLabel>
                <PnLValue positive={finalPnL.isPutOption ? finalPnL.percentGain < 0 : finalPnL.percentGain > 0}>
                  {formatTokenAmount(optionData.strikePrice, optionData.strikeSymbol)} → {formatTokenAmount(optionData.priceAtExpiry, optionData.strikeSymbol)}
                </PnLValue>
                <PnLSubtext>
                  {finalPnL.isPutOption ? 
                    (finalPnL.percentGain < 0 ? 'Favorable for Put (price fell)' : 'Unfavorable for Put (price rose)') :
                    'Strike to Expiry Price'
                  }
                </PnLSubtext>
              </PnLCard>
            </PnLGrid>
          </FinalPnLSection>
        </DetailCard>
      )}

      {(() => {
        const longMatchesAccount = optionData.long && account && optionData.long.toLowerCase() === account.toLowerCase();
        console.log('Exercise input section debug:', {
          showExerciseInput,
          isActive: optionData.isActive,
          isExercised: optionData.isExercised,
          long: optionData.long,
          account: account,
          longMatchesAccount: longMatchesAccount,
          shouldShow: showExerciseInput && optionData.isActive && !optionData.isExercised && longMatchesAccount
        });
        return showExerciseInput && optionData.isActive && !optionData.isExercised && longMatchesAccount && (
        <DetailCard>
          <ExerciseInputSection>
            <ExerciseTitle>Exercise Option</ExerciseTitle>
            
            {/* Live Price Section */}
            {optionData && showExerciseInput && (
              <LivePriceSection>
                <LivePriceTitle>
                  🔴 Live Oracle Prices
                  {priceLoading && <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem' }}>Updating...</span>}
                </LivePriceTitle>
                <LivePriceGrid>
                  <LivePriceCard>
                    <LivePriceLabel>{optionData.underlyingSymbol || '2TK'} Current Price</LivePriceLabel>
                    <LivePriceValue>
                      {livePrices.underlying ? 
                        `${parseFloat(livePrices.underlying.priceFormatted).toFixed(4)} ${optionData.strikeSymbol || 'MTK'}` :
                        'Loading...'
                      }
                    </LivePriceValue>
                    <LivePriceTime>
                      {livePrices.underlying ? 
                        `Updated: ${new Date(livePrices.underlying.lastUpdatedDate).toLocaleTimeString()}` :
                        'Fetching from oracle...'
                      }
                    </LivePriceTime>
                  </LivePriceCard>
                  
                  <LivePriceCard>
                    <LivePriceLabel>Strike Price</LivePriceLabel>
                    <LivePriceValue style={{ color: '#667eea' }}>
                      {formatTokenAmount(optionData.strikePrice, optionData.strikeSymbol)}
                    </LivePriceValue>
                    <LivePriceTime>Contract fixed price</LivePriceTime>
                  </LivePriceCard>
                  
                  <LivePriceCard>
                    <LivePriceLabel>Price at Expiry</LivePriceLabel>
                    <LivePriceValue style={{ color: optionData.priceAtExpiry && optionData.priceAtExpiry !== '0' ? '#22c55e' : '#fbbf24' }}>
                      {optionData.priceAtExpiry && optionData.priceAtExpiry !== '0' ? 
                        formatTokenAmount(optionData.priceAtExpiry, optionData.strikeSymbol) :
                        'To be resolved'
                      }
                    </LivePriceValue>
                    <LivePriceTime>
                      {optionData.isResolved ? 'Resolved' : 'Pending resolution'}
                    </LivePriceTime>
                  </LivePriceCard>
                  
                  {livePrices.underlying && (
                    <LivePriceCard>
                      <LivePriceLabel>Profit Potential</LivePriceLabel>
                      <LivePriceValue style={{ 
                        color: livePrices.underlying && parseFloat(livePrices.underlying.priceFormatted) > parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) ? 
                          '#22c55e' : '#ef4444' 
                      }}>
                        {livePrices.underlying ? 
                          `${(parseFloat(livePrices.underlying.priceFormatted) > parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) ? '+' : '')}${(parseFloat(livePrices.underlying.priceFormatted) - parseFloat(ethers.formatUnits(optionData.strikePrice, 18))).toFixed(4)} MTK` :
                          'Calculating...'
                        }
                        <PriceChangeIndicator 
                          positive={livePrices.underlying && parseFloat(livePrices.underlying.priceFormatted) > parseFloat(ethers.formatUnits(optionData.strikePrice, 18))}
                          {...(livePrices.underlying && parseFloat(livePrices.underlying.priceFormatted) < parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) && { negative: true })}
                        >
                          {livePrices.underlying && parseFloat(livePrices.underlying.priceFormatted) > parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) ? '📈' : 
                           livePrices.underlying && parseFloat(livePrices.underlying.priceFormatted) < parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) ? '📉' : '⏳'}
                        </PriceChangeIndicator>
                      </LivePriceValue>
                      <LivePriceTime>Based on live price</LivePriceTime>
                    </LivePriceCard>
                  )}
                </LivePriceGrid>
              </LivePriceSection>
            )}
            
            {/* Exercise Summary - Auto-calculated at maximum */}
            {exerciseMetrics && (
              <ExerciseSummary>
                <SummaryTitle>📊 Exercise Analysis (Max Amount: {exerciseMetrics.maxSpendable.toFixed(2)} MTK)</SummaryTitle>
                
                {!exerciseMetrics.isResolved && (
                  <div style={{ 
                    background: 'rgba(255, 193, 7, 0.1)', 
                    border: '1px solid rgba(255, 193, 7, 0.3)', 
                    borderRadius: '8px', 
                    padding: '1rem', 
                    marginBottom: '1rem',
                    color: '#ffc107'
                  }}>
                    ⚠️ <strong>Option not yet resolved</strong> - Price at expiry will be determined when you exercise. 
                    The analysis below shows potential outcomes based on current market conditions.
                  </div>
                )}
                <SummaryGrid>
                  <HighlightCard>
                    <HighlightLabel>You will receive:</HighlightLabel>
                    <HighlightValue positive>{exerciseMetrics.twoTkAmount.toFixed(2)} {optionData.underlyingSymbol}</HighlightValue>
                  </HighlightCard>
                  
                  <HighlightCard>
                    <HighlightLabel>Total Cost (Exercise + Premium)</HighlightLabel>
                    <HighlightValue>{exerciseMetrics.totalCost.toFixed(2)} MTK</HighlightValue>
                  </HighlightCard>
                  
                  {exerciseMetrics.isResolved ? (
                    <>
                      <HighlightCard>
                        <HighlightLabel>Market Value Received</HighlightLabel>
                        <HighlightValue positive>{exerciseMetrics.marketValueMTK.toFixed(2)} MTK</HighlightValue>
                      </HighlightCard>
                      
                      <HighlightCard>
                        <HighlightLabel>Net Profit/Loss</HighlightLabel>
                        <HighlightValue positive={exerciseMetrics.netProfit > 0} {...(exerciseMetrics.netProfit < 0 && { negative: true })}>
                          {exerciseMetrics.netProfit > 0 ? '+' : ''}{exerciseMetrics.netProfit.toFixed(2)} MTK
                        </HighlightValue>
                      </HighlightCard>
                      
                      <HighlightCard>
                        <HighlightLabel>Total ROI</HighlightLabel>
                        <HighlightValue positive={exerciseMetrics.roiPercent > 0} {...(exerciseMetrics.roiPercent < 0 && { negative: true })}>
                          {exerciseMetrics.roiPercent > 0 ? '+' : ''}{exerciseMetrics.roiPercent.toFixed(2)}%
                        </HighlightValue>
                      </HighlightCard>
                    </>
                  ) : (
                    <>
                      <HighlightCard>
                        <HighlightLabel>Price at Expiry</HighlightLabel>
                        <HighlightValue>Will be determined</HighlightValue>
                      </HighlightCard>
                      
                      <HighlightCard>
                        <HighlightLabel>Profit Potential</HighlightLabel>
                        <HighlightValue positive>Depends on market price</HighlightValue>
                      </HighlightCard>
                    </>
                  )}
                </SummaryGrid>
              </ExerciseSummary>
            )}
            
            {/* Live Price Projections */}
            {liveExerciseMetrics && livePrices.underlying && (
              <ExerciseSummary style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                borderColor: 'rgba(16, 185, 129, 0.3)' 
              }}>
                <SummaryTitle style={{ color: '#10b981' }}>
                  📊 Live Price Projections (If Exercised Now at Current Market Price)
                </SummaryTitle>
                <SummaryGrid>
                  <HighlightCard>
                    <HighlightLabel>Current Market Price</HighlightLabel>
                    <HighlightValue style={{ color: '#10b981' }}>
                      {liveExerciseMetrics.livePriceValue?.toFixed(4)} {optionData.strikeSymbol}
                    </HighlightValue>
                  </HighlightCard>
                  
                  <HighlightCard>
                    <HighlightLabel>Projected Market Value</HighlightLabel>
                    <HighlightValue positive>{liveExerciseMetrics.marketValueMTK.toFixed(2)} MTK</HighlightValue>
                  </HighlightCard>
                  
                  <HighlightCard>
                    <HighlightLabel>Projected Net Profit/Loss</HighlightLabel>
                    <HighlightValue 
                      positive={liveExerciseMetrics.netProfit > 0} 
                      {...(liveExerciseMetrics.netProfit < 0 && { negative: true })}
                    >
                      {liveExerciseMetrics.netProfit > 0 ? '+' : ''}{liveExerciseMetrics.netProfit.toFixed(2)} MTK
                    </HighlightValue>
                  </HighlightCard>
                  
                  <HighlightCard>
                    <HighlightLabel>Projected ROI</HighlightLabel>
                    <HighlightValue 
                      positive={liveExerciseMetrics.roiPercent > 0} 
                      {...(liveExerciseMetrics.roiPercent < 0 && { negative: true })}
                    >
                      {liveExerciseMetrics.roiPercent > 0 ? '+' : ''}{liveExerciseMetrics.roiPercent.toFixed(2)}%
                    </HighlightValue>
                  </HighlightCard>
                  
                  <HighlightCard>
                    <HighlightLabel>Price Difference vs Strike</HighlightLabel>
                    <HighlightValue 
                      positive={liveExerciseMetrics.livePriceValue > parseFloat(ethers.formatUnits(optionData.strikePrice, 18))} 
                      {...(liveExerciseMetrics.livePriceValue < parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) && { negative: true })}
                    >
                      {liveExerciseMetrics.livePriceValue > parseFloat(ethers.formatUnits(optionData.strikePrice, 18)) ? '+' : ''}
                      {(liveExerciseMetrics.livePriceValue - parseFloat(ethers.formatUnits(optionData.strikePrice, 18))).toFixed(4)} MTK
                    </HighlightValue>
                  </HighlightCard>
                  
                  <HighlightCard>
                    <HighlightLabel>Exercise Recommendation</HighlightLabel>
                    <HighlightValue 
                      positive={liveExerciseMetrics.netProfit > 0}
                      {...(liveExerciseMetrics.netProfit <= 0 && { negative: true })}
                    >
                      {liveExerciseMetrics.netProfit > 0 ? '✅ Profitable' : '❌ Not Profitable'}
                    </HighlightValue>
                  </HighlightCard>
                </SummaryGrid>
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                  borderRadius: '8px', 
                  fontSize: '0.85rem', 
                  opacity: 0.8 
                }}>
                  💡 These projections use live oracle prices and may differ from the final resolved price at exercise.
                </div>
              </ExerciseSummary>
            )}
            
            <div>
              {(() => {
                const isPutOption = optionData?.optionType === 'PUT';
                const tokenSymbol = isPutOption ? optionData?.underlyingSymbol : optionData?.strikeSymbol;
                const actionText = isPutOption ? 'sell' : 'spend';
                const maxAmount = exerciseMetrics?.maxSpendable?.toFixed(2) || '0';
                
                return (
                  <>
                    <label>Amount to {actionText} ({tokenSymbol}):</label>
                    <ExerciseInput
                      type="number"
                      value={exerciseAmount}
                      onChange={(e) => setExerciseAmount(e.target.value)}
                      placeholder={`Max: ${maxAmount} ${tokenSymbol}`}
                      className={exerciseMetrics?.exceedsLimit ? 'error' : ''}
                      step="0.01"
                      min="0"
                    />
                  </>
                );
              })()}
            </div>

            {exerciseMetrics && exerciseAmount && exerciseAmount !== exerciseMetrics.maxSpendable.toFixed(2) && (
              <ExerciseMetrics>
                                 <MetricCard>
                   <MetricLabel>You will receive:</MetricLabel>
                   <MetricValue>{exerciseMetrics.twoTkAmount.toFixed(2)} {optionData.underlyingSymbol}</MetricValue>
                 </MetricCard>
                 
                                   <MetricCard>
                    <MetricLabel>Compared to Market Price:</MetricLabel>
                    <MetricValue positive><span style={{ color: '#22c55e', fontSize: '1.1rem' }}>2x</span></MetricValue>
                  </MetricCard>
                 
                 
                 
                 <MetricCard>
                   <MetricLabel>Total ROI:</MetricLabel>
                   <MetricValue positive={exerciseMetrics.roiPercent > 0} {...(exerciseMetrics.roiPercent < 0 && { negative: true })}>
                     {exerciseMetrics.roiPercent > 0 ? '+' : ''}{exerciseMetrics.roiPercent.toFixed(2)}%
                   </MetricValue>
                 </MetricCard>
              </ExerciseMetrics>
            )}

            {exerciseMetrics?.exceedsLimit && (
              <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
                ⚠️ Amount exceeds maximum. Maximum spendable: {exerciseMetrics.maxSpendable.toFixed(2)} MTK
              </div>
            )}

            <ExerciseButtons>
              <Button 
                className="primary" 
                onClick={handleExercise}
                disabled={isLoading || !exerciseAmount || exerciseAmount <= 0 || exerciseMetrics?.exceedsLimit}
              >
                <DollarSign size={16} />
                {isLoading ? 'Exercising...' : 'Execute Exercise'}
              </Button>
              
              <Button 
                className="secondary" 
                onClick={() => setExerciseAmount(exerciseMetrics?.maxSpendable?.toFixed(2) || '0')}
              >
                Use Maximum
              </Button>
            </ExerciseButtons>
          </ExerciseInputSection>
        </DetailCard>
      );
      })()}
    </DetailContainer>
  );
};

export default OptionDetail; 