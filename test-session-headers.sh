#!/bin/bash

# Test script for session tracking headers
# This script tests the LIFX MCP Server Backend session tracking functionality

echo "🧪 Testing LIFX MCP Server Backend Session Headers"
echo "=================================================="

# Configuration
SERVER_URL="http://localhost:3001"
DEMO_KEY="LifxDemo"  # Default demo key
SESSION_ID="test-session-$(date +%s)"  # Unique session ID
DUMMY_LIFX_KEY="lifx_test_key_1234567890123456789012345678901234567890"
DUMMY_CLAUDE_KEY="sk-ant-api03-test_key_1234567890123456789012345678901234567890123456789012345678901234567890"

echo "📋 Test Configuration:"
echo "   Server URL: $SERVER_URL"
echo "   Session ID: $SESSION_ID"
echo "   Demo Key: $DEMO_KEY"
echo ""

# Test 1: Simple session info endpoint (should not increment counter)
echo "🔍 Test 1: Get session info (no counter increment)"
echo "---------------------------------------------------"
curl -s -i -X GET "$SERVER_URL/api/session-info" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: $DEMO_KEY" \
  -H "x-session-id: $SESSION_ID" | head -20

echo -e "\n"

# Test 2: Test Claude endpoint (should increment counter)
echo "🤖 Test 2: Claude API call (should increment counter)"
echo "----------------------------------------------------"
curl -s -i -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: $DEMO_KEY" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$DUMMY_CLAUDE_KEY'",
    "lifxApiKey": "'$DUMMY_LIFX_KEY'",
    "message": "Hello, test message",
    "systemPromptEnabled": true,
    "maxTokens": 100
  }' | head -20

echo -e "\n"

# Test 3: Test LIFX direct control (should increment counter)
echo "💡 Test 3: LIFX direct control call (should increment counter)"
echo "------------------------------------------------------------"
curl -s -i -X POST "$SERVER_URL/api/lifx/list_lights" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: $DEMO_KEY" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "lifxApiKey": "'$DUMMY_LIFX_KEY'",
    "selector": "all"
  }' | head -20

echo -e "\n"

# Test 4: Get session info again to see updated counters
echo "📊 Test 4: Get updated session info"
echo "-----------------------------------"
curl -s -i -X GET "$SERVER_URL/api/session-info" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: $DEMO_KEY" \
  -H "x-session-id: $SESSION_ID" | head -20

echo -e "\n"

# Test 5: Extract and display only the session headers
echo "🎯 Test 5: Extract session headers from multiple requests"
echo "========================================================="

echo "Making 3 consecutive requests to increment counter..."
for i in {1..3}; do
  echo "Request $i:"
  HEADERS=$(curl -s -I -X POST "$SERVER_URL/api/lifx/list_lights" \
    -H "Content-Type: application/json" \
    -H "x-demo-key: $DEMO_KEY" \
    -H "x-session-id: $SESSION_ID" \
    -d '{
      "lifxApiKey": "'$DUMMY_LIFX_KEY'",
      "selector": "all"
    }')
  
  echo "$HEADERS" | grep -i "x-requests-"
  echo "$HEADERS" | grep -i "x-daily-limit"
  echo "---"
done

echo -e "\n"
echo "✅ Test completed! Check the X-Requests-Used, X-Requests-Remaining, and X-Daily-Limit headers above."
echo "📈 The counters should increment with each request that uses sessionLimiter middleware."
