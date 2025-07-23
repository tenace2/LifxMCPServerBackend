#!/bin/bash

# =============================================================
# PASTE YOUR API KEYS HERE (replace the placeholder values)
# =============================================================

CLAUDE_KEY="sk-ant-your-claude-key-here"    # ← Paste your Claude key here
LIFX_KEY="your-lifx-key-here"               # ← Paste your LIFX key here

# =============================================================
# Don't change anything below this line
# =============================================================

SERVER_URL="http://localhost:3001"
SESSION_ID="simple-test-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Simple Claude Chat Test${NC}\n"

# Check if keys are still placeholders
if [[ "$CLAUDE_KEY" == "sk-ant-your-claude-key-here" ]] || [[ "$LIFX_KEY" == "your-lifx-key-here" ]]; then
    echo -e "${RED}❌ Please update the API keys at the top of this script!${NC}"
    echo -e "${YELLOW}Edit lines 6-7 with your actual keys:${NC}"
    echo -e "  CLAUDE_KEY=\"sk-ant-your-actual-key\""
    echo -e "  LIFX_KEY=\"your-actual-lifx-key\""
    echo -e "\nThen run: ${BLUE}./simple-test.sh${NC}\n"
    exit 1
fi

echo -e "✅ Keys configured, running tests...\n"

# Test 1: System prompt ENABLED (should decline)
echo -e "${YELLOW}🔒 Test 1: System Prompt ENABLED - Should decline non-lighting questions${NC}"
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "What is the capital of France?",
    "systemPromptEnabled": true,
    "maxTokens": 300
  }' 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "What is the capital of France?",
    "systemPromptEnabled": true,
    "maxTokens": 300
  }'

echo -e "\n${GREEN}----------------------------------------${NC}\n"

# Test 2: System prompt DISABLED (should answer)
echo -e "${YELLOW}🔓 Test 2: System Prompt DISABLED - Should answer normally${NC}"
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "What is the capital of France?",
    "systemPromptEnabled": false,
    "maxTokens": 300
  }' 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "What is the capital of France?",
    "systemPromptEnabled": false,
    "maxTokens": 300
  }'

echo -e "\n${GREEN}----------------------------------------${NC}\n"

echo -e "${BLUE}📊 Analysis:${NC}"
echo -e "• Test 1 should decline and redirect to lighting topics"
echo -e "• Test 2 should answer: 'The capital of France is Paris'"
echo -e "• If both responses are similar, there may be an issue with the systemPromptEnabled parameter"
echo -e "\n${YELLOW}Session ID used: ${SESSION_ID}${NC}"
