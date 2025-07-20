
import React from 'react';
import LoginForm from '@/components/LoginForm';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Dashboard />;
  }
  return <LoginForm />;
};

export default Index;
