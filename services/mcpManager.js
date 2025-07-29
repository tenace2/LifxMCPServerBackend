const { spawn } = require('child_process');
const path = require('path');
const logger = require('./logger');

// MCP log callback - will be set by main server
let mcpLogCallback = null;

// Set callback for MCP log capture
const setMcpLogCallback = (callback) => {
	mcpLogCallback = callback;
};

// Helper to capture MCP logs with session context
const captureMcpLog = (level, message, meta = {}) => {
	if (mcpLogCallback) {
		mcpLogCallback(level, message, meta);
	}
};

// Configuration
const MCP_SPAWN_TIMEOUT = parseInt(process.env.MCP_SPAWN_TIMEOUT) || 30000;
const MCP_METHOD_TIMEOUT = parseInt(process.env.MCP_METHOD_TIMEOUT) || 10000;

// Spawn MCP server process with session context
const spawnMcpServer = async (lifxApiKey, sessionId = null) => {
	return new Promise((resolve, reject) => {
		const serverPath = path.join(__dirname, '..', 'lifx-api-mcp-server.js');

		const mcpProcess = spawn('node', [serverPath], {
			env: {
				...process.env,
				LIFX_TOKEN: lifxApiKey,
				LOG_LEVEL: process.env.LOG_LEVEL || 'info',
				SESSION_ID: sessionId || 'system', // Pass session context to child process
			},
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		// Set process timeout
		const timeout = setTimeout(() => {
			if (!mcpProcess.killed) {
				mcpProcess.kill('SIGTERM');
				captureMcpLog('error', 'MCP server spawn timeout', {
					sessionId,
					pid: mcpProcess.pid,
				});
				reject(new Error('MCP server spawn timeout'));
			}
		}, MCP_SPAWN_TIMEOUT);

		// Handle successful spawn
		mcpProcess.on('spawn', () => {
			clearTimeout(timeout);
			captureMcpLog('debug', 'MCP server spawned successfully', {
				sessionId,
				pid: mcpProcess.pid,
			});
			resolve(mcpProcess);
		});

		// Handle spawn errors
		mcpProcess.on('error', (error) => {
			clearTimeout(timeout);
			logger.error('MCP server spawn error', {
				error: error.message,
				sessionId,
			});
			reject(error);
		});

		// Handle process exit
		mcpProcess.on('exit', (code, signal) => {
			const exitMessage = `MCP server exited with code ${code}, signal ${signal}`;
			if (code !== 0) {
				logger.warn(exitMessage, {
					code,
					signal,
					pid: mcpProcess.pid,
					sessionId,
				});
				captureMcpLog('warn', exitMessage, {
					code,
					signal,
					pid: mcpProcess.pid,
					sessionId,
				});
			} else {
				logger.debug(exitMessage, {
					code,
					signal,
					pid: mcpProcess.pid,
					sessionId,
				});
				captureMcpLog('debug', exitMessage, {
					code,
					signal,
					pid: mcpProcess.pid,
					sessionId,
				});
			}
		});

		// Capture stdout for MCP logs
		mcpProcess.stdout.on('data', (data) => {
			const output = data.toString().trim();
			if (output) {
				logger.debug('MCP server stdout', {
					output,
					pid: mcpProcess.pid,
					sessionId,
				});
				captureMcpLog('info', 'MCP stdout', {
					output,
					pid: mcpProcess.pid,
					sessionId,
				});
			}
		});

		// Log stderr output
		mcpProcess.stderr.on('data', (data) => {
			const error = data.toString().trim();
			if (error) {
				logger.warn('MCP server stderr', {
					error,
					pid: mcpProcess.pid,
					sessionId,
				});
				captureMcpLog('error', 'MCP stderr', {
					error,
					pid: mcpProcess.pid,
					sessionId,
				});
			}
		});
	});
};

// Call MCP method via JSON-RPC
const callMcpMethod = async (
	mcpProcess,
	method,
	params = {},
	sessionId = null
) => {
	return new Promise((resolve, reject) => {
		const requestId = `req_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`;

		const request = {
			jsonrpc: '2.0',
			id: requestId,
			method: 'tools/call',
			params: {
				name: method,
				arguments: params,
			},
		};

		let responseData = '';
		let timeoutHandle;

		// Set up response handler
		const responseHandler = (data) => {
			responseData += data.toString();
			// Try to parse complete JSON responses
			const lines = responseData.split('\n');
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].trim();
				if (!line) continue;

				try {
					const response = JSON.parse(line);
					if (response.id === requestId) {
						clearTimeout(timeoutHandle);
						mcpProcess.stdout.off('data', responseHandler);

						if (response.error) {
							logger.error('MCP method error', {
								method,
								error: response.error,
								requestId,
								sessionId,
							});
							reject(new Error(response.error.message || 'MCP method error'));
						} else {
							logger.debug('MCP method success', {
								method,
								requestId,
								resultType: typeof response.result,
								sessionId,
							});
							resolve(response.result);
						}
						return;
					}
				} catch (e) {
					// Incomplete JSON, continue waiting
					continue;
				}
			}

			// Keep only the last incomplete line
			responseData = lines[lines.length - 1];
		};

		// Set up timeout
		timeoutHandle = setTimeout(() => {
			mcpProcess.stdout.off('data', responseHandler);
			logger.error('MCP method call timeout', {
				method,
				requestId,
				timeout: MCP_METHOD_TIMEOUT,
				sessionId,
			});
			reject(new Error('MCP method call timeout'));
		}, MCP_METHOD_TIMEOUT);

		// Listen for response
		mcpProcess.stdout.on('data', responseHandler);

		// Send request
		try {
			mcpProcess.stdin.write(JSON.stringify(request) + '\n');
			logger.debug('MCP method request sent', { method, requestId, sessionId });
		} catch (error) {
			clearTimeout(timeoutHandle);
			mcpProcess.stdout.off('data', responseHandler);
			logger.error('Failed to send MCP request', {
				method,
				error: error.message,
				requestId,
				sessionId,
			});
			reject(error);
		}
	});
};

// Initialize MCP server (call this to verify connection)
const initializeMcpServer = async (mcpProcess, sessionId = null) => {
	try {
		// Send initialize request
		const initRequest = {
			jsonrpc: '2.0',
			id: 'init',
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {},
				},
				clientInfo: {
					name: 'lifx-mcp-server-backend',
					version: '1.0.0',
				},
			},
		};

		mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');

		// Wait for initialization response
		return new Promise((resolve, reject) => {
			let responseData = '';

			const responseHandler = (data) => {
				responseData += data.toString();

				try {
					const response = JSON.parse(responseData);
					if (response.id === 'init') {
						mcpProcess.stdout.off('data', responseHandler);

						if (response.error) {
							reject(new Error(response.error.message));
						} else {
							logger.debug('MCP server initialized', { sessionId });
							resolve(response.result);
						}
					}
				} catch (e) {
					// Incomplete JSON, wait for more data
				}
			};

			mcpProcess.stdout.on('data', responseHandler);

			setTimeout(() => {
				mcpProcess.stdout.off('data', responseHandler);
				reject(new Error('MCP initialization timeout'));
			}, 5000);
		});
	} catch (error) {
		logger.error('MCP initialization failed', {
			error: error.message,
			sessionId,
		});
		throw error;
	}
};

// Clean up MCP process
const cleanupMcpProcess = (mcpProcess, sessionId = null) => {
	if (mcpProcess && !mcpProcess.killed) {
		try {
			mcpProcess.kill('SIGTERM');

			// Force kill after 5 seconds
			setTimeout(() => {
				if (!mcpProcess.killed) {
					mcpProcess.kill('SIGKILL');
					logger.warn('Force killed MCP process', { sessionId });
				}
			}, 5000);

			logger.debug('MCP process cleanup initiated', { sessionId });
		} catch (error) {
			logger.error('Error cleaning up MCP process', {
				error: error.message,
				sessionId,
			});
		}
	}
};

module.exports = {
	spawnMcpServer,
	callMcpMethod,
	initializeMcpServer,
	cleanupMcpProcess,
	setMcpLogCallback,
};
