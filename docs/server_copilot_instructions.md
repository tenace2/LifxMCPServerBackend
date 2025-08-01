# LIFX-Claude Server-Side Copilot Instructions

## Project Overview

This is the **backend server** portion of a split LIFX-Claude smart light control application. The server will be deployed on **Railway** and serves API endpoints for a Vue.js client hosted on GitHub Pages.

### Original Project Context

- **Source**: Migrated from https://github.com/tenace2/lifx-claude-vue
- Note the LIFX MCP Server was sourced from James Furey:
  https://mcp.so/server/lifx-api-mcp-server/furey
- **Architecture**: Split from monolithic local dev app to production client-server architecture
- **Purpose**: Secure backend for MCP (Model Context Protocol) integration with LIFX lights and Claude AI

### Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Protocol**: HTTP REST API + JSON-RPC (for MCP communication)
- **Deployment**: Railway
- **Security**: Rate limiting, session tracking, input validation

## Core Architecture

### Server Components

1. **HTTP API Server** (`mcp-server-manager.js`)

   - Express.js server handling HTTP requests from client
   - Manages MCP server lifecycle (spawn/kill child processes)
   - Translates between HTTP and JSON-RPC protocols
   - Implements security and rate limiting

2. **LIFX MCP Server** (`lifx-api-mcp-server.js`)
   - Child process implementing MCP protocol
   - Communicates via stdin/stdout JSON-RPC
   - Wraps LIFX HTTP API with MCP standard
   - Spawned per request (stateless architecture)

### Communication Flow

```
GitHub Pages Client → Railway HTTP API → MCP Server → LIFX API
                   ← Railway HTTP API ← MCP Server ← LIFX API
                   ↓
                Claude API (api.anthropic.com)
```

## Security Implementation

### 1. Rate Limiting & Session Management

```javascript
const rateLimit = require('express-rate-limit');

// Session tracking for multi-user support
const ipSessionMap = new Map(); // IP → Set of session IDs
const sessionRequestCount = new Map(); // sessionId → request count

// Session tracker middleware - supports multiple users
const sessionTracker = (req, res, next) => {
	const clientIP = req.ip;
	const sessionId = req.headers['x-session-id'];

	if (!sessionId) {
		return res.status(400).json({ error: 'Session ID required' });
	}

	// Track all sessions (no IP-based restrictions for multi-user support)
	if (!ipSessionMap.has(clientIP)) {
		ipSessionMap.set(clientIP, new Set());
	}

	const sessionsForIP = ipSessionMap.get(clientIP);
	sessionsForIP.add(sessionId);
	next();
};

// Session request limiting (100 requests per session)
const sessionLimiter = (req, res, next) => {
	const sessionId = req.headers['x-session-id'];
	const currentCount = sessionRequestCount.get(sessionId) || 0;

	if (currentCount >= 100) {
		return res.status(429).json({
			error: 'Session request limit exceeded (100 requests)',
			requestsUsed: currentCount,
			code: 'SESSION_LIMIT',
		});
	}

	sessionRequestCount.set(sessionId, currentCount + 1);
	res.set({
		'X-Requests-Used': currentCount + 1,
		'X-Requests-Remaining': 100 - (currentCount + 1),
	});

	next();
};

// IP-based rate limiting (backup protection)
const ipLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 30, // 30 requests per minute per IP
	message: { error: 'IP rate limit exceeded' },
});
```

### 2. Access Control

```javascript
// Simple access key protection
const ACCESS_KEY = process.env.DEMO_ACCESS_KEY || 'LifxDemo';

const accessControl = (req, res, next) => {
	const accessKey = req.headers['x-demo-key'];
	if (accessKey !== ACCESS_KEY) {
		return res.status(401).json({ error: 'Demo access key required' });
	}
	next();
};
```

### 3. Input Validation

```javascript
const validateClaudeRequest = (req, res, next) => {
	const { claudeApiKey, lifxApiKey, message, maxTokens } = req.body;

	// Validate Claude API key format
	if (!claudeApiKey?.startsWith('sk-ant-')) {
		return res.status(400).json({ error: 'Invalid Claude API key format' });
	}

	// Validate LIFX API key
	if (!lifxApiKey || lifxApiKey.length < 20) {
		return res.status(400).json({ error: 'Invalid LIFX API key format' });
	}

	// Limit message length
	if (!message || message.length > 1000) {
		return res
			.status(400)
			.json({ error: 'Message required and must be under 1000 characters' });
	}

	// Validate token limits
	if (maxTokens && (maxTokens < 50 || maxTokens > 4000)) {
		return res
			.status(400)
			.json({ error: 'Max tokens must be between 50 and 4000' });
	}

	next();
};
```

## API Endpoints

### Health Check

```javascript
app.get('/health', (req, res) => {
	res.json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});
```

### Claude Chat Endpoint

```javascript
app.post(
	'/api/claude',
	accessControl,
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	validateClaudeRequest,
	async (req, res) => {
		const {
			claudeApiKey,
			lifxApiKey,
			message,
			systemPromptEnabled,
			maxTokens,
		} = req.body;

		try {
			// Spawn MCP server with LIFX token
			const mcpProcess = await spawnMcpServer(lifxApiKey);

			// Call Claude API with MCP tools
			const claudeResponse = await callClaudeWithMcp(
				claudeApiKey,
				message,
				mcpProcess,
				{ systemPromptEnabled, maxTokens }
			);

			res.json(claudeResponse);
		} catch (error) {
			console.error('Claude API error:', error);
			res.status(500).json({ error: 'Internal server error' });
		} finally {
			// Clean up MCP process
			if (mcpProcess && !mcpProcess.killed) {
				mcpProcess.kill();
			}
		}
	}
);
```

### Direct LIFX Control

```javascript
app.post(
	'/api/lifx/:action',
	accessControl,
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	async (req, res) => {
		const { action } = req.params;
		const { lifxApiKey, ...params } = req.body;

		try {
			const mcpProcess = await spawnMcpServer(lifxApiKey);
			const result = await callMcpMethod(mcpProcess, action, params);
			res.json(result);
		} catch (error) {
			res.status(500).json({ error: error.message });
		} finally {
			if (mcpProcess && !mcpProcess.killed) {
				mcpProcess.kill();
			}
		}
	}
);
```

### Server Logs

```javascript
app.get('/api/logs', accessControl, sessionTracker, (req, res) => {
	// Return recent server logs (implement log aggregation)
	const logs = getRecentLogs(50); // Last 50 log entries
	res.json({ logs });
});
```

## MCP Server Management

### Stateless MCP Process Spawning

```javascript
const { spawn } = require('child_process');

const spawnMcpServer = async (lifxApiKey) => {
	return new Promise((resolve, reject) => {
		const mcpProcess = spawn('node', ['lifx-api-mcp-server.js'], {
			env: {
				...process.env,
				LIFX_TOKEN: lifxApiKey,
				LOG_LEVEL: 'info',
			},
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		// Set process timeout
		const timeout = setTimeout(() => {
			if (!mcpProcess.killed) {
				mcpProcess.kill();
				reject(new Error('MCP server spawn timeout'));
			}
		}, 30000); // 30 second timeout

		mcpProcess.on('spawn', () => {
			clearTimeout(timeout);
			resolve(mcpProcess);
		});

		mcpProcess.on('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
	});
};
```

### JSON-RPC Communication

```javascript
const callMcpMethod = async (mcpProcess, method, params) => {
	return new Promise((resolve, reject) => {
		const requestId = Date.now();
		const request = {
			jsonrpc: '2.0',
			id: requestId,
			method: `tools/call`,
			params: {
				name: method,
				arguments: params,
			},
		};

		// Set up response listener
		let responseData = '';
		const responseHandler = (data) => {
			responseData += data.toString();
			try {
				const response = JSON.parse(responseData);
				if (response.id === requestId) {
					mcpProcess.stdout.off('data', responseHandler);
					if (response.error) {
						reject(new Error(response.error.message));
					} else {
						resolve(response.result);
					}
				}
			} catch (e) {
				// Partial JSON, wait for more data
			}
		};

		mcpProcess.stdout.on('data', responseHandler);

		// Send request
		mcpProcess.stdin.write(JSON.stringify(request) + '\n');

		// Timeout handling
		setTimeout(() => {
			mcpProcess.stdout.off('data', responseHandler);
			reject(new Error('MCP method call timeout'));
		}, 10000); // 10 second timeout
	});
};
```

## Claude API Integration

### System Prompt Management

```javascript
const LIFX_SYSTEM_PROMPT = `You are a helpful assistant that controls LIFX smart lights. 

IMPORTANT CONSTRAINTS:
- You can ONLY control lights, adjust colors, brightness, and power states
- You CANNOT provide information unrelated to lighting
- You CANNOT answer questions about other topics
- Always use the available MCP tools for light control

Available light control capabilities:
- Turn lights on/off
- Change colors (use color names, hex codes, or RGB values)
- Adjust brightness (0-100%)
- Control specific lights by name or group
- Apply lighting effects

If asked about anything else, politely decline and redirect to lighting topics.`;

const buildClaudeRequest = (message, systemPromptEnabled, maxTokens = 1000) => {
	const messages = [];

	if (systemPromptEnabled) {
		messages.push({
			role: 'system',
			content: LIFX_SYSTEM_PROMPT,
		});
	}

	messages.push({
		role: 'user',
		content: message,
	});

	return {
		model: 'claude-3-5-sonnet-20241022',
		max_tokens: maxTokens,
		messages,
		tools: getMcpTools(), // Convert MCP tools to Claude format
	};
};
```

### MCP Tools for Claude

```javascript
const getMcpTools = () => [
	{
		name: 'set_light_state',
		description: 'Control LIFX light power, color, and brightness',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, etc.)',
				},
				power: { type: 'string', enum: ['on', 'off'] },
				color: { type: 'string', description: 'Color name, hex, or rgb:r,g,b' },
				brightness: { type: 'number', minimum: 0, maximum: 1 },
			},
			required: ['selector'],
		},
	},
	{
		name: 'list_lights',
		description: 'Get list of available LIFX lights',
		input_schema: {
			type: 'object',
			properties: {
				selector: { type: 'string', default: 'all' },
			},
		},
	},
	// Add more MCP tools as needed
];
```

## ✨ Enhanced MCP Server Features (v1.2.0)

### Enhanced LIFX Tools for Better AI Chatbot Usability

The MCP server has been significantly enhanced to improve AI chatbot interactions:

#### 1. Enhanced Error Messages with Guidance

```javascript
// Enhanced error handling in set_light_state and set_color tools
try {
	const response = await lifxApi.put(`/lights/${selector}/state`, payload);
	return response.data;
} catch (error) {
	if (
		error.response?.status === 404 ||
		error.message.includes('Could not find')
	) {
		// Provide helpful selector guidance
		const lightsResponse = await lifxApi.get('/lights/all');
		const lights = lightsResponse.data;
		const availableGroups = [
			...new Set(lights.map((light) => light.group?.name).filter(Boolean)),
		];
		const availableLabels = [
			...new Set(lights.map((light) => light.label).filter(Boolean)),
		];

		throw new Error(
			`Could not find light with selector "${selector}". ` +
				`Available groups: [${availableGroups.join(', ')}]. ` +
				`Available labels: [${availableLabels.join(', ')}]. ` +
				`Try using "group:GroupName" or "label:LightLabel" format.`
		);
	}
	throw error;
}
```

#### 2. Enhanced list_lights with Selector Examples

```javascript
// Enhanced list_lights response for better AI guidance
const lights = response.data.map((light) => ({
	id: light.id,
	label: light.label,
	group: light.group,
	// ... other properties
}));

// Extract unique groups and labels
const availableGroups = [
	...new Set(lights.map((light) => light.group?.name).filter(Boolean)),
];
const availableLabels = [
	...new Set(lights.map((light) => light.label).filter(Boolean)),
];

// Create selector examples for common room names
const selectorExamples = {};
availableGroups.forEach((groupName) => {
	const lowerName = groupName.toLowerCase();
	selectorExamples[lowerName] = `group:${groupName}`;
});

return {
	lights,
	count: lights.length,
	available_groups: availableGroups,
	available_labels: availableLabels,
	selector_examples: selectorExamples, // AI can use this mapping
	selector_help: {
		all_lights: 'all',
		by_group: 'group:GroupName (e.g., group:Bedroom)',
		by_label: 'label:LightLabel (e.g., label:Kitchen Light)',
		by_id: 'id:lightId',
	},
};
```

#### 3. New resolve_selector Helper Tool

```javascript
// New tool for resolving ambiguous room names
resolve_selector: async (params) => {
	const { name } = params;
	const response = await lifxApi.get('/lights/all');
	const lights = response.data;

	const availableGroups = [
		...new Set(lights.map((light) => light.group?.name).filter(Boolean)),
	];
	const availableLabels = [
		...new Set(lights.map((light) => light.label).filter(Boolean)),
	];

	const nameLower = name.toLowerCase();
	const suggestions = [];

	// Find matching groups and labels
	const groupMatches = availableGroups.filter(
		(group) =>
			group.toLowerCase() === nameLower ||
			group.toLowerCase().includes(nameLower)
	);

	groupMatches.forEach((group) => {
		suggestions.push({
			type: 'group',
			selector: `group:${group}`,
			display_name: group,
			match_type: group.toLowerCase() === nameLower ? 'exact' : 'partial',
		});
	});

	return {
		query: name,
		suggestions,
		available_groups: availableGroups,
		available_labels: availableLabels,
		recommendation: suggestions.length > 0 ? suggestions[0].selector : null,
	};
};
```

#### 4. Fixed Multi-Step Tool Execution

```javascript
// Enhanced Claude API integration with conversation loop
const callClaudeWithMcp = async (
	claudeApiKey,
	message,
	mcpProcess,
	options = {}
) => {
	const { systemPromptEnabled = true, maxTokens = 1000 } = options;

	let conversation = buildClaudeRequest(
		message,
		systemPromptEnabled,
		maxTokens
	);
	let totalTokensUsed = 0;

	// Continue conversation until Claude indicates completion
	while (true) {
		const response = await anthropic.messages.create(conversation);
		totalTokensUsed +=
			response.usage.input_tokens + response.usage.output_tokens;

		// Add Claude's response to conversation history
		conversation.messages.push({
			role: 'assistant',
			content: response.content,
		});

		// Check if Claude wants to use tools
		if (response.stop_reason === 'tool_use') {
			// Process all tool calls and add results to conversation
			const toolResults = [];

			for (const content of response.content) {
				if (content.type === 'tool_use') {
					try {
						const result = await callMcpMethod(
							mcpProcess,
							content.name,
							content.input
						);
						toolResults.push({
							type: 'tool_result',
							tool_use_id: content.id,
							content: JSON.stringify(result, null, 2),
						});
					} catch (error) {
						toolResults.push({
							type: 'tool_result',
							tool_use_id: content.id,
							content: `Error: ${error.message}`,
							is_error: true,
						});
					}
				}
			}

			// Add tool results to conversation and continue
			conversation.messages.push({
				role: 'user',
				content: toolResults,
			});

			continue; // Continue the conversation loop
		}

		// Conversation complete
		return {
			response: response.content[0].text,
			tokens_used: totalTokensUsed,
			stop_reason: response.stop_reason,
		};
	}
};
```

### Benefits of Enhanced Implementation

1. **Better User Experience**: Users can say "bedroom" and the system figures out they mean "group:Bedroom"
2. **Self-Healing Errors**: When selectors fail, users get actionable guidance
3. **AI-Friendly**: The AI has all the information it needs to make smart decisions
4. **Robust Conversation Flow**: Multi-step tool interactions work properly

## Railway Deployment

### Environment Variables

```bash
# Railway environment variables
NODE_ENV=production
PORT=3001
DEMO_ACCESS_KEY=LifxDemo
LOG_LEVEL=info

# Optional: CORS origins for client
ALLOWED_ORIGINS=https://username.github.io,http://localhost:9003
```

### Railway Configuration

```json
// railway.json
{
	"build": {
		"builder": "NIXPACKS"
	},
	"deploy": {
		"restartPolicyType": "ON_FAILURE",
		"restartPolicyMaxRetries": 10
	}
}
```

### Package.json Scripts

```json
{
	"scripts": {
		"start": "node mcp-server-manager.js",
		"dev": "nodemon mcp-server-manager.js",
		"test": "npm run test:unit && npm run test:integration"
	},
	"engines": {
		"node": ">=18.0.0"
	}
}
```

### CORS Configuration

```javascript
const cors = require('cors');

const corsOptions = {
	origin: process.env.ALLOWED_ORIGINS?.split(',') || [
		'https://username.github.io', // Replace with actual GitHub Pages URL
		'http://localhost:9003', // For local development
	],
	credentials: true,
	optionsSuccessStatus: 200,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: [
		'Content-Type',
		'Authorization',
		'x-demo-key',
		'x-session-id',
	],
	exposedHeaders: ['x-requests-used', 'x-requests-remaining', 'x-daily-limit'],
};

app.use(cors(corsOptions));
```

## Resource Management & Monitoring

### Process Limits

```javascript
// Limit concurrent MCP processes
const MAX_CONCURRENT_MCP = 5;
let activeMcpCount = 0;

const mcpLimiter = (req, res, next) => {
	if (activeMcpCount >= MAX_CONCURRENT_MCP) {
		return res.status(429).json({
			error: 'Server busy, try again later',
			code: 'SERVER_BUSY',
		});
	}

	activeMcpCount++;
	res.on('finish', () => {
		activeMcpCount--;
	});

	next();
};
```

### Memory Management

```javascript
// Clean up old sessions periodically
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

setInterval(() => {
	const now = Date.now();

	for (const [sessionId, requestCount] of sessionRequestCount.entries()) {
		const sessionTimestamp = parseInt(sessionId.split('_')[1]);
		if (now - sessionTimestamp > SESSION_MAX_AGE) {
			sessionRequestCount.delete(sessionId);

			// Remove from IP mappings
			for (const [ip, sessions] of ipSessionMap.entries()) {
				sessions.delete(sessionId);
				if (sessions.size === 0) {
					ipSessionMap.delete(ip);
				}
			}
		}
	}
}, SESSION_CLEANUP_INTERVAL);
```

### Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json()
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: 'server.log' }),
	],
});

// Request logging middleware
app.use((req, res, next) => {
	logger.info(`${req.method} ${req.path}`, {
		ip: req.ip,
		sessionId: req.headers['x-session-id'],
		userAgent: req.headers['user-agent'],
	});
	next();
});
```

## Error Handling & Recovery

### Global Error Handler

```javascript
app.use((error, req, res, next) => {
	logger.error('Unhandled error:', error);

	// Don't leak error details in production
	const isDevelopment = process.env.NODE_ENV === 'development';

	res.status(500).json({
		error: 'Internal server error',
		...(isDevelopment && { details: error.message, stack: error.stack }),
	});
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});
```

### Graceful Shutdown

```javascript
const gracefulShutdown = () => {
	logger.info('Received shutdown signal, closing server...');

	server.close(() => {
		logger.info('Server closed');
		process.exit(0);
	});

	// Force close after 10 seconds
	setTimeout(() => {
		logger.error('Forced shutdown after timeout');
		process.exit(1);
	}, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

## Development Guidelines

### File Structure

```
server/
├── mcp-server-manager.js     # Main HTTP API server
├── lifx-api-mcp-server.js    # MCP server (child process)
├── middleware/
│   ├── auth.js               # Access control
│   ├── rateLimit.js          # Rate limiting logic
│   └── validation.js         # Input validation
├── services/
│   ├── claudeApi.js          # Claude API integration
│   ├── mcpManager.js         # MCP process management
│   └── logger.js             # Logging configuration
├── utils/
│   ├── security.js           # Security utilities
│   └── cleanup.js            # Resource cleanup
└── tests/
    ├── integration/          # Integration tests
    └── unit/                 # Unit tests
```

### Testing Strategy

- **Unit Tests**: Test individual functions and middleware
- **Integration Tests**: Test API endpoints end-to-end
- **Load Tests**: Verify rate limiting and resource management
- **Security Tests**: Test authentication and input validation

### Monitoring

- Log all API requests with timing and status
- Monitor memory usage and process counts
- Track session usage patterns
- Alert on error rates and resource limits

This server should be robust, secure, and cost-effective for a public demo deployment on Railway.
