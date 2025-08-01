# Manual curl commands for testing session headers

# ================================================

# Replace these values as needed:

# SERVER_URL=http://localhost:3001

# DEMO_KEY=LifxDemo

# SESSION_ID=your-unique-session-id

## 1. Simple session info check (no counter increment)

curl -i -X GET "http://localhost:3001/api/session-info" \
 -H "Content-Type: application/json" \
 -H "x-demo-key: LifxDemo" \
 -H "x-session-id: test-session-123"

## 2. Test LIFX API call (should increment counter and show headers)

curl -i -X POST "http://localhost:3001/api/lifx/list_lights" \
 -H "Content-Type: application/json" \
 -H "x-demo-key: LifxDemo" \
 -H "x-session-id: test-session-123" \
 -d '{
"lifxApiKey": "lifx_test_key_1234567890123456789012345678901234567890",
"selector": "all"
}'

## 3. Test Claude API call (should increment counter and show headers)

curl -i -X POST "http://localhost:3001/api/claude" \
 -H "Content-Type: application/json" \
 -H "x-demo-key: LifxDemo" \
 -H "x-session-id: test-session-123" \
 -d '{
"claudeApiKey": "sk-ant-api03-test_key_1234567890123456789012345678901234567890123456789012345678901234567890",
"lifxApiKey": "lifx_test_key_1234567890123456789012345678901234567890",
"message": "Hello, test message",
"systemPromptEnabled": true,
"maxTokens": 100
}'

## 4. Extract only session headers from response

curl -I -X POST "http://localhost:3001/api/lifx/list_lights" \
 -H "Content-Type: application/json" \
 -H "x-demo-key: LifxDemo" \
 -H "x-session-id: test-session-123" \
 -d '{
"lifxApiKey": "lifx_test_key_1234567890123456789012345678901234567890",
"selector": "all"
}' | grep -i "x-requests\|x-daily"

## 5. Quick header-only check

curl -s -I -X GET "http://localhost:3001/api/session-info" \
 -H "x-demo-key: LifxDemo" \
 -H "x-session-id: test-session-123" \
 | grep -E "(HTTP|x-requests|x-daily)"

# Expected headers in response:

# X-Requests-Used: 1 (or current count)

# X-Requests-Remaining: 99 (or remaining count)

# X-Daily-Limit: 100 (or configured limit)
