const Anthropic = require('@anthropic-ai/sdk');
const logger = require('./logger');

// LIFX system prompt for Claude (restrictive mode)
const LIFX_SYSTEM_PROMPT = `You are a comprehensive LIFX smart lighting assistant with access to the full LIFX API. You can control lights, create effects, manage scenes, and perform advanced lighting operations.

IMPORTANT CONSTRAINTS:
- You can ONLY control lights, adjust colors, brightness, and power states
- You CANNOT provide information unrelated to lighting
- You CANNOT answer questions about other topics
- Always use the available MCP tools for light control

AVAILABLE CAPABILITIES:

**Basic Light Control:**
- set-state: Turn lights on/off, change colors, adjust brightness
- list-lights: Get information about available lights
- toggle-power: Toggle lights on/off
- state-delta: Make relative adjustments to light properties

**Visual Effects:**
- breathe-effect: Slow breathing/fading effect between colors
- pulse-effect: Quick pulsing/flashing effect between colors
- move-effect: Moving color patterns (for LIFX Z strips)
- morph-effect: Color morphing patterns (for LIFX Tiles)
- flame-effect: Flickering flame effect (for LIFX Tiles)
- clouds-effect: Soft cloud-like color transitions (for LIFX Tiles)
- sunrise-effect: Gradual sunrise simulation (for LIFX Tiles)
- sunset-effect: Gradual sunset simulation (for LIFX Tiles)
- effects-off: Stop any running effects

**Scene Management:**
- list-scenes: Show available scenes in user's account
- activate-scene: Activate a saved scene by UUID

**Advanced Features:**
- cycle: Cycle lights through multiple color states
- validate-color: Check if a color string is valid
- clean: Control LIFX Clean devices

**How to Use Tools:**
Always specify the 'tool' parameter first, then provide the appropriate parameters for that tool.

Examples:
- "Turn lights red" → tool: "set-state", color: "red", selector: "all"
- "Create breathing effect with blue and green" → tool: "breathe-effect", color: "blue", from_color: "green", cycles: 10
- "Create infinite breathing effect" → tool: "breathe-effect", color: "red", from_color: "blue" (omit cycles parameter for infinite)
- "Start a sunrise effect" → tool: "sunrise-effect", duration: 300 (5 minutes)
- "List all my lights" → tool: "list-lights", selector: "all"
- "Activate bedroom scene" → tool: "activate-scene", scene_uuid: "[uuid from list-scenes]"

**Important Guidelines:**
- ALWAYS focus on the CURRENT user request - ignore previous conversation context if it conflicts
- ALWAYS use the control_lifx_lights tool when users want to control lights
- ALWAYS provide a friendly confirmation message after using the tool
- For MULTI-STEP requests: Use multiple tool calls in a single response to accomplish all requested actions
- For effects, suggest appropriate durations and parameters
- For infinite effects (breathe, pulse, etc.), OMIT the 'cycles' parameter entirely - do not set it to "infinite"
- If asked about anything non-lighting related, respond: "Sorry, I can only help with controlling your LIFX lights."
- Be creative with effects - you have access to the full LIFX API!
- PAY ATTENTION: If user says "blue", use blue - not any other color from previous requests

**Multi-Step Example:**
- "Turn lights blue then breathe red to green" → Use TWO tool calls: 
  1. tool: "set-state", color: "blue", selector: "all"
  2. tool: "breathe-effect", color: "green", from_color: "red", cycles: 5

**Light Selectors:**
- "all" - All lights in account
- "label:Kitchen" - Lights labeled "Kitchen" 
- "group:Living Room" - Lights in "Living Room" group
- "id:d073d5..." - Specific light by ID

**Color Formats:**
- Named colors: "red", "blue", "green", "purple", "pink", "orange", "yellow", "white"
- Hex codes: "#ff0000", "#00ff00"
- HSB: "hue:120 saturation:1.0 brightness:0.5"
- Kelvin: "kelvin:3500" (warm white to cool white: 2500-9000K)

You have full access to create amazing lighting experiences!`;

// General system prompt when restrictions are disabled
const GENERAL_SYSTEM_PROMPT = `You are a helpful AI assistant with access to LIFX smart light controls. You can answer questions on any topic and also help control LIFX smart lights when requested.

Available light control capabilities:
- Turn lights on/off
- Change colors (use color names, hex codes, or RGB values)
- Adjust brightness (0-100%)
- Control specific lights by name or group
- Apply lighting effects

Feel free to answer general questions about any topic. When users ask about lighting, use the available tools to control their LIFX lights.`;

// Convert MCP tools to Claude format
const getMcpTools = () => [
	{
		name: 'list_lights',
		description: 'Get list of available LIFX lights',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, group:name, etc.)',
					default: 'all',
				},
			},
		},
	},
	{
		name: 'set_light_state',
		description: 'Control LIFX light power, color, and brightness',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, group:name, etc.)',
				},
				power: {
					type: 'string',
					enum: ['on', 'off'],
					description: 'Turn lights on or off',
				},
				color: {
					type: 'string',
					description:
						'Color name (red, blue), hex code (#FF0000), or rgb:r,g,b format',
				},
				brightness: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: 'Brightness level from 0.0 to 1.0',
				},
				duration: {
					type: 'number',
					description: 'Transition duration in seconds',
					default: 1.0,
				},
			},
			required: ['selector'],
		},
	},
	{
		name: 'toggle_lights',
		description: 'Toggle LIFX lights on/off',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, group:name, etc.)',
				},
				duration: {
					type: 'number',
					description: 'Transition duration in seconds',
					default: 1.0,
				},
			},
			required: ['selector'],
		},
	},
	{
		name: 'set_brightness',
		description: 'Set brightness of LIFX lights',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, group:name, etc.)',
				},
				brightness: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: 'Brightness level from 0.0 to 1.0',
				},
				duration: {
					type: 'number',
					description: 'Transition duration in seconds',
					default: 1.0,
				},
			},
			required: ['selector', 'brightness'],
		},
	},
	{
		name: 'set_color',
		description: 'Set color of LIFX lights',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, group:name, etc.)',
				},
				color: {
					type: 'string',
					description:
						'Color name (red, blue), hex code (#FF0000), or rgb:r,g,b format',
				},
				duration: {
					type: 'number',
					description: 'Transition duration in seconds',
					default: 1.0,
				},
			},
			required: ['selector', 'color'],
		},
	},
	{
		name: 'breathe_effect',
		description: 'Apply breathing effect to LIFX lights',
		input_schema: {
			type: 'object',
			properties: {
				selector: {
					type: 'string',
					description: 'Light selector (all, label:name, group:name, etc.)',
				},
				color: {
					type: 'string',
					description: 'Color for the effect',
				},
				from_color: {
					type: 'string',
					description: 'Starting color for the effect',
				},
				period: {
					type: 'number',
					description: 'Period of one cycle in seconds',
					default: 1.0,
				},
				cycles: {
					type: 'number',
					description: 'Number of cycles',
					default: 1,
				},
				persist: {
					type: 'boolean',
					description: 'Whether the light should return to its previous state',
					default: false,
				},
			},
			required: ['selector', 'color'],
		},
	},
];

// Build Claude request
const buildClaudeRequest = (
	message,
	systemPromptEnabled = true,
	maxTokens = 1000
) => {
	const messages = [];

	messages.push({
		role: 'user',
		content: message,
	});

	const request = {
		model: 'claude-3-5-sonnet-20241022',
		max_tokens: maxTokens,
		messages,
		tools: getMcpTools(),
	};

	// Add system prompt as top-level parameter if enabled
	if (systemPromptEnabled) {
		request.system = LIFX_SYSTEM_PROMPT;
	} else {
		// Use general system prompt when restrictions are disabled
		request.system = GENERAL_SYSTEM_PROMPT;
	}

	return request;
};

// Call Claude API with MCP integration
const callClaudeWithMcp = async (
	claudeApiKey,
	message,
	mcpProcess,
	options = {}
) => {
	const { systemPromptEnabled = true, maxTokens = 1000 } = options;

	try {
		const anthropic = new Anthropic({
			apiKey: claudeApiKey,
		});

		const request = buildClaudeRequest(message, systemPromptEnabled, maxTokens);

		// Log the user's message
		logger.info('User message received', {
			message: message,
			messageLength: message.length,
		});

		logger.debug('Calling Claude API', {
			model: request.model,
			maxTokens: request.max_tokens,
			toolCount: request.tools.length,
			messageLength: message.length,
		});

		const response = await anthropic.messages.create(request);

		// Log Claude's text response
		const textContent = response.content.find((c) => c.type === 'text');
		if (textContent) {
			logger.info('Claude response text', {
				response: textContent.text,
			});
		}

		// Process tool calls if any
		if (response.content) {
			for (const content of response.content) {
				if (content.type === 'tool_use') {
					try {
						// Log the tool call details BEFORE execution
						logger.info('Tool call details', {
							toolName: content.name,
							toolId: content.id,
							parameters: content.input,
						});

						logger.debug('Executing tool call', {
							toolName: content.name,
							toolId: content.id,
						});

						// Import MCP manager here to avoid circular dependency
						const { callMcpMethod } = require('./mcpManager');
						const toolResult = await callMcpMethod(
							mcpProcess,
							content.name,
							content.input
						);

						// Add tool result to response
						content.result = toolResult;

						// Log the successful result
						logger.info('Tool call result', {
							toolName: content.name,
							toolId: content.id,
							result: toolResult,
						});

						logger.debug('Tool call completed', {
							toolName: content.name,
							toolId: content.id,
							success: true,
						});
					} catch (toolError) {
						logger.error('Tool call failed', {
							toolName: content.name,
							toolId: content.id,
							parameters: content.input,
							error: toolError.message,
						});

						content.error = toolError.message;
					}
				}
			}
		}

		logger.info('Claude API call successful', {
			inputTokens: response.usage?.input_tokens,
			outputTokens: response.usage?.output_tokens,
			stopReason: response.stop_reason,
		});

		return {
			success: true,
			response: response,
			usage: response.usage,
		};
	} catch (error) {
		logger.error('Claude API call failed', {
			userMessage: message,
			error: error.message,
			type: error.constructor.name,
		});

		// Handle specific Anthropic errors
		if (error.status) {
			throw new Error(`Claude API error (${error.status}): ${error.message}`);
		}

		throw error;
	}
};

// Test Claude API connection
const testClaudeConnection = async (claudeApiKey) => {
	try {
		const anthropic = new Anthropic({
			apiKey: claudeApiKey,
		});

		// Simple test request
		const response = await anthropic.messages.create({
			model: 'claude-3-5-sonnet-20241022',
			max_tokens: 10,
			messages: [
				{
					role: 'user',
					content: 'Hello',
				},
			],
		});

		return {
			success: true,
			usage: response.usage,
		};
	} catch (error) {
		logger.error('Claude connection test failed', {
			error: error.message,
		});

		return {
			success: false,
			error: error.message,
		};
	}
};

module.exports = {
	callClaudeWithMcp,
	buildClaudeRequest,
	getMcpTools,
	testClaudeConnection,
	LIFX_SYSTEM_PROMPT,
	GENERAL_SYSTEM_PROMPT,
};
