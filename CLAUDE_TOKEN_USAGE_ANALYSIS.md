# Claude API Token Usage Analysis

## 🎯 **Great News: Your Backend Already Provides Accurate Token Usage!**

Your backend is **already capturing and returning the exact Claude API token usage data** that you need. The inaccurate token estimation in your frontend can be replaced with the precise data that Claude API provides.

## 📊 **Current Implementation Analysis**

### What Your Backend Currently Returns

When your frontend calls `POST /api/claude`, the response includes:

```javascript
{
  "success": true,
  "response": {
    "id": "msg_01ABC123...",
    "type": "message",
    "role": "assistant",
    "content": [...],
    "model": "claude-3-5-sonnet-20241022",
    "stop_reason": "end_turn"
  },
  "usage": {
    "input_tokens": 2048,    // ← EXACT INPUT TOKENS FROM CLAUDE API
    "output_tokens": 156     // ← EXACT OUTPUT TOKENS FROM CLAUDE API
  },
  "initialResponse": "..." // First response text if tools were used
}
```

### Key Code Locations

**In `services/claudeApi.js` (lines 520-530):**

```javascript
return {
	success: true,
	response: response,
	initialResponse: initialResponseText,
	usage: totalUsage, // ← This contains the exact Claude API usage data
};
```

**In `mcp-server-manager.js` (line 339):**

```javascript
sendJsonWithSessionHeaders(res, req, claudeResponse);
// This sends the entire response including usage data to your frontend
```

## 🔧 **How to Fix Your Frontend Token Estimation**

### Current Problem

Your frontend is trying to estimate token usage instead of using the precise data from Claude API.

### Solution

Replace your frontend token estimation with the actual usage data:

```javascript
// ❌ Instead of estimating tokens like this:
const estimatedTokens = message.length * 0.75; // Rough estimate

// ✅ Use the actual usage data from your backend response:
fetch('/api/claude', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'x-demo-key': 'your-demo-key',
		'x-session-id': 'your-session-id',
	},
	body: JSON.stringify({
		claudeApiKey: 'your-key',
		lifxApiKey: 'your-lifx-key',
		message: userMessage,
		systemPromptEnabled: true,
		maxTokens: 1000,
	}),
})
	.then((response) => response.json())
	.then((data) => {
		if (data.success && data.usage) {
			// 🎯 Use exact token counts from Claude API
			const inputTokens = data.usage.input_tokens;
			const outputTokens = data.usage.output_tokens;
			const totalTokens = inputTokens + outputTokens;

			// Update your UI with accurate token usage
			updateTokenDisplay(inputTokens, outputTokens, totalTokens);

			// Calculate accurate costs if needed
			const inputCost = calculateInputCost(inputTokens);
			const outputCost = calculateOutputCost(outputTokens);
		}
	});
```

## 🚀 **Testing Your Current Implementation**

I've created a test script (`test-claude-usage-response.js`) that you can run to see exactly what your backend returns:

```bash
# Set up environment variables
export CLAUDE_API_KEY="your-actual-claude-api-key"
export LIFX_API_KEY="your-actual-lifx-api-key"
export DEMO_KEY="your-demo-key"

# Run the test
node test-claude-usage-response.js
```

This will show you the exact response structure including the `usage` object with accurate token counts.

## 📈 **Advanced Token Usage Features**

Your backend already supports some advanced features:

### 1. **Multi-turn Conversation Token Tracking**

When Claude uses tools (like controlling lights), your backend accumulates tokens across multiple API calls:

```javascript
// In claudeApi.js (lines 510-512)
totalUsage.input_tokens += response.usage.input_tokens;
totalUsage.output_tokens += response.usage.output_tokens;
```

### 2. **Session-based Usage Logging**

Your backend logs token usage per session:

```javascript
// In mcp-server-manager.js (lines 335-336)
sessionLogger.info('Claude chat completed', {
	usage: claudeResponse.usage,
	// ... other session info
});
```

### 3. **Rate Limiting Integration**

Your usage tracking could be integrated with the existing rate limiting system.

## 🛠 **Optional Enhancements**

If you want to enhance your token usage tracking, here are some optional improvements:

### 1. **Add Token Usage to Session Headers**

You could expose token usage in response headers alongside the existing session headers.

### 2. **Token Usage Endpoint**

Create a dedicated endpoint to query cumulative token usage per session.

### 3. **Cost Calculation**

Add cost calculation based on Claude's pricing model.

## 📝 **Summary**

**You don't need to add any new Claude API token tracking** - your backend already provides the exact token usage data from Claude API. The issue is that your frontend is using token estimation instead of consuming the accurate data that's already available in the API response.

**Next Steps:**

1. Update your frontend to use `response.usage.input_tokens` and `response.usage.output_tokens`
2. Remove any token estimation logic in your frontend
3. Test with the provided test script to verify the data structure
4. Optionally add the suggested enhancements if you want more advanced token tracking features

The suggested code you found is exactly what your backend is already implementing and returning!
