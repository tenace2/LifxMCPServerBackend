# Manual curl Commands for Testing Claude Chat

## Prerequisites

- Server running on http://localhost:3001
- Replace API keys in the commands below with your actual keys

## Basic Setup

```bash
export SERVER_URL="http://localhost:3001"
export SESSION_ID="manual-test-$(date +%s)"
export CLAUDE_KEY="sk-ant-your-claude-key-here"  # Replace with actual key
export LIFX_KEY="your-lifx-api-key-here"         # Replace with actual key
```

## 1. Health Check (No auth required)

```bash
curl -s "$SERVER_URL/health" | jq '.'
```

## 2. API Information (No auth required)

```bash
curl -s "$SERVER_URL/api/info" | jq '.'
```

## 3. Test System Prompt ENABLED (Should decline non-lighting questions)

```bash
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "What is the capital of France?",
    "systemPromptEnabled": true,
    "maxTokens": 500
  }' | jq '.'
```

## 4. Test System Prompt DISABLED (Should answer general questions)

```bash
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "What is the capital of France?",
    "systemPromptEnabled": false,
    "maxTokens": 500
  }' | jq '.'
```

## 5. Test Lighting Question with System Prompt ENABLED

```bash
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "Turn on all my lights",
    "systemPromptEnabled": true,
    "maxTokens": 500
  }' | jq '.'
```

## 6. Test Lighting Question with System Prompt DISABLED

```bash
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{
    "claudeApiKey": "'$CLAUDE_KEY'",
    "lifxApiKey": "'$LIFX_KEY'",
    "message": "Set lights to blue",
    "systemPromptEnabled": false,
    "maxTokens": 500
  }' | jq '.'
```

## 7. Check Session Information

```bash
curl -X GET "$SERVER_URL/api/session-info" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" | jq '.'
```

## 8. Check Backend Logs (To verify parameter values)

```bash
curl -X GET "$SERVER_URL/api/logs/backend?limit=10&level=info" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" | jq '.'
```

## 9. Minimal Test Without jq (if jq not available)

```bash
# System prompt enabled
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session-minimal" \
  -d '{
    "claudeApiKey": "sk-ant-your-key",
    "lifxApiKey": "your-lifx-key",
    "message": "What is 2+2?",
    "systemPromptEnabled": true,
    "maxTokens": 200
  }'

echo "---"

# System prompt disabled
curl -X POST "$SERVER_URL/api/claude" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session-minimal" \
  -d '{
    "claudeApiKey": "sk-ant-your-key",
    "lifxApiKey": "your-lifx-key",
    "message": "What is 2+2?",
    "systemPromptEnabled": false,
    "maxTokens": 200
  }'
```

## Expected Results

### System Prompt ENABLED (`systemPromptEnabled: true`) - Restrictive Mode

- Uses **LIFX_SYSTEM_PROMPT** (restrictive)
- **Non-lighting questions**: Declined with redirect to lighting topics
- **Lighting questions**: Work normally and control lights
- **Behavior**: Claude ONLY discusses lighting

### System Prompt DISABLED (`systemPromptEnabled: false`) - General Mode

- Uses **GENERAL_SYSTEM_PROMPT** (permissive but LIFX-aware)
- **Non-lighting questions**: Answered normally
- **Lighting questions**: Still work (LIFX tools remain available)
- **Behavior**: Claude answers any topic + contextual LIFX awareness

🔑 **Key Point**: Claude is ALWAYS LIFX-aware in both modes. The parameter controls conversation restrictions, not LIFX capability.

## Key Differences to Look For

1. **Test 3 vs Test 4**: Same question, different `systemPromptEnabled` values

   - Test 3 should decline: "I can only help with lighting..."
   - Test 4 should answer: "The capital of France is Paris"

2. **Tests 5 & 6**: Both should control lights regardless of system prompt setting

## Debugging Tips

1. **Check request structure**: Ensure `systemPromptEnabled` is at the top level of the JSON
2. **Verify server logs**: Use Test 8 to see if the parameter is being received
3. **Compare responses**: Look for behavioral differences between enabled/disabled
4. **Check status codes**: Should be 200 for successful requests

## Quick One-Liner Tests

```bash
# Quick test with system prompt disabled (should answer math)
curl -X POST http://localhost:3001/api/claude -H "Content-Type: application/json" -H "x-demo-key: LifxDemo" -H "x-session-id: quick-test" -d '{"claudeApiKey":"your-key","lifxApiKey":"your-lifx-key","message":"What is 5+5?","systemPromptEnabled":false,"maxTokens":100}'

# Quick test with system prompt enabled (should decline)
curl -X POST http://localhost:3001/api/claude -H "Content-Type: application/json" -H "x-demo-key: LifxDemo" -H "x-session-id: quick-test" -d '{"claudeApiKey":"your-key","lifxApiKey":"your-lifx-key","message":"What is 5+5?","systemPromptEnabled":true,"maxTokens":100}'
```
