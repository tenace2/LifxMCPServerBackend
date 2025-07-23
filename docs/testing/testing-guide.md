# Testing Guide

This guide explains all the test files in the LIFX MCP Server Backend project and how to use them. The project includes multiple types of tests for different scenarios and skill levels.

## 📋 Test File Overview

### Shell Scripts (.sh)

Shell scripts use curl commands to test the API endpoints directly. They're great for:

- Quick functionality verification
- Testing without Node.js knowledge
- Automated testing in CI/CD pipelines
- Learning how the API works

### JavaScript Files (.js)

JavaScript test files use Node.js to make more complex API calls. They're better for:

- Advanced testing scenarios
- Programmatic testing
- Testing JavaScript-specific functionality
- Integration with testing frameworks

## 🚀 Quick Start Tests

### 1. Simple Test (`simple-test.sh`)

**Purpose:** Basic functionality test for beginners
**What it tests:** Health check, Claude chat, and LIFX light control

**How to use:**

1. Edit the file and replace the API keys:

   ```bash
   CLAUDE_KEY="sk-ant-your-actual-claude-key"
   LIFX_KEY="your-actual-lifx-token"
   ```

2. Make the script executable and run:
   ```bash
   chmod +x simple-test.sh
   ./simple-test.sh
   ```

**What you'll see:**

- Colorized output showing test progress
- Health check verification
- Claude chat response
- Light control confirmation

### 2. Quick Comparison Test (`quick-comparison-test.sh`)

**Purpose:** Compare system prompt enabled vs disabled behavior
**What it tests:** How Claude responds differently with system prompt on/off

**How to use:**

1. Update API keys in the script
2. Run with:
   ```bash
   chmod +x quick-comparison-test.sh
   ./quick-comparison-test.sh
   ```

**What you'll see:**

- Two different responses to the same question
- Demonstration of system prompt restrictions

## 🧪 Advanced Testing

### 3. System Prompt Testing (`test-system-prompt.js`)

**Purpose:** Comprehensive testing of system prompt behavior
**What it tests:**

- System prompt enabled/disabled modes
- Different types of questions
- Response consistency

**Prerequisites:**

```bash
npm install  # Ensure axios is installed
```

**How to use:**

1. Edit the file and update the TEST_CONFIG section:

   ```javascript
   const TEST_CONFIG = {
   	claudeApiKey: 'sk-ant-your-actual-key',
   	lifxApiKey: 'your-actual-lifx-token',
   	sessionId: 'test-session-' + Date.now(),
   };
   ```

2. Run the test:
   ```bash
   node test-system-prompt.js
   ```

**What you'll see:**

- Multiple test scenarios
- Detailed response analysis
- Pass/fail indicators for each test

### 4. MCP Direct Testing (`test-mcp-direct.js`)

**Purpose:** Test the MCP server component directly (bypasses the HTTP API)
**What it tests:** The underlying MCP protocol implementation

**How to use:**

1. Update the LIFX token in the file:

   ```javascript
   LIFX_TOKEN: 'your-actual-lifx-token';
   ```

2. Run the test:
   ```bash
   node test-mcp-direct.js
   ```

**What you'll see:**

- Direct MCP server communication
- Raw MCP protocol messages
- Lower-level debugging information

### 5. Session Demo (`demo-session-info.js`)

**Purpose:** Demonstrate session management and proper client implementation
**What it tests:**

- Session creation and tracking
- Rate limiting behavior
- Client-side best practices

**How to use:**

```bash
node demo-session-info.js
```

**What you'll see:**

- Session creation process
- Rate limiting headers
- Proper error handling examples

## ✨ Testing Enhanced Features (v1.2.0)

### 8. Enhanced MCP Server Testing

**Purpose:** Test the new enhanced LIFX tools and selector resolution features

**New Features to Test:**

#### a) Enhanced Error Messages

Test that selector errors now provide helpful guidance:

```bash
# Test with invalid selector to see enhanced error message
curl -X POST http://localhost:3001/api/lifx/set_color \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session" \
  -d '{
    "lifxApiKey": "your-lifx-token",
    "selector": "invalidroom",
    "color": "red"
  }'
```

**Expected Enhanced Error:**

```json
{
	"error": "Could not find light with selector 'invalidroom'. Available groups: [Bedroom, Kitchen, Office]. Available labels: [Table Lamp, Ceiling Light]. Try using 'group:GroupName' or 'label:LabelName' format."
}
```

#### b) Resolve Selector Tool

Test the new helper tool for ambiguous room names:

```bash
# Test resolve_selector with ambiguous name
curl -X POST http://localhost:3001/api/lifx/resolve_selector \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session" \
  -d '{
    "lifxApiKey": "your-lifx-token",
    "name": "bedroom"
  }'
```

**Expected Response:**

```json
{
	"query": "bedroom",
	"suggestions": [
		{
			"type": "group",
			"selector": "group:Bedroom",
			"display_name": "Bedroom",
			"match_type": "exact"
		}
	],
	"recommendation": "group:Bedroom",
	"available_groups": ["Bedroom", "Kitchen", "Office"],
	"available_labels": ["Table Lamp", "Ceiling Light"]
}
```

#### c) Enhanced list_lights Response

Test that list_lights now returns selector examples:

```bash
# Test enhanced list_lights response
curl -X POST http://localhost:3001/api/lifx/list_lights \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session" \
  -d '{
    "lifxApiKey": "your-lifx-token"
  }'
```

**Look for these new fields in response:**

```json
{
  "lights": [...],
  "available_groups": ["Bedroom", "Kitchen", "Office"],
  "available_labels": ["Table Lamp", "Ceiling Light"],
  "selector_examples": {
    "bedroom": "group:Bedroom",
    "kitchen": "group:Kitchen",
    "office": "group:Office"
  },
  "selector_help": {
    "all_lights": "all",
    "by_group": "group:GroupName (e.g., group:Bedroom)",
    "by_label": "label:LightLabel (e.g., label:Kitchen Light)",
    "by_id": "id:lightId (e.g., id:d073d58529b9)"
  }
}
```

#### d) Multi-Step Tool Execution

Test the fixed conversation flow with Claude:

```bash
# Test multi-step conversation (should now work properly)
curl -X POST http://localhost:3001/api/claude \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session" \
  -d '{
    "claudeApiKey": "sk-ant-your-key",
    "lifxApiKey": "your-lifx-token",
    "message": "Change bedroom lights to blue"
  }'
```

**Expected Behavior:**

1. Claude should call `list_lights` to see available options
2. Claude should then call `set_color` with proper selector
3. Response should show successful light control
4. No premature conversation ending

#### e) Testing Script for Enhanced Features

Create `test-enhanced-features.sh`:

```bash
#!/bin/bash

# Test Enhanced LIFX MCP Server Features
echo "🧪 Testing Enhanced LIFX MCP Server Features"

CLAUDE_KEY="sk-ant-your-actual-key"
LIFX_KEY="your-actual-lifx-token"
SESSION_ID="enhanced-test-$(date +%s)"
BASE_URL="http://localhost:3001"

echo "📋 Testing resolve_selector tool..."
curl -s -X POST "$BASE_URL/api/lifx/resolve_selector" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d "{\"lifxApiKey\": \"$LIFX_KEY\", \"name\": \"bedroom\"}" | jq .

echo "📋 Testing enhanced list_lights..."
curl -s -X POST "$BASE_URL/api/lifx/list_lights" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d "{\"lifxApiKey\": \"$LIFX_KEY\"}" | jq '.selector_examples'

echo "📋 Testing enhanced error message..."
curl -s -X POST "$BASE_URL/api/lifx/set_color" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d "{\"lifxApiKey\": \"$LIFX_KEY\", \"selector\": \"invalidroom\", \"color\": \"red\"}" | jq .

echo "✅ Enhanced features testing complete!"
```

## 📊 Monitoring

### 6. Usage Monitoring (`monitor-usage.sh`)

**Purpose:** Real-time monitoring of server activity
**What it monitors:**

- Active connections
- Request patterns
- Server resource usage

**How to use:**

```bash
chmod +x monitor-usage.sh
./monitor-usage.sh
```

**What you'll see:**

- Live connection counts
- Request summaries
- System resource usage

## 🧩 Unit/Integration Tests

### 7. Formal Test Suite (`tests/integration/server.test.js`)

**Purpose:** Professional-grade automated testing using Jest
**What it tests:**

- All API endpoints
- Authentication
- Error handling
- Rate limiting

**Prerequisites:**

```bash
npm install --dev  # Install Jest and testing dependencies
```

**How to use:**

```bash
npm test
```

**What you'll see:**

- Professional test runner output
- Pass/fail statistics
- Code coverage reports (if configured)

## 🔧 Setting Up Tests

### Required API Keys

All tests require two API keys:

1. **Claude API Key** (from Anthropic)

   - Format: `sk-ant-...`
   - Get it from: https://console.anthropic.com/

2. **LIFX API Token** (from LIFX Cloud)
   - Format: Long alphanumeric string
   - Get it from: https://cloud.lifx.com/settings

### Environment Setup

1. **Start the server first:**

   ```bash
   npm run dev
   ```

2. **In another terminal, run your tests**

3. **For shell scripts, make them executable:**
   ```bash
   chmod +x *.sh
   ```

## 🚨 Common Issues and Solutions

### Issue: "Permission denied" when running .sh files

**Solution:** Make the script executable:

```bash
chmod +x filename.sh
```

### Issue: "Module not found" errors in .js files

**Solution:** Install dependencies:

```bash
npm install
```

### Issue: Connection refused errors

**Solution:** Make sure the server is running:

```bash
npm run dev
```

### Issue: API key errors

**Solution:**

- Verify your API keys are valid
- Check for extra spaces or quotes
- Ensure keys aren't expired

### Issue: CORS errors in browser testing

**Solution:** Check the `ALLOWED_ORIGINS` environment variable

## 📈 Test Results Interpretation

### Successful Test Indicators:

- ✅ Green checkmarks or "✓" symbols
- HTTP status codes 200-299
- Response contains expected data
- No error messages in output

### Failed Test Indicators:

- ❌ Red X marks or error symbols
- HTTP status codes 400+ (4xx, 5xx)
- "Error" or "Failed" messages
- Empty or unexpected responses

### Rate Limiting Indicators:

- HTTP status code 429
- "Rate limit exceeded" messages
- Headers showing request limits

## 🎯 Which Test Should You Use?

**For beginners:**

- Start with `simple-test.sh`
- It's the easiest to understand and modify

**For API learning:**

- Use `demo-session-info.js`
- Shows proper client implementation

**For troubleshooting:**

- Use `test-system-prompt.js` for prompt issues
- Use `test-mcp-direct.js` for MCP problems
- Use `monitor-usage.sh` for performance issues

**For development:**

- Use `tests/integration/server.test.js`
- Run before committing code changes

**For CI/CD:**

- Shell scripts work well in automated pipelines
- Jest tests provide detailed reporting

## 🛠️ Creating Your Own Tests

### Shell Script Template:

```bash
#!/bin/bash

# Your test description here
CLAUDE_KEY="your-key-here"
LIFX_KEY="your-key-here"
SESSION_ID="test-$(date +%s)"

curl -X POST "http://localhost:3001/api/endpoint" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: $SESSION_ID" \
  -d '{"your": "data"}'
```

### JavaScript Test Template:

```javascript
#!/usr/bin/env node

const axios = require('axios');

async function myTest() {
	const headers = {
		'Content-Type': 'application/json',
		'x-demo-key': 'LifxDemo',
		'x-session-id': 'test-' + Date.now(),
	};

	try {
		const response = await axios.post(
			'http://localhost:3001/api/endpoint',
			{
				// your data here
			},
			{ headers }
		);

		console.log('✅ Test passed:', response.data);
	} catch (error) {
		console.log('❌ Test failed:', error.message);
	}
}

myTest();
```

## 📚 Additional Resources

- [Client Implementation Guide](client-implementation-guide.md) - Frontend integration
- [Complete Setup Guide](COMPLETE_SETUP_GUIDE.md) - Full project setup
- [README.md](../README.md) - Main project documentation

---

**Need help?** If you're still confused about any test file, try reading the comments at the top of each file - they often explain what the test does and how to use it.
