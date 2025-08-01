#!/usr/bin/env node

/**
 * LIFX MCP Server Manager
 *
 * Main HTTP API server that manages MCP server processes and provides
 * RESTful endpoints for the LIFX-Claude client application.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

// Import services and middleware
const logger = require('./services/logger');
const { accessControl } = require('./middleware/auth');
const {
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	mcpLimiter,
	clearSession,
	getSessionInfo,
} = require('./middleware/rateLimit');
const {
	validateClaudeRequest,
	validateLifxRequest,
	sanitizeRequest,
	validateContentType,
	validateRequestSize,
} = require('./middleware/validation');
const {
	spawnMcpServer,
	callMcpMethod,
	cleanupMcpProcess,
	setMcpLogCallback,
} = require('./services/mcpManager');
const {
	callClaudeWithMcp,
	testClaudeConnection,
} = require('./services/claudeApi');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Helper function to ensure session headers are included in responses
const sendJsonWithSessionHeaders = (res, req, data, statusCode = 200) => {
	// Set session headers if available
	if (req.sessionUsage) {
		res.setHeader('x-requests-used', req.sessionUsage.used.toString());
		res.setHeader(
			'x-requests-remaining',
			req.sessionUsage.remaining.toString()
		);
		res.setHeader('x-daily-limit', req.sessionUsage.dailyLimit.toString());
	}

	return res.status(statusCode).json(data);
};

// Security middleware
app.use(
	helmet({
		contentSecurityPolicy: false, // Allow for API usage
		crossOriginEmbedderPolicy: false,
	})
);

// CORS configuration
const corsOptions = {
	origin: process.env.ALLOWED_ORIGINS?.split(',') || [
		'https://tenace2.github.io',
		'http://localhost:9003',
		'http://localhost:5173', // Added for local client testing
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

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
	req.requestId = uuidv4();

	logger.info(`${req.method} ${req.path}`, {
		requestId: req.requestId,
		ip: req.ip,
		sessionId: req.headers['x-session-id'],
		userAgent: req.headers['user-agent'],
	});

	next();
});

// Global middleware
app.use(sanitizeRequest);
app.use(validateContentType);
app.use(validateRequestSize);

// Temporary: Track health check frequency to identify patterns
const healthCheckTracker = {
	requests: [],
	maxTracked: 10, // Keep last 10 requests
};

// Helper function to analyze request patterns
const analyzeHealthCheckPattern = () => {
	if (healthCheckTracker.requests.length < 2) return null;

	const intervals = [];
	for (let i = 1; i < healthCheckTracker.requests.length; i++) {
		const interval =
			healthCheckTracker.requests[i].timestamp -
			healthCheckTracker.requests[i - 1].timestamp;
		intervals.push(interval);
	}

	const avgInterval =
		intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
	return {
		averageIntervalMs: Math.round(avgInterval),
		averageIntervalSeconds: Math.round(avgInterval / 1000),
		intervalPattern: intervals.map((i) => Math.round(i / 1000)), // in seconds
	};
};

// Health check endpoint (no auth required) - Enhanced logging
app.get('/health', (req, res) => {
	const now = Date.now();

	// Track request for pattern analysis
	healthCheckTracker.requests.push({
		timestamp: now,
		ip: req.ip,
		userAgent: req.headers['user-agent'],
		remotePort: req.socket?.remotePort,
	});

	// Keep only recent requests
	if (healthCheckTracker.requests.length > healthCheckTracker.maxTracked) {
		healthCheckTracker.requests.shift();
	}

	// Analyze pattern
	const pattern = analyzeHealthCheckPattern();

	// Detailed logging for health checks to track down the source
	logger.info('Health check request details', {
		ip: req.ip,
		ipv4: req.connection?.remoteAddress,
		ipv6: req.socket?.remoteAddress,
		userAgent: req.headers['user-agent'],
		referer: req.headers['referer'],
		origin: req.headers['origin'],
		host: req.headers['host'],
		connection: req.headers['connection'],
		acceptLanguage: req.headers['accept-language'],
		acceptEncoding: req.headers['accept-encoding'],
		accept: req.headers['accept'],
		timestamp: new Date().toISOString(),
		requestId: req.requestId,
		// Additional debugging info
		socketRemotePort: req.socket?.remotePort,
		socketLocalPort: req.socket?.localPort,
		protocol: req.protocol,
		url: req.url,
		originalUrl: req.originalUrl,
		method: req.method,
		// Pattern analysis
		requestPattern: pattern,
		totalTrackedRequests: healthCheckTracker.requests.length,
	});

	res.json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		version: require('./package.json').version,
		environment: process.env.NODE_ENV || 'development',
		// Temporarily include pattern analysis in response for debugging
		...(pattern && { patternAnalysis: pattern }),
	});
});

// API info endpoint (no auth required)
app.get('/api/info', (req, res) => {
	res.json({
		name: 'LIFX MCP Server Backend',
		version: require('./package.json').version,
		description: 'Backend server for LIFX-Claude smart light control',
		endpoints: [
			'GET /health - Health check',
			'GET /api/info - API information',
			'GET /api/status - Server status',
			'GET /api/session-info - Current session information',
			'POST /api/clear-session - Clear user session',
			'POST /api/claude - Claude AI chat with LIFX control',
			'POST /api/lifx/:action - Direct LIFX control',
			'GET /api/logs - General logs endpoint information',
			'GET /api/logs/backend - Backend server logs (authenticated)',
			'GET /api/logs/mcp - MCP process logs (authenticated)',
		],
		authentication: 'Demo access key required in x-demo-key header',
		rateLimit: {
			requestsPerSession: parseInt(process.env.SESSION_REQUEST_LIMIT) || 100,
			ipRateLimit: `${process.env.IP_RATE_LIMIT_MAX || 30} requests per ${
				process.env.IP_RATE_LIMIT_WINDOW || 60000
			}ms`,
			multiUserEnabled: true,
			developmentMode: process.env.NODE_ENV === 'development',
		},
	});
});

// API status endpoint (no auth required)
app.get('/api/status', (req, res) => {
	res.json({
		status: 'online',
		server: 'LIFX MCP Server Backend',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		version: require('./package.json').version,
		environment: process.env.NODE_ENV || 'development',
		ready: true,
	});
});

// Test endpoint for Claude API connection
app.post(
	'/api/test/claude',
	accessControl,
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	async (req, res) => {
		try {
			const { claudeApiKey } = req.body;

			if (!claudeApiKey) {
				return res.status(400).json({
					error: 'Claude API key required',
					code: 'MISSING_CLAUDE_KEY',
				});
			}

			const result = await testClaudeConnection(claudeApiKey);

			logger.info('Claude connection test', {
				requestId: req.requestId,
				success: result.success,
				sessionId: req.sessionId,
			});

			sendJsonWithSessionHeaders(res, req, result);
		} catch (error) {
			logger.error('Claude connection test error', {
				requestId: req.requestId,
				error: error.message,
			});

			sendJsonWithSessionHeaders(
				res,
				req,
				{
					error: 'Internal server error',
					code: 'INTERNAL_ERROR',
				},
				500
			);
		}
	}
);

// Main Claude chat endpoint
app.post(
	'/api/claude',
	accessControl,
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	mcpLimiter,
	validateClaudeRequest,
	async (req, res) => {
		const {
			claudeApiKey,
			lifxApiKey,
			message,
			systemPromptEnabled,
			maxTokens,
		} = req.body;
		let mcpProcess = null;

		try {
			// Create session-aware logger
			const sessionLogger = createSessionLogger(req.sessionId);

			sessionLogger.info('Claude chat request', {
				requestId: req.requestId,
				sessionId: req.sessionId,
				messageLength: message.length,
				systemPromptEnabled,
				maxTokens,
			});

			// Spawn MCP server with LIFX token and session context
			mcpProcess = await spawnMcpServer(lifxApiKey, req.sessionId);
			// Call Claude API with MCP tools
			const claudeResponse = await callClaudeWithMcp(
				claudeApiKey,
				message,
				mcpProcess,
				{ systemPromptEnabled, maxTokens, sessionId: req.sessionId }
			);

			sessionLogger.info('Claude chat completed', {
				requestId: req.requestId,
				sessionId: req.sessionId,
				success: claudeResponse.success,
				usage: claudeResponse.usage,
			});

			sendJsonWithSessionHeaders(res, req, claudeResponse);
		} catch (error) {
			logger.error('Claude chat error', {
				requestId: req.requestId,
				sessionId: req.sessionId,
				error: error.message,
			});

			sendJsonWithSessionHeaders(
				res,
				req,
				{
					error: 'Internal server error',
					code: 'CLAUDE_ERROR',
				},
				500
			);
		} finally {
			// Clean up MCP process
			if (mcpProcess) {
				cleanupMcpProcess(mcpProcess, req.sessionId);
			}
		}
	}
);

// Direct LIFX control endpoint
app.post(
	'/api/lifx/:action',
	accessControl,
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	mcpLimiter,
	validateLifxRequest,
	async (req, res) => {
		const { action } = req.params;
		const { lifxApiKey, ...params } = req.body;
		let mcpProcess = null;

		try {
			// Create session-aware logger
			const sessionLogger = createSessionLogger(req.sessionId);

			sessionLogger.info('Direct LIFX control', {
				requestId: req.requestId,
				sessionId: req.sessionId,
				action,
				params: Object.keys(params),
			});

			// Spawn MCP server with LIFX token and session context
			mcpProcess = await spawnMcpServer(lifxApiKey, req.sessionId);
			// Call MCP method
			const result = await callMcpMethod(
				mcpProcess,
				action,
				params,
				req.sessionId
			);

			sessionLogger.info('LIFX control completed', {
				requestId: req.requestId,
				sessionId: req.sessionId,
				action,
				success: true,
			});

			sendJsonWithSessionHeaders(res, req, {
				success: true,
				action,
				result,
			});
		} catch (error) {
			logger.error('LIFX control error', {
				requestId: req.requestId,
				sessionId: req.sessionId,
				action,
				error: error.message,
			});

			sendJsonWithSessionHeaders(
				res,
				req,
				{
					error: error.message,
					code: 'LIFX_ERROR',
					action,
				},
				500
			);
		} finally {
			// Clean up MCP process
			if (mcpProcess) {
				cleanupMcpProcess(mcpProcess, req.sessionId);
			}
		}
	}
);

// Clear session endpoint (requires auth)
app.post('/api/clear-session', accessControl, (req, res) => {
	try {
		const sessionId = req.headers['x-session-id'];
		const clientIP = req.ip;

		if (!sessionId) {
			return res.status(400).json({
				error: 'Session ID required in x-session-id header',
				code: 'MISSING_SESSION_ID',
			});
		}

		// Clear the session
		const cleared = clearSession(sessionId, clientIP);

		if (cleared) {
			logger.info('Session cleared via API', {
				sessionId,
				clientIP,
				requestId: req.requestId,
			});

			res.json({
				success: true,
				message: 'Session cleared successfully',
				sessionId,
				timestamp: new Date().toISOString(),
			});
		} else {
			logger.warn('Attempted to clear non-existent session', {
				sessionId,
				clientIP,
				requestId: req.requestId,
			});

			res.json({
				success: false,
				message: 'Session not found or already cleared',
				sessionId,
				timestamp: new Date().toISOString(),
			});
		}
	} catch (error) {
		logger.error('Error in clear-session endpoint', {
			error: error.message,
			requestId: req.requestId,
		});

		res.status(500).json({
			error: 'Internal server error',
			code: 'INTERNAL_ERROR',
			requestId: req.requestId,
		});
	}
});

// Session info endpoint (requires auth and session)
app.get('/api/session-info', accessControl, sessionTracker, (req, res) => {
	try {
		const sessionId = req.sessionId;
		const clientIP = req.ip;

		const sessionInfo = getSessionInfo(sessionId, clientIP);

		if (!sessionInfo) {
			return res.status(404).json({
				error: 'Session information not found',
				code: 'SESSION_NOT_FOUND',
			});
		}

		logger.info('Session info requested', {
			sessionId,
			clientIP,
			requestId: req.requestId,
		});

		// Set session headers manually since this endpoint doesn't use sessionLimiter
		res.setHeader('x-requests-used', sessionInfo.requestsUsed.toString());
		res.setHeader(
			'x-requests-remaining',
			sessionInfo.requestsRemaining.toString()
		);
		res.setHeader('x-daily-limit', sessionInfo.requestLimit.toString());

		res.json({
			success: true,
			session: sessionInfo,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error('Error in session-info endpoint', {
			error: error.message,
			requestId: req.requestId,
		});

		res.status(500).json({
			error: 'Internal server error',
			code: 'INTERNAL_ERROR',
			requestId: req.requestId,
		});
	}
});

// Session-isolated log storage with system logs
const logStorage = {
	// System logs visible to all sessions (startup, config, critical errors)
	system: {
		backend: [],
		mcp: [],
	},
	// Session-specific logs: sessionId → { backend: [], mcp: [] }
	sessions: new Map(),
	maxLogEntries: 500, // Reduced per storage area
	maxSessions: 50, // Prevent memory bloat
};

// Helper to determine if a log should be system-wide
const isSystemLog = (message, meta = {}) => {
	const systemKeywords = [
		'server started',
		'server stopped',
		'configuration loaded',
		'session limits initialized',
		'database connected',
		'redis connected',
		'critical error',
		'server health',
		'memory usage',
		'startup',
	];

	// Check if it's a system-level log (no sessionId or contains system keywords)
	const messageStr = message.toLowerCase();
	const isSystemKeyword = systemKeywords.some((keyword) =>
		messageStr.includes(keyword)
	);
	const hasNoSession = !meta.sessionId;
	const isCritical =
		meta.level === 'error' &&
		(messageStr.includes('server') || messageStr.includes('critical'));

	return (
		isSystemKeyword ||
		(hasNoSession && (isCritical || messageStr.includes('server')))
	);
};

// Add logs to appropriate storage (system or session-specific)
const addLogToStorage = (type, level, message, meta = {}) => {
	const logEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		meta: { ...meta, logType: meta.sessionId ? 'session' : 'system' },
	};

	// Determine storage location
	if (isSystemLog(message, { ...meta, level })) {
		// Add to system logs
		if (logStorage.system[type]) {
			logStorage.system[type].push(logEntry);
			// Keep only the latest entries
			if (logStorage.system[type].length > logStorage.maxLogEntries) {
				logStorage.system[type] = logStorage.system[type].slice(
					-logStorage.maxLogEntries
				);
			}
		}
	} else if (meta.sessionId) {
		// Add to session-specific logs
		if (!logStorage.sessions.has(meta.sessionId)) {
			// Check session limit to prevent memory bloat
			if (logStorage.sessions.size >= logStorage.maxSessions) {
				// Remove oldest session logs
				const oldestSession = logStorage.sessions.keys().next().value;
				logStorage.sessions.delete(oldestSession);
				logger.warn('Removed oldest session logs due to memory limit', {
					removedSession: oldestSession,
					currentSessions: logStorage.sessions.size,
				});
			}
			logStorage.sessions.set(meta.sessionId, { backend: [], mcp: [] });
		}

		const sessionLogs = logStorage.sessions.get(meta.sessionId);
		if (sessionLogs[type]) {
			sessionLogs[type].push(logEntry);
			// Keep only the latest entries per session
			if (sessionLogs[type].length > logStorage.maxLogEntries) {
				sessionLogs[type] = sessionLogs[type].slice(-logStorage.maxLogEntries);
			}
		}
	}
};

// Get logs for a specific session (combines system + session logs)
const getLogsForSession = (sessionId, type, options = {}) => {
	const systemLogs = logStorage.system[type] || [];
	const sessionLogs = logStorage.sessions.get(sessionId)?.[type] || [];

	// Combine and sort by timestamp
	const combinedLogs = [...systemLogs, ...sessionLogs].sort(
		(a, b) => new Date(a.timestamp) - new Date(b.timestamp)
	);

	// Apply filtering if provided
	let filteredLogs = combinedLogs;

	if (options.level) {
		filteredLogs = filteredLogs.filter((log) => log.level === options.level);
	}

	if (options.since) {
		const sinceDate = new Date(options.since);
		filteredLogs = filteredLogs.filter(
			(log) => new Date(log.timestamp) >= sinceDate
		);
	}

	// Apply limit
	const limitNum = Math.min(parseInt(options.limit || 25), 100);
	return filteredLogs.slice(-limitNum);
};

// Session log cleanup utility
const cleanupSessionLogs = (sessionIds) => {
	if (!Array.isArray(sessionIds)) {
		sessionIds = [sessionIds];
	}

	let cleanedCount = 0;
	for (const sessionId of sessionIds) {
		if (logStorage.sessions.has(sessionId)) {
			logStorage.sessions.delete(sessionId);
			cleanedCount++;
		}
	}

	if (cleanedCount > 0) {
		logger.info('Cleaned up session logs', {
			cleanedSessions: cleanedCount,
			remainingSessions: logStorage.sessions.size,
		});
	}

	return cleanedCount;
};

// Export cleanup function for use by rate limiting middleware
global.cleanupSessionLogs = cleanupSessionLogs;

// Enhanced logger override to capture logs with session context
const originalLoggerMethods = {};
['error', 'warn', 'info', 'debug'].forEach((level) => {
	originalLoggerMethods[level] = logger[level].bind(logger);
	logger[level] = (message, meta = {}) => {
		// Call original logger
		originalLoggerMethods[level](message, meta);

		// Store in memory for API access with session context
		addLogToStorage('backend', level, message, meta);
	};
});

// Session-aware logging helper for middleware/routes
const createSessionLogger = (sessionId) => {
	return {
		error: (message, meta = {}) =>
			logger.error(message, { ...meta, sessionId }),
		warn: (message, meta = {}) => logger.warn(message, { ...meta, sessionId }),
		info: (message, meta = {}) => logger.info(message, { ...meta, sessionId }),
		debug: (message, meta = {}) =>
			logger.debug(message, { ...meta, sessionId }),
	};
};

// Set up MCP log callback to capture MCP process logs with session context
setMcpLogCallback((level, message, meta) => {
	addLogToStorage('mcp', level, message, meta);
});

// Backend logs endpoint - now session-isolated with system logs
app.get('/api/logs/backend', accessControl, sessionTracker, (req, res) => {
	const { limit = 25, level, since } = req.query; // Reduced default for demo/learning app
	const sessionId = req.sessionId;

	try {
		const logs = getLogsForSession(sessionId, 'backend', {
			limit,
			level,
			since,
		});

		// Get counts for response metadata
		const systemCount = logStorage.system.backend.length;
		const sessionCount =
			logStorage.sessions.get(sessionId)?.backend.length || 0;

		res.json({
			success: true,
			logs,
			count: logs.length,
			metadata: {
				sessionId,
				systemLogs: systemCount,
				sessionLogs: sessionCount,
				totalCombined: systemCount + sessionCount,
			},
			filters: { level, since, limit: Math.min(parseInt(limit), 100) },
			note: 'Showing system logs + your session logs (privacy protected)',
		});
	} catch (error) {
		const sessionLogger = createSessionLogger(sessionId);
		sessionLogger.error('Backend logs endpoint error', {
			error: error.message,
		});
		res.status(500).json({
			error: 'Failed to retrieve backend logs',
			code: 'LOGS_ERROR',
		});
	}
});

// MCP logs endpoint - now session-isolated with system logs
app.get('/api/logs/mcp', accessControl, sessionTracker, (req, res) => {
	const { limit = 20, level, since } = req.query; // Reduced default for demo/learning app
	const sessionId = req.sessionId;

	try {
		const logs = getLogsForSession(sessionId, 'mcp', { limit, level, since });

		// Get counts for response metadata
		const systemCount = logStorage.system.mcp.length;
		const sessionCount = logStorage.sessions.get(sessionId)?.mcp.length || 0;

		res.json({
			success: true,
			logs,
			count: logs.length,
			metadata: {
				sessionId,
				systemLogs: systemCount,
				sessionLogs: sessionCount,
				totalCombined: systemCount + sessionCount,
			},
			filters: { level, since, limit: Math.min(parseInt(limit), 100) },
			note: 'Showing system MCP logs + your session MCP logs (privacy protected)',
		});
	} catch (error) {
		const sessionLogger = createSessionLogger(sessionId);
		sessionLogger.error('MCP logs endpoint error', { error: error.message });
		res.status(500).json({
			error: 'Failed to retrieve MCP logs',
			code: 'LOGS_ERROR',
		});
	}
});

// General logs endpoint (updated for session-isolated logging)
app.get('/api/logs', accessControl, sessionTracker, (req, res) => {
	const sessionId = req.sessionId;
	const sessionLogs = logStorage.sessions.get(sessionId);

	res.json({
		message: 'Session-isolated logging system with system log inclusion',
		privacy: 'You can only see your own session logs + essential system logs',
		endpoints: {
			'/api/logs/backend': 'Backend server logs (system + your session)',
			'/api/logs/mcp': 'MCP process logs (system + your session)',
		},
		queryParameters: {
			limit: 'Number of log entries to return (max 100, default 25/20)',
			level: 'Filter by log level (error, warn, info, debug)',
			since: 'ISO timestamp to filter logs from (e.g., 2024-01-01T00:00:00Z)',
		},
		examples: {
			'Get latest 50 backend logs': '/api/logs/backend?limit=50',
			'Get only error logs': '/api/logs/backend?level=error',
			'Get logs since specific time':
				'/api/logs/backend?since=2024-01-01T12:00:00Z',
		},
		sessionInfo: {
			sessionId,
			systemLogsStored: {
				backend: logStorage.system.backend.length,
				mcp: logStorage.system.mcp.length,
			},
			sessionLogsStored: {
				backend: sessionLogs?.backend.length || 0,
				mcp: sessionLogs?.mcp.length || 0,
			},
			totalActiveSessions: logStorage.sessions.size,
		},
	});
});

// 404 handler
app.use('*', (req, res) => {
	logger.warn('Route not found', {
		method: req.method,
		path: req.originalUrl,
		ip: req.ip,
	});

	res.status(404).json({
		error: 'Route not found',
		code: 'NOT_FOUND',
		availableEndpoints: [
			'GET /health',
			'GET /api/info',
			'GET /api/status',
			'GET /api/session-info',
			'POST /api/clear-session',
			'POST /api/claude',
			'POST /api/lifx/:action',
			'GET /api/logs',
			'GET /api/logs/backend',
			'GET /api/logs/mcp',
		],
	});
});

// Global error handler
app.use((error, req, res, next) => {
	logger.error('Unhandled error', {
		requestId: req.requestId,
		error: error.message,
		stack: error.stack,
	});

	// Don't leak error details in production
	const isDevelopment = process.env.NODE_ENV === 'development';

	res.status(500).json({
		error: 'Internal server error',
		code: 'INTERNAL_ERROR',
		requestId: req.requestId,
		...(isDevelopment && {
			details: error.message,
			stack: error.stack,
		}),
	});
});

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
	const server = app.listen(PORT, () => {
		logger.info('LIFX MCP Server Backend started', {
			port: PORT,
			environment: process.env.NODE_ENV || 'development',
			nodeVersion: process.version,
			allowedOrigins: corsOptions.origin,
		});
	});

	// Graceful shutdown handling
	const gracefulShutdown = (signal) => {
		logger.info(`Received ${signal}, shutting down gracefully`);

		server.close(() => {
			logger.info('HTTP server closed');
			process.exit(0);
		});

		// Force close after 10 seconds
		setTimeout(() => {
			logger.error('Forced shutdown after timeout');
			process.exit(1);
		}, 10000);
	};

	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
	process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', {
		error: error.message,
		stack: error.stack,
	});
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection', {
		reason: reason,
		promise: promise,
	});
});

module.exports = app;
