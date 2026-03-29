#!/bin/bash
echo "🧋 Setting up Boba POS Backend..."
npm install

echo "🧋 Setting up Boba POS Frontend..."
cd client
npm install
cd ..

echo "🚀 Starting both servers..."
npm run dev
