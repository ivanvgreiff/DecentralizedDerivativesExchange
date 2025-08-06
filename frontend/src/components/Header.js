import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useWallet } from '../context/WalletContext';
import { Wallet, TrendingUp, Plus, User } from 'lucide-react';

const HeaderContainer = styled.header`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1.25rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  gap: 1rem;
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;



const NavLinks = styled.div`
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.active {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const WalletButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  
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

const AccountInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  color: white;
`;

const AccountAddress = styled.span`
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.9rem;
`;

const DisconnectButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const Header = () => {
  const { account, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const formatAddress = (address) => {
    return address;
  };

  return (
    <HeaderContainer>
      <Nav>
        <Logo to="/">
          DDX Protocol
        </Logo>
        
        <NavLinks>
          <NavLink to="/" className={isActive('/') ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/market" className={isActive('/market') ? 'active' : ''}>
            Options Book
          </NavLink>
          <NavLink to="/my-options" className={isActive('/my-options') ? 'active' : ''}>
            Futures Book
          </NavLink>
          <NavLink to="/functions" className={isActive('/functions') ? 'active' : ''}>
            Genie Book
          </NavLink>
          <NavLink to="/create" className={isActive('/create') ? 'active' : ''}>
            <Plus size={16} />
            Draft Contract
          </NavLink>
          
          {account ? (
            <AccountInfo>
              <AccountAddress>{formatAddress(account)}</AccountAddress>
              <DisconnectButton onClick={disconnectWallet}>
                Disconnect
              </DisconnectButton>
            </AccountInfo>
          ) : (
            <WalletButton onClick={connectWallet} disabled={isConnecting}>
              <Wallet size={16} />
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </WalletButton>
          )}
        </NavLinks>
      </Nav>
    </HeaderContainer>
  );
};

export default Header; 