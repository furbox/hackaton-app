#!/usr/bin/env bash
# Script to check if ports are in use before starting servers

PORT=${1:-3000}
SERVICE_NAME=${2:-"Backend"}

echo "🔍 Checking if port $PORT is in use..."

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an | grep ":$PORT " | grep LISTEN >/dev/null 2>&1; then
  echo "⚠️  Port $PORT is already in use!"
  echo ""
  echo "Process using port $PORT:"
  lsof -i :$PORT 2>/dev/null || netstat -an | grep ":$PORT " | head -5
  echo ""
  echo "💡 Solutions:"
  echo "   1. Kill the process: pkill -f 'bun.*$PORT'"
  echo "   2. Use a different port: PORT=$PORT+1 bun run dev"
  echo "   3. Find and kill manually: lsof -ti:$PORT | xargs kill -9"
  exit 1
else
  echo "✅ Port $PORT is available for $SERVICE_NAME"
  exit 0
fi
