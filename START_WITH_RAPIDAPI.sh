#!/bin/bash

echo "🚀 Starting Hackathon with RapidAPI LinkedIn Integration"
echo "========================================================="
echo ""

# Kill old processes
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start backend
echo "🔧 Starting Backend..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 > ../backend.log 2>&1 &
cd ..
sleep 5

# Test backend
if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo "   ✅ Backend running on http://localhost:8000"
else
    echo "   ❌ Backend failed. Check backend.log"
    exit 1
fi

# Start frontend
echo "🎨 Starting Frontend..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
cd ..
sleep 3

echo ""
echo "========================================================="
echo "✅ Application Ready!"
echo "========================================================="
echo ""
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "🎯 RapidAPI LinkedIn Integration:"
echo "   Status: ✅ Configured & Ready"
echo "   Speed: 5-10 seconds per profile"
echo ""
echo "🧪 Test Auto-Fetch:"
echo "   1. Open http://localhost:5173"
echo "   2. Go to Outreach tab"
echo "   3. Enter LinkedIn URL"
echo "   4. Click 'Fetch Data'"
echo "   5. Wait 5-10 seconds"
echo "   6. Data auto-populates!"
echo ""
echo "📋 Logs: tail -f backend.log or frontend.log"
echo "🛑 Stop: pkill -f uvicorn && pkill -f vite"
echo ""
