const rateLimit = require('express-rate-limit');
const logger = require('../services/logger');

// Session tracking
const ipSessionMap = new Map(); // IP → Set of session IDs
const sessionRequestCount = new Map(); // sessionId → request count
const sessionTimestamps = new Map(); // sessionId → creation timestamp

// Configuration
const SESSION_REQUEST_LIMIT =
	parseInt(process.env.SESSION_REQUEST_LIMIT) || 100;
const IP_RATE_LIMIT_WINDOW =
	parseInt(process.env.IP_RATE_LIMIT_WINDOW) || 60000;
const IP_RATE_LIMIT_MAX = parseInt(process.env.IP_RATE_LIMIT_MAX) || 30;

// Multi-user configuration - removed IP-based session limits for cloud deployment
const isDevelopment = process.env.NODE_ENV === 'development';

logger.info('Session limits initialized', {
	environment: process.env.NODE_ENV || 'production',
	sessionLimiting: 'session-based only (multi-user enabled)',
	isDevelopmentMode: isDevelopment,
});

// Session tracker middleware - supports multiple users
const sessionTracker = (req, res, next) => {
	const clientIP = req.ip;
	const sessionId = req.headers['x-session-id'];

	if (!sessionId) {
		return res.status(400).json({
			error: 'Session ID required',
			code: 'MISSING_SESSION_ID',
		});
	}

	// Track all sessions (no IP-based restrictions for multi-user support)
	if (!ipSessionMap.has(clientIP)) {
		ipSessionMap.set(clientIP, new Set());
	}

	const sessionsForIP = ipSessionMap.get(clientIP);

	// Track session creation time
	if (!sessionTimestamps.has(sessionId)) {
		sessionTimestamps.set(sessionId, Date.now());
		logger.info('New session created', {
			sessionId,
			clientIP,
			totalActiveSessions: sessionTimestamps.size,
		});
	}

	sessionsForIP.add(sessionId);
	req.sessionId = sessionId;
	next();
};

// Session request limiting
const sessionLimiter = (req, res, next) => {
	const sessionId = req.sessionId;
	const currentCount = sessionRequestCount.get(sessionId) || 0;

	if (currentCount >= SESSION_REQUEST_LIMIT) {
		logger.warn('Session request limit exceeded', {
			sessionId,
			requestCount: currentCount,
			limit: SESSION_REQUEST_LIMIT,
		});

		return res.status(429).json({
			error: `Session request limit exceeded (${SESSION_REQUEST_LIMIT} requests)`,
			requestsUsed: currentCount,
			code: 'SESSION_LIMIT',
		});
	}

	const newCount = currentCount + 1;
	sessionRequestCount.set(sessionId, newCount);

	// Add request count headers
	res.set({
		'X-Requests-Used': newCount.toString(),
		'X-Requests-Remaining': (SESSION_REQUEST_LIMIT - newCount).toString(),
	});

	next();
};

// IP-based rate limiting (backup protection)
const ipLimiter = rateLimit({
	windowMs: IP_RATE_LIMIT_WINDOW,
	max: IP_RATE_LIMIT_MAX,
	message: {
		error: 'IP rate limit exceeded',
		code: 'IP_RATE_LIMIT',
	},
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		logger.warn('IP rate limit exceeded', {
			ip: req.ip,
			userAgent: req.headers['user-agent'],
		});

		res.status(429).json({
			error: 'IP rate limit exceeded',
			code: 'IP_RATE_LIMIT',
		});
	},
});

// Resource limiting (prevent too many concurrent MCP processes)
const MAX_CONCURRENT_MCP = parseInt(process.env.MAX_CONCURRENT_MCP) || 5;
let activeMcpCount = 0;

const mcpLimiter = (req, res, next) => {
	if (activeMcpCount >= MAX_CONCURRENT_MCP) {
		logger.warn('Server busy - too many concurrent MCP processes', {
			activeMcpCount,
			maxAllowed: MAX_CONCURRENT_MCP,
			ip: req.ip,
		});

		return res.status(429).json({
			error: 'Server busy, try again later',
			code: 'SERVER_BUSY',
		});
	}

	activeMcpCount++;

	// Decrement count when request finishes
	res.on('finish', () => {
		activeMcpCount--;
	});

	res.on('close', () => {
		activeMcpCount--;
	});

	next();
};

// Session cleanup utility
const cleanupSessions = () => {
	const now = Date.now();
	const SESSION_MAX_AGE =
		parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000; // 24 hours

	let cleanedCount = 0;

	for (const [sessionId, timestamp] of sessionTimestamps.entries()) {
		if (now - timestamp > SESSION_MAX_AGE) {
			// Remove from all tracking maps
			sessionRequestCount.delete(sessionId);
			sessionTimestamps.delete(sessionId);

			// Remove from IP mappings
			for (const [ip, sessions] of ipSessionMap.entries()) {
				sessions.delete(sessionId);
				if (sessions.size === 0) {
					ipSessionMap.delete(ip);
				}
			}

			cleanedCount++;
		}
	}

	if (cleanedCount > 0) {
		logger.info('Cleaned up expired sessions', {
			cleanedSessions: cleanedCount,
			activeSessions: sessionTimestamps.size,
		});
	}
};

// Start periodic cleanup
const SESSION_CLEANUP_INTERVAL =
	parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 60 * 60 * 1000; // 1 hour
setInterval(cleanupSessions, SESSION_CLEANUP_INTERVAL);

// Clear specific session utility
const clearSession = (sessionId, clientIP = null) => {
	try {
		let cleared = false;

		// Remove from session tracking maps
		if (sessionRequestCount.has(sessionId)) {
			sessionRequestCount.delete(sessionId);
			cleared = true;
		}

		if (sessionTimestamps.has(sessionId)) {
			sessionTimestamps.delete(sessionId);
			cleared = true;
		}

		// Remove from IP mappings
		if (clientIP && ipSessionMap.has(clientIP)) {
			const sessions = ipSessionMap.get(clientIP);
			if (sessions.has(sessionId)) {
				sessions.delete(sessionId);
				cleared = true;

				// Clean up empty IP entry
				if (sessions.size === 0) {
					ipSessionMap.delete(clientIP);
				}
			}
		} else {
			// If no IP provided, search all IPs
			for (const [ip, sessions] of ipSessionMap.entries()) {
				if (sessions.has(sessionId)) {
					sessions.delete(sessionId);
					cleared = true;

					// Clean up empty IP entry
					if (sessions.size === 0) {
						ipSessionMap.delete(ip);
					}
					break;
				}
			}
		}

		if (cleared) {
			logger.info('Session cleared manually', {
				sessionId,
				clientIP: clientIP || 'auto-detected',
				activeSessions: sessionTimestamps.size,
			});
		}

		return cleared;
	} catch (error) {
		logger.error('Error clearing session', {
			sessionId,
			clientIP,
			error: error.message,
		});
		return false;
	}
};

// Get session information
const getSessionInfo = (sessionId, clientIP) => {
	try {
		const requestCount = sessionRequestCount.get(sessionId) || 0;
		const createdAt = sessionTimestamps.get(sessionId);
		const remainingRequests = SESSION_REQUEST_LIMIT - requestCount;

		// Find which IP this session belongs to
		let associatedIP = clientIP;
		if (!associatedIP) {
			for (const [ip, sessions] of ipSessionMap.entries()) {
				if (sessions.has(sessionId)) {
					associatedIP = ip;
					break;
				}
			}
		}

		return {
			sessionId,
			clientIP: associatedIP,
			requestsUsed: requestCount,
			requestsRemaining: remainingRequests,
			requestLimit: SESSION_REQUEST_LIMIT,
			createdAt: createdAt ? new Date(createdAt).toISOString() : null,
			sessionAge: createdAt ? Date.now() - createdAt : null,
			isActive: sessionTimestamps.has(sessionId),
		};
	} catch (error) {
		logger.error('Error getting session info', {
			sessionId,
			clientIP,
			error: error.message,
		});
		return null;
	}
};

module.exports = {
	sessionTracker,
	sessionLimiter,
	ipLimiter,
	mcpLimiter,
	cleanupSessions,
	clearSession,
	getSessionInfo,
};
