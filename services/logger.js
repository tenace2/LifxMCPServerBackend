const winston = require('winston');

const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json()
	),
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			),
		}),
	],
});

// Add file logging in production
if (process.env.NODE_ENV === 'production') {
	logger.add(
		new winston.transports.File({
			filename: 'server.log',
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		})
	);
}

module.exports = logger;
