const logger = require('../services/logger');

// Simple access key protection
const ACCESS_KEY = process.env.DEMO_ACCESS_KEY || 'LifxDemo';

const accessControl = (req, res, next) => {
	const accessKey = req.headers['x-demo-key'];

	if (accessKey !== ACCESS_KEY) {
		logger.warn('Unauthorized access attempt', {
			ip: req.ip,
			userAgent: req.headers['user-agent'],
			providedKey: accessKey ? '[PROVIDED]' : '[MISSING]',
		});

		return res.status(401).json({
			error: 'Demo access key required',
			code: 'UNAUTHORIZED',
		});
	}

	next();
};

module.exports = { accessControl };
