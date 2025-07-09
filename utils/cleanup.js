// Cleanup utilities for resource management

const logger = require('../services/logger');

// Active processes tracking
const activeProcesses = new Set();

/**
 * Register a process for cleanup tracking
 */
const registerProcess = (process) => {
	if (process && process.pid) {
		activeProcesses.add(process);

		// Auto-remove when process exits
		process.on('exit', () => {
			activeProcesses.delete(process);
		});

		logger.debug('Process registered for cleanup', { pid: process.pid });
	}
};

/**
 * Cleanup a specific process
 */
const cleanupProcess = (process) => {
	if (!process || process.killed) return;

	try {
		process.kill('SIGTERM');
		activeProcesses.delete(process);

		// Force kill after 5 seconds
		setTimeout(() => {
			if (!process.killed) {
				process.kill('SIGKILL');
				logger.warn('Force killed process', { pid: process.pid });
			}
		}, 5000);

		logger.debug('Process cleanup initiated', { pid: process.pid });
	} catch (error) {
		logger.error('Error during process cleanup', {
			pid: process.pid,
			error: error.message,
		});
	}
};

/**
 * Cleanup all active processes
 */
const cleanupAllProcesses = () => {
	logger.info('Cleaning up all active processes', {
		count: activeProcesses.size,
	});

	for (const process of activeProcesses) {
		cleanupProcess(process);
	}

	activeProcesses.clear();
};

/**
 * Memory usage monitoring
 */
const getMemoryUsage = () => {
	const usage = process.memoryUsage();
	return {
		rss: Math.round(usage.rss / 1024 / 1024), // MB
		heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
		heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
		external: Math.round(usage.external / 1024 / 1024), // MB
	};
};

/**
 * Log memory usage if it's high
 */
const checkMemoryUsage = () => {
	const usage = getMemoryUsage();
	const threshold = 500; // MB

	if (usage.rss > threshold) {
		logger.warn('High memory usage detected', {
			memoryUsage: usage,
			activeProcesses: activeProcesses.size,
			threshold: `${threshold}MB`,
		});
	}

	return usage;
};

/**
 * Periodic cleanup function
 */
const periodicCleanup = () => {
	// Check memory usage
	checkMemoryUsage();

	// Clean up dead processes
	for (const process of activeProcesses) {
		if (process.killed || process.exitCode !== null) {
			activeProcesses.delete(process);
		}
	}

	// Log active processes count
	if (activeProcesses.size > 0) {
		logger.debug('Active processes', { count: activeProcesses.size });
	}
};

// Start periodic cleanup
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(periodicCleanup, CLEANUP_INTERVAL);

// Cleanup on process exit
process.on('exit', () => {
	cleanupAllProcesses();
});

process.on('SIGTERM', () => {
	cleanupAllProcesses();
});

process.on('SIGINT', () => {
	cleanupAllProcesses();
});

module.exports = {
	registerProcess,
	cleanupProcess,
	cleanupAllProcesses,
	getMemoryUsage,
	checkMemoryUsage,
	periodicCleanup,
};
