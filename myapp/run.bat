@echo off
echo 🧋 Setting up Boba POS Backend...
call npm install

echo 🧋 Setting up Boba POS Frontend...
cd client
call npm install
cd ..

echo 🚀 Starting both servers...
call npm run dev
