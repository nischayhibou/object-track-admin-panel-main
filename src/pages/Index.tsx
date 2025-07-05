
import React, { useState } from 'react';
import LoginForm from '@/components/LoginForm';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    setLoginError('');
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock authentication - replace with real authentication when Supabase is connected
    if (username === 'admin' && password === 'password123') {
      setCurrentUser(username);
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid username or password. Try admin/password123');
    }
    
    setLoading(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser('');
    setLoginError('');
  };

  if (isAuthenticated) {
    return <Dashboard onLogout={handleLogout} username={currentUser} />;
  }

  return (
    <LoginForm 
      onLogin={handleLogin} 
      error={loginError}
      loading={loading}
    />
  );
};

export default Index;
