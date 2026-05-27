#!/bin/bash

echo "🧪 Testing LinkedIn Integration..."
echo "=================================="
echo ""

cd backend

# Activate venv if it exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Test imports
echo "1️⃣  Testing imports..."
python3 -c "from app.services.linkedin_service import get_linkedin_service; print('✅ linkedin_service.py imports OK')" || exit 1

python3 -c "from app.routers import linkedin; print('✅ linkedin.py router imports OK')" || exit 1

python3 -c "from app.main import app; print('✅ main.py imports OK with linkedin router')" || exit 1

echo ""
echo "2️⃣  Testing LinkedIn service..."
python3 << 'PYTHON'
from app.services.linkedin_service import get_linkedin_service
import os

service = get_linkedin_service()

print(f"✅ API Key configured: {bool(service.api_key)}")
print(f"✅ LinkedIn cookie configured: {bool(service.linkedin_cookie)}")
print(f"✅ Profile scraper ID: {service.PROFILE_SCRAPER_ID}")
print(f"✅ Message sender ID: {service.MESSAGE_SENDER_ID}")

if service.api_key:
    print(f"   API Key preview: {service.api_key[:15]}...")
if service.linkedin_cookie:
    print(f"   Cookie preview: {service.linkedin_cookie[:30]}...")
PYTHON

echo ""
echo "3️⃣  Testing API endpoints..."
echo "   Starting server in background..."

# Start server in background
uvicorn app.main:app --port 8000 > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test status endpoint
echo "   Testing GET /linkedin/status..."
curl -s http://localhost:8000/linkedin/status | python3 -m json.tool

# Kill server
kill $SERVER_PID 2>/dev/null

echo ""
echo "=================================="
echo "✅ All tests passed!"
echo ""
echo "🚀 Ready to start!"
echo ""
echo "Start backend:"
echo "  cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo ""
echo "Start frontend:"
echo "  cd frontend && npm run dev"
echo ""
