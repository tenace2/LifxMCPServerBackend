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
