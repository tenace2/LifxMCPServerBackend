const logger = require('../services/logger');

// Validate Claude API request
const validateClaudeRequest = (req, res, next) => {
	const { claudeApiKey, lifxApiKey, message, maxTokens } = req.body;

	// Validate Claude API key format
	if (!claudeApiKey || !claudeApiKey.startsWith('sk-ant-')) {
		return res.status(400).json({
			error: 'Invalid Claude API key format',
			code: 'INVALID_CLAUDE_KEY',
		});
	}

	// Validate LIFX API key
	if (!lifxApiKey || lifxApiKey.length < 20) {
		return res.status(400).json({
			error: 'Invalid LIFX API key format',
			code: 'INVALID_LIFX_KEY',
		});
	}

	// Limit message length
	if (!message || typeof message !== 'string' || message.length > 1000) {
		return res.status(400).json({
			error: 'Message required and must be under 1000 characters',
			code: 'INVALID_MESSAGE',
		});
	}

	// Validate token limits
	if (maxTokens && (maxTokens < 50 || maxTokens > 4000)) {
		return res.status(400).json({
			error: 'Max tokens must be between 50 and 4000',
			code: 'INVALID_MAX_TOKENS',
		});
	}

	next();
};

// Validate direct LIFX control request
const validateLifxRequest = (req, res, next) => {
	const { lifxApiKey } = req.body;
	const { action } = req.params;

	// Validate LIFX API key
	if (!lifxApiKey || lifxApiKey.length < 20) {
		return res.status(400).json({
			error: 'Invalid LIFX API key format',
			code: 'INVALID_LIFX_KEY',
		});
	}

	// Validate action parameter
	const allowedActions = [
		'list_lights',
		'set_light_state',
		'toggle_lights',
		'set_brightness',
		'set_color',
		'breathe_effect',
		'pulse_effect',
	];

	if (!action || !allowedActions.includes(action)) {
		return res.status(400).json({
			error: `Invalid action. Allowed actions: ${allowedActions.join(', ')}`,
			code: 'INVALID_ACTION',
		});
	}

	next();
};

// General request sanitization
const sanitizeRequest = (req, res, next) => {
	// Remove any potential XSS content from string fields
	const sanitizeString = (str) => {
		if (typeof str !== 'string') return str;
		return str
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/javascript:/gi, '')
			.replace(/on\w+\s*=/gi, '');
	};

	// Sanitize body
	if (req.body && typeof req.body === 'object') {
		for (const [key, value] of Object.entries(req.body)) {
			if (typeof value === 'string') {
				req.body[key] = sanitizeString(value);
			}
		}
	}

	next();
};

// Content-Type validation for POST requests
const validateContentType = (req, res, next) => {
	if (req.method === 'POST' && !req.is('application/json')) {
		return res.status(400).json({
			error: 'Content-Type must be application/json',
			code: 'INVALID_CONTENT_TYPE',
		});
	}

	next();
};

// Request size validation
const validateRequestSize = (req, res, next) => {
	const contentLength = parseInt(req.headers['content-length'] || '0');
	const maxSize = 1024 * 1024; // 1MB

	if (contentLength > maxSize) {
		return res.status(413).json({
			error: 'Request too large',
			code: 'REQUEST_TOO_LARGE',
		});
	}

	next();
};

module.exports = {
	validateClaudeRequest,
	validateLifxRequest,
	sanitizeRequest,
	validateContentType,
	validateRequestSize,
};
