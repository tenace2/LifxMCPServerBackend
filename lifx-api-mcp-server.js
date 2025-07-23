#!/usr/bin/env node

/**
 * LIFX API MCP Server
 *
 * This is a Model Context Protocol (MCP) server that provides tools for controlling LIFX smart lights.
 * It communicates via JSON-RPC over stdin/stdout and is designed to be spawned as a child process.
 *
 * Enhanced Features:
 * - Detailed tool schemas with comprehensive selector documentation
 * - Smart error messages with available groups/labels when selectors fail
 * - Enhanced list_lights response with separate groups/labels arrays
 * - resolve_selector helper tool for ambiguous room names
 * - Chatbot-friendly guidance for natural language to selector mapping
 *
 * Original source: James Furey (https://mcp.so/server/lifx-api-mcp-server/furey)
 * Enhancements: Added to improve AI chatbot usability and error recovery
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

			// Extract unique groups and labels for better chatbot guidance
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

			log('debug', 'Listed lights successfully', {
				count: lights.length,
				groups: availableGroups.length,
				labels: availableLabels.length,
			});

			return {
				lights,
				count: lights.length,
				available_groups: availableGroups,
				available_labels: availableLabels,
				selector_examples: selectorExamples,
				selector_help: {
					all_lights: 'all',
					by_group: 'group:GroupName (e.g., group:Bedroom)',
					by_label: 'label:LightLabel (e.g., label:Kitchen Light)',
					by_id: 'id:lightId (e.g., id:d073d58529b9)',
				},
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

			// Enhanced error message with selector guidance
			if (
				error.response?.status === 404 ||
				error.message.includes('Could not find')
			) {
				try {
					// Get available options to provide helpful suggestions
					const lightsResponse = await lifxApi.get('/lights/all');
					const lights = lightsResponse.data;
					const availableGroups = [
						...new Set(
							lights.map((light) => light.group?.name).filter(Boolean)
						),
					];
					const availableLabels = [
						...new Set(lights.map((light) => light.label).filter(Boolean)),
					];

					throw new Error(
						`Failed to set light state: Could not find light with selector "${selector}". Available groups: [${availableGroups.join(
							', '
						)}]. Available labels: [${availableLabels.join(
							', '
						)}]. Try using "group:GroupName" or "label:LightLabel" format.`
					);
				} catch (listError) {
					// Fall back to original error if we can't get the list
					throw new Error(
						`Failed to set light state: ${
							error.response?.data?.error || error.message
						}`
					);
				}
			}

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

			// Enhanced error message with selector guidance
			if (
				error.response?.status === 404 ||
				error.message.includes('Could not find')
			) {
				try {
					// Get available options to provide helpful suggestions
					const lightsResponse = await lifxApi.get('/lights/all');
					const lights = lightsResponse.data;
					const availableGroups = [
						...new Set(
							lights.map((light) => light.group?.name).filter(Boolean)
						),
					];
					const availableLabels = [
						...new Set(lights.map((light) => light.label).filter(Boolean)),
					];

					throw new Error(
						`Failed to set color: Could not find light with selector "${selector}". Available groups: [${availableGroups.join(
							', '
						)}]. Available labels: [${availableLabels.join(
							', '
						)}]. Try using "group:GroupName" or "label:LightLabel" format.`
					);
				} catch (listError) {
					// Fall back to original error if we can't get the list
					throw new Error(
						`Failed to set color: ${
							error.response?.data?.error || error.message
						}`
					);
				}
			}

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

	// Helper tool to resolve ambiguous room/light names to proper selectors
	resolve_selector: async (params) => {
		try {
			const { name } = params;

			if (!name) {
				throw new Error('Name parameter is required');
			}

			log('debug', 'Resolving selector for name', { name });

			// Get all lights to analyze available groups and labels
			const response = await lifxApi.get('/lights/all');
			const lights = response.data;

			// Extract available groups and labels
			const availableGroups = [
				...new Set(lights.map((light) => light.group?.name).filter(Boolean)),
			];
			const availableLabels = [
				...new Set(lights.map((light) => light.label).filter(Boolean)),
			];

			const nameLower = name.toLowerCase();
			const suggestions = [];

			// Check for group matches (case-insensitive)
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

			// Check for label matches (case-insensitive)
			const labelMatches = availableLabels.filter(
				(label) =>
					label.toLowerCase() === nameLower ||
					label.toLowerCase().includes(nameLower)
			);

			labelMatches.forEach((label) => {
				suggestions.push({
					type: 'label',
					selector: `label:${label}`,
					display_name: label,
					match_type: label.toLowerCase() === nameLower ? 'exact' : 'partial',
				});
			});

			// Sort suggestions by match quality (exact matches first)
			suggestions.sort((a, b) => {
				if (a.match_type === 'exact' && b.match_type !== 'exact') return -1;
				if (a.match_type !== 'exact' && b.match_type === 'exact') return 1;
				return 0;
			});

			log('debug', 'Resolved selector suggestions', {
				name,
				suggestionCount: suggestions.length,
			});

			return {
				query: name,
				suggestions,
				available_groups: availableGroups,
				available_labels: availableLabels,
				recommendation: suggestions.length > 0 ? suggestions[0].selector : null,
				help:
					suggestions.length === 0
						? `No matches found for "${name}". Available groups: [${availableGroups.join(
								', '
						  )}]. Available labels: [${availableLabels.join(', ')}].`
						: null,
			};
		} catch (error) {
			log('error', 'Failed to resolve selector', { error: error.message });
			throw new Error(
				`Failed to resolve selector: ${
					error.response?.data?.error || error.message
				}`
			);
		}
	},
};

// Enhanced tool definitions with detailed schemas and descriptions
const getToolDefinitions = () => [
	{
		name: 'list_lights',
		description:
			'Get information about available LIFX lights, groups, and labels. Returns detailed information to help with selector usage.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector (optional). Use "all" for all lights, "group:GroupName" for specific groups, "label:LightLabel" for specific lights, or "id:lightId" for light IDs.',
					default: 'all',
					examples: [
						'all',
						'group:Bedroom',
						'label:Kitchen Light',
						'id:d073d58529b9',
					],
				},
			},
		},
	},
	{
		name: 'set_light_state',
		description:
			'Control LIFX light power, color, and brightness. Use appropriate selectors based on available groups and labels from list_lights.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector. Use "all" for all lights, "group:GroupName" for groups (e.g., "group:Bedroom"), "label:LightLabel" for specific lights, or "id:lightId" for specific light IDs. Check list_lights for available options.',
					examples: [
						'all',
						'group:Bedroom',
						'label:Kitchen Light',
						'id:d073d58529b9',
					],
				},
				power: {
					type: 'string',
					enum: ['on', 'off'],
					description: 'Turn lights on or off',
				},
				color: {
					type: 'string',
					description:
						'Color name (red, blue, green, etc.), hex code (#ff0000), or special formats like "kelvin:3500"',
				},
				brightness: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description:
						'Brightness level from 0.0 (off) to 1.0 (full brightness)',
				},
				duration: {
					type: 'number',
					minimum: 0,
					description: 'Transition duration in seconds (default: 1.0)',
				},
			},
			required: ['selector'],
		},
	},
	{
		name: 'toggle_lights',
		description:
			'Toggle LIFX lights on/off. Use appropriate selectors based on available groups and labels.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector. Use "group:GroupName" for groups, "label:LightLabel" for specific lights, "all" for all lights.',
					examples: ['all', 'group:Bedroom', 'label:Kitchen Light'],
				},
				duration: {
					type: 'number',
					minimum: 0,
					description: 'Transition duration in seconds (default: 1.0)',
				},
			},
			required: ['selector'],
		},
	},
	{
		name: 'set_brightness',
		description:
			'Set brightness of LIFX lights. Use appropriate selectors based on available groups and labels.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector. Use "group:GroupName" for groups, "label:LightLabel" for specific lights.',
					examples: ['all', 'group:Bedroom', 'label:Kitchen Light'],
				},
				brightness: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description:
						'Brightness level from 0.0 (off) to 1.0 (full brightness)',
				},
				duration: {
					type: 'number',
					minimum: 0,
					description: 'Transition duration in seconds (default: 1.0)',
				},
			},
			required: ['selector', 'brightness'],
		},
	},
	{
		name: 'set_color',
		description:
			'Set color of LIFX lights. Use appropriate selectors based on available groups and labels.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector. Use "group:GroupName" for groups, "label:LightLabel" for specific lights.',
					examples: ['all', 'group:Bedroom', 'label:Kitchen Light'],
				},
				color: {
					type: 'string',
					description:
						'Color name (red, blue, green, etc.), hex code (#ff0000), or special formats like "kelvin:3500"',
				},
				duration: {
					type: 'number',
					minimum: 0,
					description: 'Transition duration in seconds (default: 1.0)',
				},
			},
			required: ['selector', 'color'],
		},
	},
	{
		name: 'breathe_effect',
		description:
			'Apply breathing effect to LIFX lights. Creates a smooth fading in and out effect.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector. Use "group:GroupName" for groups, "label:LightLabel" for specific lights.',
					examples: ['all', 'group:Bedroom', 'label:Kitchen Light'],
				},
				color: {
					type: 'string',
					description: 'Target color for the breathing effect',
				},
				from_color: {
					type: 'string',
					description:
						'Starting color (optional, uses current color if not specified)',
				},
				period: {
					type: 'number',
					minimum: 0.1,
					description: 'Duration of one breath cycle in seconds (default: 1.0)',
				},
				cycles: {
					type: 'number',
					minimum: 1,
					description: 'Number of breath cycles (omit for infinite)',
				},
				persist: {
					type: 'boolean',
					description:
						'Whether the effect should persist across power cycles (default: false)',
				},
			},
			required: ['selector', 'color'],
		},
	},
	{
		name: 'pulse_effect',
		description:
			'Apply pulse effect to LIFX lights. Creates quick flashing between colors.',
		inputSchema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description:
						'Light selector. Use "group:GroupName" for groups, "label:LightLabel" for specific lights.',
					examples: ['all', 'group:Bedroom', 'label:Kitchen Light'],
				},
				color: {
					type: 'string',
					description: 'Target color for the pulse effect',
				},
				from_color: {
					type: 'string',
					description:
						'Starting color (optional, uses current color if not specified)',
				},
				period: {
					type: 'number',
					minimum: 0.1,
					description: 'Duration of one pulse cycle in seconds (default: 1.0)',
				},
				cycles: {
					type: 'number',
					minimum: 1,
					description: 'Number of pulse cycles (omit for infinite)',
				},
				persist: {
					type: 'boolean',
					description:
						'Whether the effect should persist across power cycles (default: false)',
				},
			},
			required: ['selector', 'color'],
		},
	},
	{
		name: 'resolve_selector',
		description:
			'Helper tool to resolve ambiguous room/light names to proper LIFX selectors. Use this when users mention room names that might be groups or labels.',
		inputSchema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description:
						'The room or light name to resolve (e.g., "bedroom", "kitchen")',
				},
			},
			required: ['name'],
		},
	},
];

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
					tools: getToolDefinitions(),
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
