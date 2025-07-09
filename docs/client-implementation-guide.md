# LIFX MCP Server Backend - Client Implementation Guide

This guide provides comprehensive instructions for implementing a client application that communicates with the LIFX MCP Server Backend.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication & Session Management](#authentication--session-management)
3. [Session Info Endpoint](#session-info-endpoint)
4. [Logs Endpoints](#logs-endpoints)
5. [Rate Limiting & Error Handling](#rate-limiting--error-handling)
6. [Complete Client Implementation Examples](#complete-client-implementation-examples)
7. [Best Practices](#best-practices)

## API Overview

The LIFX MCP Server Backend provides the following endpoints:

- `GET /health` - Health check (no auth required)
- `GET /api/info` - API information (no auth required)
- `GET /api/status` - Server status (no auth required)
- `GET /api/session-info` - Current session information
- `POST /api/clear-session` - Clear user session
- `POST /api/claude` - Claude AI chat with LIFX control
- `POST /api/lifx/:action` - Direct LIFX control
- `GET /api/logs` - General logs endpoint information
- `GET /api/logs/backend` - Backend server logs (authenticated)
- `GET /api/logs/mcp` - MCP process logs (authenticated)

**Base URLs:**

- Production: `https://your-server-domain.com`
- Development: `http://localhost:3001`

## Authentication & Session Management

### Required Headers

All authenticated endpoints require these headers:

```javascript
{
  'Content-Type': 'application/json',
  'x-demo-key': 'LifxDemo',           // Demo access key
  'x-session-id': 'unique-session-id' // Unique session identifier
}
```

### Session ID Generation

Generate a unique session ID for each client session:

```javascript
// Using crypto (Node.js/Browser)
const sessionId = crypto.randomUUID();

// Or using a simple timestamp-based approach
const sessionId = `session_${Date.now()}_${Math.random()
	.toString(36)
	.substr(2, 9)}`;
```

### Session Rules

- **One session per IP address** - Multiple sessions from the same IP are blocked
- **100 requests per session** (configurable via environment variables)
- **24-hour session expiry** (configurable)
- Sessions are automatically cleaned up on expiry

## Session Info Endpoint

### GET /api/session-info

Retrieve detailed information about the current session.

**Headers:**

```javascript
{
  'x-demo-key': 'LifxDemo',
  'x-session-id': 'your-session-id'
}
```

**Response:**

```javascript
{
  "success": true,
  "session": {
    "sessionId": "your-session-id",
    "clientIP": "192.168.1.100",
    "requestsUsed": 15,
    "requestsRemaining": 85,
    "requestLimit": 100,
    "createdAt": "2024-01-20T10:30:00.000Z",
    "sessionAge": 3600000,
    "isActive": true
  },
  "timestamp": "2024-01-20T11:30:00.000Z"
}
```

**Error Response (404):**

```javascript
{
  "error": "Session information not found",
  "code": "SESSION_NOT_FOUND"
}
```

## Logs Endpoints

The server provides separate endpoints for backend and MCP process logs, allowing you to monitor different aspects of the system.

### GET /api/logs/backend

Retrieve backend server logs including API requests, errors, and system events.

**Headers:**

```javascript
{
  'x-demo-key': 'LifxDemo',
  'x-session-id': 'your-session-id'
}
```

**Query Parameters:**

- `limit` (optional): Number of log entries to return (default: 25, max: 100)
- `level` (optional): Filter by log level (`error`, `warn`, `info`, `debug`)
- `since` (optional): ISO timestamp to filter logs from (e.g., `2024-01-01T12:00:00Z`)

**Response:**

```javascript
{
  "success": true,
  "logs": [
    {
      "timestamp": "2024-01-20T10:30:15.123Z",
      "level": "info",
      "message": "Claude chat request",
      "meta": {
        "requestId": "req_12345",
        "sessionId": "session_67890"
      }
    },
    {
      "timestamp": "2024-01-20T10:30:20.456Z",
      "level": "error",
      "message": "Rate limit exceeded",
      "meta": {
        "ip": "192.168.1.100",
        "sessionId": "session_67890"
      }
    }
  ],
  "count": 2,
  "totalStored": 150,
  "filters": {
    "level": null,
    "since": null,
    "limit": 100
  }
}
```

### GET /api/logs/mcp

Retrieve MCP (Model Context Protocol) process logs including stdout/stderr from spawned MCP servers.

**Headers:**

```javascript
{
  'x-demo-key': 'LifxDemo',
  'x-session-id': 'your-session-id'
}
```

**Query Parameters:**

- `limit` (optional): Number of log entries to return (default: 20, max: 100)
- `level` (optional): Filter by log level (`error`, `warn`, `info`, `debug`)
- `since` (optional): ISO timestamp to filter logs from

**Response:**

```javascript
{
  "success": true,
  "logs": [
    {
      "timestamp": "2024-01-20T10:30:16.789Z",
      "level": "info",
      "message": "MCP stdout",
      "meta": {
        "output": "MCP server initialized successfully",
        "pid": 12345
      }
    },
    {
      "timestamp": "2024-01-20T10:30:25.012Z",
      "level": "error",
      "message": "MCP stderr",
      "meta": {
        "error": "LIFX API connection failed",
        "pid": 12345
      }
    }
  ],
  "count": 2,
  "totalStored": 75,
  "filters": {
    "level": null,
    "since": null,
    "limit": 100
  }
}
```

### GET /api/logs

General logs endpoint that provides information about the specific log endpoints.

**Response:**

```javascript
{
  "message": "Logs are now available via specific endpoints",
  "endpoints": {
    "/api/logs/backend": "Backend server logs",
    "/api/logs/mcp": "MCP process logs"
  },
  "queryParameters": {
    "limit": "Number of log entries to return (backend: default 25, max 100; mcp: default 20, max 100)",
    "level": "Filter by log level (error, warn, info, debug)",
    "since": "ISO timestamp to filter logs from (e.g., 2024-01-01T00:00:00Z)"
  },
  "examples": {
    "Get latest 10 backend logs": "/api/logs/backend?limit=10",
    "Get only error logs": "/api/logs/backend?level=error",
    "Get logs since specific time": "/api/logs/backend?since=2024-01-01T12:00:00Z"
  },
  "totalLogsStored": {
    "backend": 150,
    "mcp": 75
  }
}
```

## Rate Limiting & Error Handling

### Rate Limit Headers

The server includes rate limiting information in response headers:

```javascript
// Response headers
'X-Requests-Used': '15'
'X-Requests-Remaining': '85'
```

### Common Error Codes

| Code                 | Description                       | HTTP Status |
| -------------------- | --------------------------------- | ----------- |
| `MISSING_SESSION_ID` | Session ID header missing         | 400         |
| `MULTIPLE_SESSIONS`  | Multiple sessions from same IP    | 429         |
| `SESSION_LIMIT`      | Session request limit exceeded    | 429         |
| `IP_RATE_LIMIT`      | IP rate limit exceeded            | 429         |
| `SERVER_BUSY`        | Too many concurrent MCP processes | 429         |
| `UNAUTHORIZED`       | Missing or invalid demo key       | 401         |
| `SESSION_NOT_FOUND`  | Session info not found            | 404         |

## Complete Client Implementation Examples

### JavaScript/TypeScript Client Class

```javascript
class LifxMcpClient {
	constructor(baseUrl = 'http://localhost:3001') {
		this.baseUrl = baseUrl;
		this.sessionId = this.generateSessionId();
		this.demoKey = 'LifxDemo';
		this.sessionInfo = null;
	}

	generateSessionId() {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	getHeaders() {
		return {
			'Content-Type': 'application/json',
			'x-demo-key': this.demoKey,
			'x-session-id': this.sessionId,
		};
	}

	async makeRequest(endpoint, options = {}) {
		const url = `${this.baseUrl}${endpoint}`;
		const config = {
			headers: this.getHeaders(),
			...options,
		};

		try {
			const response = await fetch(url, config);
			const data = await response.json();

			// Update session info from response headers
			this.updateSessionInfoFromHeaders(response.headers);

			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${data.error || 'Request failed'}`
				);
			}

			return data;
		} catch (error) {
			console.error(`Request failed for ${endpoint}:`, error);
			throw error;
		}
	}

	updateSessionInfoFromHeaders(headers) {
		const used = headers.get('X-Requests-Used');
		const remaining = headers.get('X-Requests-Remaining');

		if (used && remaining) {
			this.sessionInfo = {
				...this.sessionInfo,
				requestsUsed: parseInt(used),
				requestsRemaining: parseInt(remaining),
			};
		}
	}

	// Get detailed session information
	async getSessionInfo() {
		try {
			const response = await this.makeRequest('/api/session-info', {
				method: 'GET',
			});

			this.sessionInfo = response.session;
			return response;
		} catch (error) {
			if (error.message.includes('404')) {
				console.warn(
					'Session not found, may need to make an authenticated request first'
				);
			}
			throw error;
		}
	}

	// Clear current session
	async clearSession() {
		try {
			const response = await this.makeRequest('/api/clear-session', {
				method: 'POST',
			});

			// Generate new session ID for next requests
			this.sessionId = this.generateSessionId();
			this.sessionInfo = null;

			return response;
		} catch (error) {
			throw error;
		}
	}

	// Check server health
	async checkHealth() {
		const response = await fetch(`${this.baseUrl}/health`);
		return await response.json();
	}

	// Get API information
	async getApiInfo() {
		const response = await fetch(`${this.baseUrl}/api/info`);
		return await response.json();
	}

	// Chat with Claude AI
	async chatWithClaude(claudeApiKey, lifxApiKey, message, options = {}) {
		return await this.makeRequest('/api/claude', {
			method: 'POST',
			body: JSON.stringify({
				claudeApiKey,
				lifxApiKey,
				message,
				systemPromptEnabled: options.systemPromptEnabled ?? true,
				maxTokens: options.maxTokens ?? 1000,
			}),
		});
	}

	/**
	 * SYSTEM PROMPT BEHAVIOR AND USAGE
	 *
	 * The systemPromptEnabled parameter controls Claude's conversation scope while
	 * ensuring Claude is ALWAYS aware of LIFX lighting capabilities.
	 *
	 * 🔑 KEY CONCEPT: Claude ALWAYS receives a system prompt and is ALWAYS LIFX-aware.
	 * The parameter controls RESTRICTION LEVEL, not prompt existence.
	 *
	 * RESTRICTIVE MODE (systemPromptEnabled: true - DEFAULT):
	 * - Uses LIFX_SYSTEM_PROMPT (restrictive)
	 * - Claude will ONLY respond to lighting-related questions
	 * - Non-lighting questions are politely declined and redirected
	 * - Example: "What's 2+2?" → "I can only help with lighting control"
	 * - Lighting questions work normally: "Turn on the lights" → Controls lights
	 *
	 * GENERAL MODE (systemPromptEnabled: false):
	 * - Uses GENERAL_SYSTEM_PROMPT (permissive but LIFX-aware)
	 * - Claude can answer ANY topic + maintains LIFX capabilities
	 * - General questions answered normally: "What's 2+2?" → "4"
	 * - Lighting questions still work: "Turn on the lights" → Controls lights
	 * - LIFX tools used contextually when relevant
	 *
	 * USAGE EXAMPLES:
	 *
	 * // Restrictive mode - LIFX topics only (default)
	 * await client.chatWithClaude(claudeKey, lifxKey, "What's the capital of France?", {
	 *   systemPromptEnabled: true  // Will decline: "I can only help with lighting"
	 * });
	 *
	 * // General mode - any topic + LIFX awareness
	 * await client.chatWithClaude(claudeKey, lifxKey, "What's the capital of France?", {
	 *   systemPromptEnabled: false  // Will answer: "Paris"
	 * });
	 *
	 * // Lighting control works identically in both modes
	 * await client.chatWithClaude(claudeKey, lifxKey, "Turn on all lights", {
	 *   systemPromptEnabled: true   // Controls lights via LIFX_SYSTEM_PROMPT
	 * });
	 *
	 * await client.chatWithClaude(claudeKey, lifxKey, "Set lights to blue", {
	 *   systemPromptEnabled: false  // Controls lights via GENERAL_SYSTEM_PROMPT
	 * });
	 *
	 * // Mixed conversation example (general mode only)
	 * await client.chatWithClaude(claudeKey, lifxKey, "Set my lights red while I cook this potato salad recipe", {
	 *   systemPromptEnabled: false  // Provides recipe AND controls lights contextually
	 * });
	 *
	 * 💡 TOKEN OPTIMIZATION: General mode uses a shorter system prompt, saving ~22 tokens per request
	 *
	 * TROUBLESHOOTING:
	 *
	 * If systemPromptEnabled: false doesn't seem to work:
	 * 1. Verify the parameter is being sent in the request body
	 * 2. Check server logs: GET /api/logs/backend?level=info
	 * 3. Use the test script: node test-system-prompt.js
	 * 4. Ensure you're using the correct parameter name (systemPromptEnabled)
	 * 5. Check that the backend is honoring the parameter (not hardcoded)
	 *
	 * The backend implementation should respect this parameter. If it doesn't work,
	 * there may be a bug in the server-side logic that needs investigation.
	 */

	// Direct LIFX control
	async controlLifx(action, lifxApiKey, params = {}) {
		return await this.makeRequest(`/api/lifx/${action}`, {
			method: 'POST',
			body: JSON.stringify({
				lifxApiKey,
				...params,
			}),
		});
	}

	// Get backend logs
	async getBackendLogs(options = {}) {
		const { limit, level, since } = options;
		const params = new URLSearchParams();

		if (limit) params.append('limit', limit.toString());
		if (level) params.append('level', level);
		if (since) params.append('since', since);

		const queryString = params.toString();
		const endpoint = `/api/logs/backend${queryString ? '?' + queryString : ''}`;

		return await this.makeRequest(endpoint, {
			method: 'GET',
		});
	}

	// Get MCP logs
	async getMcpLogs(options = {}) {
		const { limit, level, since } = options;
		const params = new URLSearchParams();

		if (limit) params.append('limit', limit.toString());
		if (level) params.append('level', level);
		if (since) params.append('since', since);

		const queryString = params.toString();
		const endpoint = `/api/logs/mcp${queryString ? '?' + queryString : ''}`;

		return await this.makeRequest(endpoint, {
			method: 'GET',
		});
	}

	// Get logs info
	async getLogsInfo() {
		return await this.makeRequest('/api/logs', {
			method: 'GET',
		});
	}

	// Get session status with rate limit info
	getSessionStatus() {
		if (!this.sessionInfo) {
			return { status: 'unknown', message: 'Session info not loaded' };
		}

		const { requestsUsed, requestsRemaining, requestLimit } = this.sessionInfo;
		const usagePercentage = (requestsUsed / requestLimit) * 100;

		if (requestsRemaining === 0) {
			return { status: 'exhausted', message: 'Session request limit reached' };
		} else if (usagePercentage > 80) {
			return {
				status: 'warning',
				message: `${requestsRemaining} requests remaining`,
			};
		} else {
			return {
				status: 'healthy',
				message: `${requestsRemaining} requests remaining`,
			};
		}
	}
}
```

### React Hook Example

```javascript
import { useState, useEffect, useCallback } from 'react';

export function useLifxMcpClient(baseUrl = 'http://localhost:3001') {
	const [client] = useState(() => new LifxMcpClient(baseUrl));
	const [sessionInfo, setSessionInfo] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);

	const updateSessionInfo = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await client.getSessionInfo();
			setSessionInfo(response.session);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const clearSession = useCallback(async () => {
		try {
			setIsLoading(true);
			await client.clearSession();
			setSessionInfo(null);
			setError(null);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const chatWithClaude = useCallback(
		async (claudeApiKey, lifxApiKey, message, options) => {
			try {
				setIsLoading(true);
				const response = await client.chatWithClaude(
					claudeApiKey,
					lifxApiKey,
					message,
					options
				);
				// Update session info after request
				await updateSessionInfo();
				return response;
			} catch (err) {
				setError(err.message);
				throw err;
			} finally {
				setIsLoading(false);
			}
		},
		[client, updateSessionInfo]
	);

	const sessionStatus = client.getSessionStatus();

	return {
		client,
		sessionInfo,
		sessionStatus,
		isLoading,
		error,
		updateSessionInfo,
		clearSession,
		chatWithClaude,
	};
}
```

### Vue Composition API Example

```javascript
import { ref, reactive, computed } from 'vue';

export function useLifxMcpClient(baseUrl = 'http://localhost:3001') {
	const client = new LifxMcpClient(baseUrl);
	const sessionInfo = ref(null);
	const isLoading = ref(false);
	const error = ref(null);

	const sessionStatus = computed(() => {
		if (!sessionInfo.value) {
			return { status: 'unknown', message: 'Session info not loaded' };
		}

		const { requestsUsed, requestsRemaining, requestLimit } = sessionInfo.value;
		const usagePercentage = (requestsUsed / requestLimit) * 100;

		if (requestsRemaining === 0) {
			return { status: 'exhausted', message: 'Session request limit reached' };
		} else if (usagePercentage > 80) {
			return {
				status: 'warning',
				message: `${requestsRemaining} requests remaining`,
			};
		} else {
			return {
				status: 'healthy',
				message: `${requestsRemaining} requests remaining`,
			};
		}
	});

	const updateSessionInfo = async () => {
		try {
			isLoading.value = true;
			const response = await client.getSessionInfo();
			sessionInfo.value = response.session;
			error.value = null;
		} catch (err) {
			error.value = err.message;
		} finally {
			isLoading.value = false;
		}
	};

	const clearSession = async () => {
		try {
			isLoading.value = true;
			await client.clearSession();
			sessionInfo.value = null;
			error.value = null;
		} catch (err) {
			error.value = err.message;
		} finally {
			isLoading.value = false;
		}
	};

	return {
		client,
		sessionInfo,
		sessionStatus,
		isLoading,
		error,
		updateSessionInfo,
		clearSession,
	};
}
```

## Best Practices

### 1. Session Management

- Generate a unique session ID when the application starts
- Store the session ID persistently (localStorage/sessionStorage) if needed
- Clear sessions when users log out or when switching API keys
- Monitor session usage and warn users when approaching limits

### 2. Error Handling

```javascript
// Implement retry logic for rate limit errors
async function makeRequestWithRetry(client, endpoint, options, maxRetries = 3) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await client.makeRequest(endpoint, options);
		} catch (error) {
			if (error.message.includes('429') && attempt < maxRetries) {
				// Wait before retrying (exponential backoff)
				const delay = Math.pow(2, attempt) * 1000;
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
			throw error;
		}
	}
}
```

### 3. Rate Limit Monitoring

```javascript
// Display session usage in UI
function SessionUsageComponent({ sessionInfo }) {
	if (!sessionInfo) return null;

	const { requestsUsed, requestsRemaining, requestLimit } = sessionInfo;
	const percentage = (requestsUsed / requestLimit) * 100;

	return (
		<div className="session-usage">
			<div className="usage-bar">
				<div className="usage-fill" style={{ width: `${percentage}%` }} />
			</div>
			<span>{requestsRemaining} requests remaining</span>
		</div>
	);
}
```

### 4. Graceful Degradation

```javascript
// Disable features when session is exhausted
function ChatInterface({ sessionStatus, onSendMessage }) {
	const isDisabled = sessionStatus.status === 'exhausted';

	return (
		<div className="chat-interface">
			<textarea disabled={isDisabled} />
			<button disabled={isDisabled} onClick={onSendMessage}>
				{isDisabled ? 'Session Exhausted' : 'Send Message'}
			</button>
			{sessionStatus.status === 'warning' && (
				<div className="warning">{sessionStatus.message}</div>
			)}
		</div>
	);
}
```

### 5. Testing Your Integration

```javascript
// Test script to verify client integration
async function testClientIntegration() {
	const client = new LifxMcpClient('http://localhost:3001');

	try {
		// 1. Check server health
		console.log('1. Checking server health...');
		const health = await client.checkHealth();
		console.log('✓ Server healthy:', health.status);

		// 2. Get API info
		console.log('2. Getting API info...');
		const apiInfo = await client.getApiInfo();
		console.log('✓ API info retrieved:', apiInfo.name);

		// 3. Test session info (should fail initially)
		console.log('3. Testing session info...');
		try {
			await client.getSessionInfo();
		} catch (error) {
			console.log('✓ Expected error for new session:', error.message);
		}

		// 4. Make an authenticated request to establish session
		console.log('4. Making authenticated request...');
		// This would require valid API keys in a real test

		// 5. Get session info after establishing session
		console.log('5. Getting session info after establishing session...');
		const sessionResponse = await client.getSessionInfo();
		console.log('✓ Session info:', sessionResponse.session);

		// 6. Test logs endpoints
		console.log('6. Testing logs endpoints...');
		const logsInfo = await client.getLogsInfo();
		console.log('✓ Logs info:', logsInfo.message); // Get recent backend logs (will get 25 by default)
		const backendLogs = await client.getBackendLogs();
		console.log('✓ Backend logs retrieved:', backendLogs.count, 'entries');

		// Get recent MCP logs (will get 20 by default)
		const mcpLogs = await client.getMcpLogs();
		console.log('✓ MCP logs retrieved:', mcpLogs.count, 'entries');

		console.log('All tests passed! ✓');
	} catch (error) {
		console.error('Test failed:', error);
	}
}
```

This guide provides everything needed to implement a robust client for the LIFX MCP Server Backend, including proper session management, rate limiting awareness, and error handling.
