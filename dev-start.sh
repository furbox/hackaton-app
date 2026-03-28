#!/usr/bin/env bash
# Development startup script - ensures clean ports before starting

set -e

echo "🚀 Starting URLoft Development Environment"
echo "==========================================="
echo ""

# Kill any existing bun processes to avoid port conflicts
echo "🧹 Cleaning up existing bun processes..."
pkill -9 bun 2>/dev/null || true
sleep 1

# Check if ports are available
BACKEND_PORT=${BACKEND_PORT:-3000}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

echo "🔍 Checking ports..."
echo "   Backend:  $BACKEND_PORT"
echo "   Frontend: $FRONTEND_PORT"
echo ""

# Function to check if port is in use
port_in_use() {
  lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an | grep ":$1 " | grep LISTEN >/dev/null 2>&1
}

# Check backend port
if port_in_use $BACKEND_PORT; then
  echo "⚠️  Port $BACKEND_PORT is in use. Attempting to free it..."
  lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
  sleep 1
  if port_in_use $BACKEND_PORT; then
    echo "❌ Failed to free port $BACKEND_PORT. Please manually kill the process."
    exit 1
  fi
fi

# Check frontend port
if port_in_use $FRONTEND_PORT; then
  echo "⚠️  Port $FRONTEND_PORT is in use. Attempting to free it..."
  lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
  sleep 1
  if port_in_use $FRONTEND_PORT; then
    echo "❌ Failed to free port $FRONTEND_PORT. Please manually kill the process."
    exit 1
  fi
fi

echo "✅ Ports are available"
echo ""

# Start backend
echo "🔧 Starting backend on port $BACKEND_PORT..."
cd backend
PORT=$BACKEND_PORT bun run index.ts &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
cd ..

sleep 2

# Verify backend started
if ! port_in_use $BACKEND_PORT; then
  echo "❌ Backend failed to start on port $BACKEND_PORT"
  exit 1
fi

echo "✅ Backend started successfully"
echo ""

# Start frontend
echo "🎨 Starting frontend on port $FRONTEND_PORT..."
cd frontend-bun-ejs
PORT=$FRONTEND_PORT bun run index.ts &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
cd ..

sleep 2

# Verify frontend started
if ! port_in_use $FRONTEND_PORT; then
  echo "❌ Frontend failed to start on port $FRONTEND_PORT"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

echo "✅ Frontend started successfully"
echo ""

echo "🎉 All systems operational!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "💡 To stop both servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   Or: pkill -f 'bun.*index.ts'"
echo ""
echo "🔍 View logs:"
echo "   Backend:  tail -f backend/logs/*.log 2>/dev/null or check console"
echo "   Frontend: Check console output"
echo ""

# Keep script running
wait
