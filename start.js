#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

console.log('🚀 Starting Object Track Admin Panel...\n');

// Check if .env file exists
const envPath = join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Creating from template...');
  const envExamplePath = join(__dirname, 'env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created from template');
  } else {
    console.error('❌ env.example file not found');
    process.exit(1);
  }
}

// Check required environment variables
const requiredEnvVars = [
  'PORT',
  'API_KEY',
  'JWT_SECRET',
  'DB_USER',
  'DB_HOST',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_PORT'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.log('Please check your .env file');
  process.exit(1);
}

console.log('✅ Environment variables validated');

// Check if node_modules exists
const nodeModulesPath = join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  const install = spawn('npm', ['install'], { stdio: 'inherit' });
  
  install.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
    console.log('✅ Dependencies installed');
    startServer();
  });
} else {
  console.log('✅ Dependencies found');
  startServer();
}

function startServer() {
  console.log('🔧 Starting server...\n');
  
  const server = spawn('node', ['server.js'], { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
  });

  server.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Server exited with code ${code}`);
      process.exit(code);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    server.kill('SIGTERM');
  });
} 