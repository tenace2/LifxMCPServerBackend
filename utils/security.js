// Security utility functions

const crypto = require('crypto');

/**
 * Generate a secure session ID
 */
const generateSessionId = () => {
	const timestamp = Date.now();
	const random = crypto.randomBytes(16).toString('hex');
	return `session_${timestamp}_${random}`;
};

/**
 * Validate API key format
 */
const validateApiKeyFormat = (key, type) => {
	if (!key || typeof key !== 'string') {
		return false;
	}

	switch (type) {
		case 'claude':
			return key.startsWith('sk-ant-') && key.length > 20;
		case 'lifx':
			return key.length >= 20;
		default:
			return false;
	}
};

/**
 * Sanitize string input to prevent XSS
 */
const sanitizeString = (str) => {
	if (typeof str !== 'string') return str;

	return str
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/javascript:/gi, '')
		.replace(/on\w+\s*=/gi, '')
		.trim();
};

/**
 * Rate limit key generator
 */
const getRateLimitKey = (ip, sessionId = null) => {
	if (sessionId) {
		return `session:${sessionId}`;
	}
	return `ip:${ip}`;
};

/**
 * Validate request origin
 */
const isValidOrigin = (origin, allowedOrigins) => {
	if (!origin) return false;

	const allowed = Array.isArray(allowedOrigins)
		? allowedOrigins
		: allowedOrigins.split(',');

	return allowed.some((allowedOrigin) => {
		// Exact match
		if (origin === allowedOrigin.trim()) return true;

		// Pattern match for localhost with different ports
		if (allowedOrigin.includes('localhost') && origin.includes('localhost')) {
			return true;
		}

		return false;
	});
};

/**
 * Hash sensitive data for logging
 */
const hashForLogging = (data) => {
	if (!data) return '[EMPTY]';
	return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
};

module.exports = {
	generateSessionId,
	validateApiKeyFormat,
	sanitizeString,
	getRateLimitKey,
	isValidOrigin,
	hashForLogging,
};
