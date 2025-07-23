#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Test MCP server directly
async function testMcpDirect() {
	console.log('Starting MCP server test...');

	const serverPath = path.join(__dirname, 'lifx-api-mcp-server.js');

	const mcpProcess = spawn('node', [serverPath], {
		env: {
			...process.env,
			LIFX_TOKEN: 'put your-lifx-api-key-here', // Replace with your actual LIFX API key
			LOG_LEVEL: 'debug',
		},
		stdio: ['pipe', 'pipe', 'pipe'],
	});

	let responseData = '';

	mcpProcess.stdout.on('data', (data) => {
		responseData += data.toString();
		console.log('MCP Output:', data.toString());
	});

	mcpProcess.stderr.on('data', (data) => {
		console.log('MCP Error:', data.toString());
	});

	mcpProcess.on('error', (error) => {
		console.error('Process error:', error);
	});

	// Wait a moment for the process to start
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Send initialize request
	const initRequest = {
		jsonrpc: '2.0',
		id: 'init',
		method: 'initialize',
		params: {
			protocolVersion: '2024-11-05',
			capabilities: { tools: {} },
			clientInfo: { name: 'test-client', version: '1.0.0' },
		},
	};

	console.log(
		'Sending initialize request:',
		JSON.stringify(initRequest, null, 2)
	);
	mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');

	// Wait for response
	await new Promise((resolve) => setTimeout(resolve, 2000));

	// Send list_lights request
	const listLightsRequest = {
		jsonrpc: '2.0',
		id: 'list_lights_test',
		method: 'tools/call',
		params: {
			name: 'list_lights',
			arguments: {},
		},
	};

	console.log(
		'Sending list_lights request:',
		JSON.stringify(listLightsRequest, null, 2)
	);
	mcpProcess.stdin.write(JSON.stringify(listLightsRequest) + '\n');

	// Wait for response
	await new Promise((resolve) => setTimeout(resolve, 5000));

	// Clean up
	mcpProcess.kill('SIGTERM');
	console.log('Test completed');
}

testMcpDirect().catch(console.error);
