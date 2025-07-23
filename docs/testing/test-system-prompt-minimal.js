#!/usr/bin/env node

/**
 * Minimal Claude System Prompt Test
 *
 * This script demonstrates the exact API call structure needed to test
 * the systemPromptEnabled parameter behavior.
 */

// Simple test without external dependencies
const http = require('http');

const TEST_DATA = {
	host: 'localhost',
	port: 3001,
	path: '/api/claude',
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'x-demo-key': 'LifxDemo',
		'x-session-id': 'test-session-minimal-' + Date.now(),
	},
};

function makeRequest(enabled, message = 'What is the capital of France?') {
	return new Promise((resolve, reject) => {
		const requestData = JSON.stringify({
			claudeApiKey: 'sk-ant-YOUR-KEY-HERE', // Replace with actual key
			lifxApiKey: 'YOUR-LIFX-KEY-HERE', // Replace with actual key
			message: message,
			systemPromptEnabled: enabled,
			maxTokens: 300,
		});

		const req = http.request(
			{
				...TEST_DATA,
				headers: {
					...TEST_DATA.headers,
					'Content-Length': Buffer.byteLength(requestData),
				},
			},
			(res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					try {
						const parsed = JSON.parse(data);
						resolve({ status: res.statusCode, data: parsed });
					} catch (error) {
						resolve({
							status: res.statusCode,
							data: data,
							error: 'Failed to parse JSON',
						});
					}
				});
			}
		);

		req.on('error', (error) => {
			reject(error);
		});

		req.write(requestData);
		req.end();
	});
}

async function testSystemPromptBehavior() {
	console.log('🔬 Minimal System Prompt Test\n');

	// Check if placeholder keys are being used
	if (TEST_DATA.claudeApiKey === 'sk-ant-YOUR-KEY-HERE') {
		console.log(
			'⚠️  Please replace the placeholder API keys in this script first!\n'
		);
		console.log('Edit lines 22-23 with your actual API keys:\n');
		console.log('  claudeApiKey: "sk-ant-your-real-key",');
		console.log('  lifxApiKey: "your-real-lifx-key",\n');
		return;
	}

	try {
		console.log('📤 Testing with systemPromptEnabled: true');
		const enabledResponse = await makeRequest(true);
		console.log('Status:', enabledResponse.status);
		console.log(
			'Response Preview:',
			JSON.stringify(enabledResponse.data, null, 2).substring(0, 300) + '...\n'
		);

		console.log('📤 Testing with systemPromptEnabled: false');
		const disabledResponse = await makeRequest(false);
		console.log('Status:', disabledResponse.status);
		console.log(
			'Response Preview:',
			JSON.stringify(disabledResponse.data, null, 2).substring(0, 300) + '...\n'
		);

		console.log('🔍 Analysis:');
		console.log(
			'- If both responses are similar and decline to answer, the parameter may not be working'
		);
		console.log(
			'- If the first declines and the second answers normally, the parameter is working correctly'
		);
		console.log(
			'- Check the server logs for more details: GET /api/logs/backend'
		);
	} catch (error) {
		console.error('❌ Request failed:', error.message);

		if (error.code === 'ECONNREFUSED') {
			console.log('\n💡 Make sure the server is running: npm start');
		}
	}
}

async function showRequestDetails() {
	console.log('📋 Request Details for Debugging:\n');

	const requestBody = {
		claudeApiKey: 'sk-ant-YOUR-KEY-HERE',
		lifxApiKey: 'YOUR-LIFX-KEY-HERE',
		message: 'What is the capital of France?',
		systemPromptEnabled: false, // This should allow general conversation
		maxTokens: 300,
	};

	console.log(
		'URL:',
		`http://${TEST_DATA.host}:${TEST_DATA.port}${TEST_DATA.path}`
	);
	console.log('Method:', TEST_DATA.method);
	console.log('Headers:', JSON.stringify(TEST_DATA.headers, null, 2));
	console.log('Body:', JSON.stringify(requestBody, null, 2));

	console.log('\n📝 Expected Behaviors:');
	console.log(
		'systemPromptEnabled: true  → Should decline and redirect to lighting topics'
	);
	console.log('systemPromptEnabled: false → Should answer "Paris" normally');

	console.log('\n🔧 curl equivalent for manual testing:');
	console.log(
		`curl -X POST http://${TEST_DATA.host}:${TEST_DATA.port}${TEST_DATA.path} \\`
	);
	console.log(`  -H "Content-Type: application/json" \\`);
	console.log(`  -H "x-demo-key: LifxDemo" \\`);
	console.log(`  -H "x-session-id: test-session-manual" \\`);
	console.log(`  -d '${JSON.stringify(requestBody)}'`);
}

async function main() {
	const command = process.argv[2];

	if (command === 'details' || command === '--details') {
		await showRequestDetails();
	} else {
		await testSystemPromptBehavior();
	}
}

if (require.main === module) {
	main().catch(console.error);
}

module.exports = { makeRequest, testSystemPromptBehavior };
