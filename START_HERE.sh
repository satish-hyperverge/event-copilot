#!/bin/bash

echo "🚀 Starting Hackathon Application with LinkedIn Integration"
echo "=========================================================="
echo ""

# Kill any existing processes
echo "🧹 Cleaning up old processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start backend
echo ""
echo "🔧 Starting Backend (port 8000)..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "   Waiting for backend to initialize..."
sleep 5

# Test backend
echo "   Testing backend..."
if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo "   ✅ Backend is running on http://localhost:8000"
    echo "   ✅ LinkedIn automation configured"
else
    echo "   ❌ Backend failed to start. Check backend.log"
    exit 1
fi

# Start frontend
echo ""
echo "🎨 Starting Frontend (port 5173)..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend
echo "   Waiting for frontend to build..."
sleep 3

echo ""
echo "=========================================================="
echo "✅ Application is running!"
echo "=========================================================="
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "🔗 LinkedIn Integration:"
echo "   - Auto-fetch: ✅ Ready"
echo "   - Status: http://localhost:8000/linkedin/status"
echo ""
echo "📋 Logs:"
echo "   - Backend:  tail -f backend.log"
echo "   - Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop: pkill -f uvicorn && pkill -f vite"
echo ""
echo "🎉 Ready to go! Open http://localhost:5173 in your browser"
echo ""
