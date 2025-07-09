#!/bin/bash

# LIFX MCP Server - Claude Chat Testing with curl
# This script provides various curl commands to test the Claude chat functionality
# and system prompt behavior

set -e  # Exit on any error

# Configuration
SERVER_URL="http://localhost:3001"
SESSION_ID="curl-test-session-$(date +%s)"
DEMO_KEY="LifxDemo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 LIFX MCP Server - Claude Chat Testing with curl${NC}"
echo -e "${BLUE}======================================================${NC}\n"

# You MUST update these with your actual API keys
CLAUDE_API_KEY="sk-ant-your-claude-key-here"
LIFX_API_KEY="your-lifx-api-key-here"

# Check if API keys are still placeholders
if [[ "$CLAUDE_API_KEY" == "sk-ant-your-claude-key-here" ]] || [[ "$LIFX_API_KEY" == "your-lifx-api-key-here" ]]; then
    echo -e "${RED}❌ Please update the API keys in this script first!${NC}"
    echo -e "${YELLOW}Edit lines 17-18 with your actual API keys:${NC}"
    echo -e "  CLAUDE_API_KEY=\"sk-ant-your-real-claude-key\""
    echo -e "  LIFX_API_KEY=\"your-real-lifx-api-key\"\n"
    exit 1
fi

echo -e "Session ID: ${SESSION_ID}"
echo -e "Server URL: ${SERVER_URL}\n"

# Function to make curl request with standard headers
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local description="$4"
    
    echo -e "${YELLOW}📡 ${description}${NC}"
    echo -e "${BLUE}${method} ${SERVER_URL}${endpoint}${NC}"
    
    if [[ "$method" == "GET" ]]; then
        curl -s -w "\nHTTP Status: %{http_code}\n" \
             -H "Content-Type: application/json" \
             -H "x-demo-key: ${DEMO_KEY}" \
             -H "x-session-id: ${SESSION_ID}" \
             "${SERVER_URL}${endpoint}"
    else
        curl -s -w "\nHTTP Status: %{http_code}\n" \
             -X "$method" \
             -H "Content-Type: application/json" \
             -H "x-demo-key: ${DEMO_KEY}" \
             -H "x-session-id: ${SESSION_ID}" \
             -d "$data" \
             "${SERVER_URL}${endpoint}"
    fi
    
    echo -e "\n${GREEN}✓ Request completed${NC}\n"
    echo "----------------------------------------"
}

# Test 1: Health check (no auth required)
echo -e "${GREEN}🏥 Test 1: Health Check${NC}"
curl -s "${SERVER_URL}/health" | jq '.' 2>/dev/null || curl -s "${SERVER_URL}/health"
echo -e "\n----------------------------------------"

# Test 2: API Info (no auth required)
echo -e "${GREEN}📋 Test 2: API Information${NC}"
curl -s "${SERVER_URL}/api/info" | jq '.' 2>/dev/null || curl -s "${SERVER_URL}/api/info"
echo -e "\n----------------------------------------"

# Test 3: Claude Chat with System Prompt ENABLED (default behavior)
echo -e "${GREEN}🤖 Test 3: Claude Chat - System Prompt ENABLED${NC}"
echo -e "${YELLOW}This should decline non-lighting questions and redirect to lighting topics${NC}"

ENABLED_REQUEST='{
  "claudeApiKey": "'$CLAUDE_API_KEY'",
  "lifxApiKey": "'$LIFX_API_KEY'",
  "message": "What is the capital of France? I need this for a geography quiz.",
  "systemPromptEnabled": true,
  "maxTokens": 500
}'

make_request "POST" "/api/claude" "$ENABLED_REQUEST" "System Prompt ENABLED - Non-lighting question"

# Test 4: Claude Chat with System Prompt DISABLED
echo -e "${GREEN}🤖 Test 4: Claude Chat - System Prompt DISABLED${NC}"
echo -e "${YELLOW}This should answer the general question normally${NC}"

DISABLED_REQUEST='{
  "claudeApiKey": "'$CLAUDE_API_KEY'",
  "lifxApiKey": "'$LIFX_API_KEY'",
  "message": "What is the capital of France? I need this for a geography quiz.",
  "systemPromptEnabled": false,
  "maxTokens": 500
}'

make_request "POST" "/api/claude" "$DISABLED_REQUEST" "System Prompt DISABLED - Same non-lighting question"

# Test 5: Lighting question with System Prompt ENABLED
echo -e "${GREEN}💡 Test 5: Lighting Question - System Prompt ENABLED${NC}"
echo -e "${YELLOW}This should work normally and attempt to control lights${NC}"

LIGHTING_ENABLED_REQUEST='{
  "claudeApiKey": "'$CLAUDE_API_KEY'",
  "lifxApiKey": "'$LIFX_API_KEY'",
  "message": "Turn on all my lights and set them to a warm white color",
  "systemPromptEnabled": true,
  "maxTokens": 500
}'

make_request "POST" "/api/claude" "$LIGHTING_ENABLED_REQUEST" "Lighting question with system prompt enabled"

# Test 6: Lighting question with System Prompt DISABLED
echo -e "${GREEN}💡 Test 6: Lighting Question - System Prompt DISABLED${NC}"
echo -e "${YELLOW}This should also work and control lights (tools are always available)${NC}"

LIGHTING_DISABLED_REQUEST='{
  "claudeApiKey": "'$CLAUDE_API_KEY'",
  "lifxApiKey": "'$LIFX_API_KEY'",
  "message": "Set all lights to blue and reduce brightness to 50%",
  "systemPromptEnabled": false,
  "maxTokens": 500
}'

make_request "POST" "/api/claude" "$LIGHTING_DISABLED_REQUEST" "Lighting question with system prompt disabled"

# Test 7: Check session info
echo -e "${GREEN}📊 Test 7: Session Information${NC}"
make_request "GET" "/api/session-info" "" "Get current session information"

# Test 8: Get backend logs to see parameter values
echo -e "${GREEN}📝 Test 8: Backend Logs${NC}"
echo -e "${YELLOW}Check logs to verify systemPromptEnabled parameter values${NC}"
make_request "GET" "/api/logs/backend?limit=5&level=info" "" "Get recent backend logs"

echo -e "${GREEN}🎉 All tests completed!${NC}\n"

echo -e "${BLUE}📊 Analysis Guide:${NC}"
echo -e "1. Compare responses from Tests 3 and 4 (same question, different systemPromptEnabled values)"
echo -e "2. Test 3 should decline and redirect to lighting topics"
echo -e "3. Test 4 should answer 'Paris' normally"
echo -e "4. Tests 5 and 6 should both work for lighting control"
echo -e "5. Check the backend logs (Test 8) to verify parameter values are being received\n"

echo -e "${YELLOW}💡 Troubleshooting:${NC}"
echo -e "- If both Tests 3 and 4 give similar responses declining the question,"
echo -e "  there may be an issue with the systemPromptEnabled parameter handling"
echo -e "- Check the server logs for any errors or unexpected behavior"
echo -e "- Verify the parameter names and values in the request payload\n"
