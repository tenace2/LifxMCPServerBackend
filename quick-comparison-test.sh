#!/bin/bash

# Quick comparison test for system prompt behavior
# Replace the API keys below with your actual keys

CLAUDE_KEY="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"
LIFX_KEY="cd3e35559770ccc1f6a4295e2ab51fc3b3a68142a8ed0b2cb7da0f2333d7a285"
SESSION_ID="comparison-test-$(date +%s)"

echo "🔬 Testing System Prompt Behavior"
echo "================================="

echo ""
echo "🟢 Test 1: System Prompt ENABLED (should decline)"
echo "Question: What is the capital of France?"
echo "systemPromptEnabled: true"
echo ""

RESPONSE1=$(curl -s -X POST "http://localhost:3001/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d "{
    \"claudeApiKey\": \"$CLAUDE_KEY\",
    \"lifxApiKey\": \"$LIFX_KEY\",
    \"message\": \"What is the capital of France?\",
    \"systemPromptEnabled\": true,
    \"maxTokens\": 300
  }")

# Extract just the text response
ANSWER1=$(echo "$RESPONSE1" | jq -r '.response.content[0].text' 2>/dev/null || echo "Error parsing response")
echo "Claude's Answer: $ANSWER1"

echo ""
echo "----------------------------------------"
echo ""

echo "🔴 Test 2: System Prompt DISABLED (should answer normally)"
echo "Question: What is the capital of France?"
echo "systemPromptEnabled: false"
echo ""

RESPONSE2=$(curl -s -X POST "http://localhost:3001/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d "{
    \"claudeApiKey\": \"$CLAUDE_KEY\",
    \"lifxApiKey\": \"$LIFX_KEY\",
    \"message\": \"What is the capital of France?\",
    \"systemPromptEnabled\": false,
    \"maxTokens\": 300
  }")

# Extract just the text response
ANSWER2=$(echo "$RESPONSE2" | jq -r '.response.content[0].text' 2>/dev/null || echo "Error parsing response")
echo "Claude's Answer: $ANSWER2"

echo ""
echo "📊 SUMMARY"
echo "=========="
echo "Test 1 (enabled):  $ANSWER1" | cut -c1-80
echo "Test 2 (disabled): $ANSWER2" | cut -c1-80
echo ""

if [[ "$ANSWER1" == *"only able to help with controlling LIFX"* ]]; then
    echo "✅ Test 1 correctly declined (system prompt working)"
else
    echo "❌ Test 1 did not decline as expected"
fi

if [[ "$ANSWER2" == *"Paris"* ]]; then
    echo "✅ Test 2 correctly answered the question"
    echo "🎉 System prompt parameter is working correctly!"
else
    echo "❌ Test 2 did not answer normally - there may be an issue"
fi
