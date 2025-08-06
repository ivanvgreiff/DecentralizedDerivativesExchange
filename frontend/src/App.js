import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import styled from 'styled-components';

// Components
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import OptionsMarket from './pages/OptionsMarket';
import MyOptions from './pages/MyOptions';
import CreateOption from './pages/CreateOption';
import OptionDetail from './pages/OptionDetail';

// Context
import { WalletProvider } from './context/WalletContext';

// Styles
const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
`;

const MainContent = styled.main`
  padding: 40px 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 80px);
  
  @media (max-width: 768px) {
    padding: 20px 15px;
  }
`;

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <Router>
          <AppContainer>
            <Header />
            <MainContent>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/market" element={<OptionsMarket />} />
                <Route path="/my-options" element={<MyOptions />} />
                <Route path="/create" element={<CreateOption />} />
                <Route path="/option/:contractAddress" element={<OptionDetail />} />
              </Routes>
            </MainContent>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </AppContainer>
        </Router>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App; 