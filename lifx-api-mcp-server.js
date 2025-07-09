#!/usr/bin/env node

/**
 * LIFX API MCP Server
 *
 * This is a Model Context Protocol (MCP) server that provides tools for controlling LIFX smart lights.
 * It communicates via JSON-RPC over stdin/stdout and is designed to be spawned as a child process.
 */

const axios = require('axios');

// Configuration
const LIFX_API_BASE = 'https://api.lifx.com/v1';
const LIFX_TOKEN = process.env.LIFX_TOKEN;

if (!LIFX_TOKEN) {
	console.error(
		JSON.stringify({
			jsonrpc: '2.0',
			error: {
				code: -1,
				message: 'LIFX_TOKEN environment variable is required',
			},
		})
	);
	process.exit(1);
}

// Set up axios instance with auth
const lifxApi = axios.create({
	baseURL: LIFX_API_BASE,
	headers: {
		Authorization: `Bearer ${LIFX_TOKEN}`,
		'Content-Type': 'application/json',
	},
	timeout: 10000, // 10 second timeout
});

// Logging function
const log = (level, message, data = {}) => {
	if (process.env.LOG_LEVEL === 'debug' || level === 'error') {
		console.error(
			JSON.stringify({
				timestamp: new Date().toISOString(),
				level,
				message,
				...data,
			})
		);
	}
};

// MCP Tools Implementation
const tools = {
	// List available lights
	list_lights: async (params = {}) => {
		try {
			const { selector = 'all' } = params;

			log('debug', 'Listing lights', { selector });

			const response = await lifxApi.get(`/lights/${selector}`);

			const lights = response.data.map((light) => ({
				id: light.id,
				uuid: light.uuid,
				label: light.label,
				connected: light.connected,
				power: light.power,
				color: {
					hue: light.color.hue,
					saturation: light.color.saturation,
					brightness: light.brightness,
					kelvin: light.color.kelvin,
				},
				group: light.group,
				location: light.location,
				product: light.product,
			}));

			log('debug', 'Listed lights successfully', { count: lights.length });

			return {
				lights,
				count: lights.length,
			};
		} catch (error) {
			log('error', 'Failed to list lights', { error: error.message });
			throw new Error(
				`Failed to list lights: ${error.response?.data?.error || error.message}`
			);
		}
	},

	// Set light state (power, color, brightness)
	set_light_state: async (params) => {
		try {
			const { selector, power, color, brightness, duration = 1.0 } = params;

			if (!selector) {
				throw new Error('Selector is required');
			}

			log('debug', 'Setting light state', {
				selector,
				power,
				color,
				brightness,
				duration,
			});

			const payload = {};

			if (power !== undefined) {
				payload.power = power;
			}

			if (color !== undefined) {
				payload.color = color;
			}

			if (brightness !== undefined) {
				payload.brightness = brightness;
			}

			if (duration !== undefined) {
				payload.duration = duration;
			}

			const response = await lifxApi.put(`/lights/${selector}/state`, payload);

			log('debug', 'Set light state successfully', {
				selector,
				results: response.data.results?.length || 0,
			});

			return {
				results: response.data.results,
				message: `Successfully updated ${
					response.data.results?.length || 0
				} lights`,
			};
		} catch (error) {
			log('error', 'Failed to set light state', { error: error.message });
			throw new Error(
				`Failed to set light state: ${
					error.response?.data?.error || error.message
				}`
			);
		}
	},

	// Toggle lights on/off
	toggle_lights: async (params) => {
		try {
			const { selector, duration = 1.0 } = params;

			if (!selector) {
				throw new Error('Selector is required');
			}

			log('debug', 'Toggling lights', { selector, duration });

			const response = await lifxApi.post(`/lights/${selector}/toggle`, {
				duration,
			});

			log('debug', 'Toggled lights successfully', {
				selector,
				results: response.data.results?.length || 0,
			});

			return {
				results: response.data.results,
				message: `Successfully toggled ${
					response.data.results?.length || 0
				} lights`,
			};
		} catch (error) {
			log('error', 'Failed to toggle lights', { error: error.message });
			throw new Error(
				`Failed to toggle lights: ${
					error.response?.data?.error || error.message
				}`
			);
		}
	},

	// Set brightness only
	set_brightness: async (params) => {
		try {
			const { selector, brightness, duration = 1.0 } = params;

			if (!selector || brightness === undefined) {
				throw new Error('Selector and brightness are required');
			}

			log('debug', 'Setting brightness', { selector, brightness, duration });

			const response = await lifxApi.put(`/lights/${selector}/state`, {
				brightness,
				duration,
			});

			log('debug', 'Set brightness successfully', {
				selector,
				brightness,
				results: response.data.results?.length || 0,
			});

			return {
				results: response.data.results,
				message: `Successfully set brightness to ${Math.round(
					brightness * 100
				)}% for ${response.data.results?.length || 0} lights`,
			};
		} catch (error) {
			log('error', 'Failed to set brightness', { error: error.message });
			throw new Error(
				`Failed to set brightness: ${
					error.response?.data?.error || error.message
				}`
			);
		}
	},

	// Set color only
	set_color: async (params) => {
		try {
			const { selector, color, duration = 1.0 } = params;

			if (!selector || !color) {
				throw new Error('Selector and color are required');
			}

			log('debug', 'Setting color', { selector, color, duration });

			const response = await lifxApi.put(`/lights/${selector}/state`, {
				color,
				duration,
			});

			log('debug', 'Set color successfully', {
				selector,
				color,
				results: response.data.results?.length || 0,
			});

			return {
				results: response.data.results,
				message: `Successfully set color to ${color} for ${
					response.data.results?.length || 0
				} lights`,
			};
		} catch (error) {
			log('error', 'Failed to set color', { error: error.message });
			throw new Error(
				`Failed to set color: ${error.response?.data?.error || error.message}`
			);
		}
	},

	// Apply breathe effect
	breathe_effect: async (params) => {
		try {
			const {
				selector,
				color,
				from_color,
				period = 1.0,
				cycles = 1,
				persist = false,
			} = params;

			if (!selector || !color) {
				throw new Error('Selector and color are required');
			}

			log('debug', 'Applying breathe effect', {
				selector,
				color,
				from_color,
				period,
				cycles,
				persist,
			});

			const payload = {
				color,
				period,
				cycles,
				persist,
			};

			if (from_color) {
				payload.from_color = from_color;
			}

			const response = await lifxApi.post(
				`/lights/${selector}/effects/breathe`,
				payload
			);

			log('debug', 'Applied breathe effect successfully', {
				selector,
				results: response.data.results?.length || 0,
			});

			return {
				results: response.data.results,
				message: `Successfully applied breathe effect to ${
					response.data.results?.length || 0
				} lights`,
			};
		} catch (error) {
			log('error', 'Failed to apply breathe effect', { error: error.message });
			throw new Error(
				`Failed to apply breathe effect: ${
					error.response?.data?.error || error.message
				}`
			);
		}
	},

	// Apply pulse effect
	pulse_effect: async (params) => {
		try {
			const {
				selector,
				color,
				from_color,
				period = 1.0,
				cycles = 1,
				persist = false,
			} = params;

			if (!selector || !color) {
				throw new Error('Selector and color are required');
			}

			log('debug', 'Applying pulse effect', {
				selector,
				color,
				from_color,
				period,
				cycles,
				persist,
			});

			const payload = {
				color,
				period,
				cycles,
				persist,
			};

			if (from_color) {
				payload.from_color = from_color;
			}

			const response = await lifxApi.post(
				`/lights/${selector}/effects/pulse`,
				payload
			);

			log('debug', 'Applied pulse effect successfully', {
				selector,
				results: response.data.results?.length || 0,
			});

			return {
				results: response.data.results,
				message: `Successfully applied pulse effect to ${
					response.data.results?.length || 0
				} lights`,
			};
		} catch (error) {
			log('error', 'Failed to apply pulse effect', { error: error.message });
			throw new Error(
				`Failed to apply pulse effect: ${
					error.response?.data?.error || error.message
				}`
			);
		}
	},
};

// MCP Protocol Implementation
let requestId = 0;

// Handle incoming JSON-RPC requests
const handleRequest = async (request) => {
	try {
		const { jsonrpc, id, method, params } = request;

		if (jsonrpc !== '2.0') {
			throw new Error('Invalid JSON-RPC version');
		}

		log('debug', 'Received request', { method, id });

		// Handle initialization
		if (method === 'initialize') {
			return {
				jsonrpc: '2.0',
				id,
				result: {
					protocolVersion: '2024-11-05',
					capabilities: {
						tools: {
							listChanged: false,
						},
					},
					serverInfo: {
						name: 'lifx-api-mcp-server',
						version: '1.0.0',
					},
				},
			};
		}

		// Handle tool listing
		if (method === 'tools/list') {
			return {
				jsonrpc: '2.0',
				id,
				result: {
					tools: Object.keys(tools).map((name) => ({
						name,
						description: `LIFX ${name.replace(/_/g, ' ')} tool`,
						inputSchema: {
							type: 'object',
							properties: {},
						},
					})),
				},
			};
		}

		// Handle tool calls
		if (method === 'tools/call') {
			const { name, arguments: args } = params;

			if (!tools[name]) {
				throw new Error(`Unknown tool: ${name}`);
			}

			const result = await tools[name](args || {});

			return {
				jsonrpc: '2.0',
				id,
				result: {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				},
			};
		}

		throw new Error(`Unknown method: ${method}`);
	} catch (error) {
		log('error', 'Request handling error', { error: error.message });

		return {
			jsonrpc: '2.0',
			id: request.id || null,
			error: {
				code: -1,
				message: error.message,
			},
		};
	}
};

// Main process loop
let inputBuffer = '';

process.stdin.on('data', async (data) => {
	inputBuffer += data.toString();

	// Process complete lines
	const lines = inputBuffer.split('\n');
	inputBuffer = lines.pop() || ''; // Keep incomplete line in buffer

	for (const line of lines) {
		if (!line.trim()) continue;

		try {
			const request = JSON.parse(line);
			const response = await handleRequest(request);

			// Send response
			process.stdout.write(JSON.stringify(response) + '\n');
		} catch (error) {
			log('error', 'JSON parse error', { error: error.message, line });

			// Send error response
			const errorResponse = {
				jsonrpc: '2.0',
				id: null,
				error: {
					code: -32700,
					message: 'Parse error',
				},
			};

			process.stdout.write(JSON.stringify(errorResponse) + '\n');
		}
	}
});

// Handle process termination
process.on('SIGTERM', () => {
	log('debug', 'LIFX MCP server shutting down');
	process.exit(0);
});

process.on('SIGINT', () => {
	log('debug', 'LIFX MCP server interrupted');
	process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
	log('error', 'Uncaught exception', {
		error: error.message,
		stack: error.stack,
	});
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	log('error', 'Unhandled rejection', { reason, promise });
	process.exit(1);
});

log('debug', 'LIFX MCP server started', {
	pid: process.pid,
	hasToken: !!LIFX_TOKEN,
});
