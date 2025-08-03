#!/usr/bin/env node

/**
 * Test script to demonstrate the Claude API usage data that your backend already returns
 * This shows the exact token usage information available to your frontend client
 */

require('dotenv').config();

const https = require('https');

// Test configuration - update these values as needed
const TEST_CONFIG = {
	// Your backend server URL
	serverUrl: process.env.SERVER_URL || 'http://localhost:3001',

	// Required headers for your API
	headers: {
		'Content-Type': 'application/json',
		'x-demo-key': process.env.DEMO_KEY || 'demo-key-123', // Replace with your demo key
		'x-session-id': 'test-session-' + Date.now(), // Unique session ID
	},

	// Test message for Claude
	testMessage: 'Turn my lights blue',

	// API keys (these would normally come from your frontend)
	claudeApiKey: process.env.CLAUDE_API_KEY || 'your-claude-api-key-here',
	lifxApiKey: process.env.LIFX_API_KEY || 'your-lifx-api-key-here',
};

async function testClaudeUsageResponse() {
	console.log('🧪 Testing Claude API Usage Data Response');
	console.log('=' + '='.repeat(50));

	const requestBody = {
		claudeApiKey: TEST_CONFIG.claudeApiKey,
		lifxApiKey: TEST_CONFIG.lifxApiKey,
		message: TEST_CONFIG.testMessage,
		systemPromptEnabled: true,
		maxTokens: 1000,
	};

	console.log('📤 Sending request to:', `${TEST_CONFIG.serverUrl}/api/claude`);
	console.log('📝 Test message:', TEST_CONFIG.testMessage);
	console.log('');

	try {
		const response = await makeRequest(
			`${TEST_CONFIG.serverUrl}/api/claude`,
			'POST',
			TEST_CONFIG.headers,
			requestBody
		);

		console.log('✅ Response received successfully!');
		console.log('');

		// Extract and display the usage information
		if (response.usage) {
			console.log('🎯 CLAUDE API TOKEN USAGE DATA:');
			console.log('--------------------------------');
			console.log(`📥 Input Tokens:  ${response.usage.input_tokens}`);
			console.log(`📤 Output Tokens: ${response.usage.output_tokens}`);
			console.log(
				`📊 Total Tokens:  ${
					response.usage.input_tokens + response.usage.output_tokens
				}`
			);
			console.log('');

			console.log('💡 THIS IS THE EXACT DATA FROM CLAUDE API!');
			console.log('   Your frontend can use response.usage.input_tokens');
			console.log('   and response.usage.output_tokens for accurate billing');
			console.log('');
		} else {
			console.log('❌ No usage data found in response');
		}

		// Show the full response structure
		console.log('📋 FULL RESPONSE STRUCTURE:');
		console.log('---------------------------');
		console.log('Available properties:');
		Object.keys(response).forEach((key) => {
			if (key === 'usage') {
				console.log(
					`  • ${key}: { input_tokens: ${response[key].input_tokens}, output_tokens: ${response[key].output_tokens} }`
				);
			} else if (key === 'response' && response[key]?.content) {
				console.log(`  • ${key}: [Claude response object with content]`);
			} else {
				console.log(`  • ${key}: ${typeof response[key]}`);
			}
		});

		if (response.response && response.response.content) {
			const textContent = response.response.content.find(
				(c) => c.type === 'text'
			);
			if (textContent) {
				console.log('');
				console.log('💬 Claude Response:');
				console.log('------------------');
				console.log(textContent.text);
			}
		}
	} catch (error) {
		console.error('❌ Error testing Claude usage response:', error.message);

		if (error.message.includes('ECONNREFUSED')) {
			console.log('');
			console.log('💡 Make sure your backend server is running:');
			console.log('   npm start (or node mcp-server-manager.js)');
		}

		if (error.message.includes('401') || error.message.includes('403')) {
			console.log('');
			console.log('💡 Check your API keys and demo key configuration');
		}
	}
}

// Helper function to make HTTP requests
function makeRequest(url, method, headers, body) {
	return new Promise((resolve, reject) => {
		const isHttps = url.startsWith('https://');
		const httpModule = isHttps ? require('https') : require('http');

		const parsedUrl = new URL(url);
		const options = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port || (isHttps ? 443 : 80),
			path: parsedUrl.pathname,
			method: method,
			headers: headers,
		};

		const req = httpModule.request(options, (res) => {
			let responseData = '';

			res.on('data', (chunk) => {
				responseData += chunk;
			});

			res.on('end', () => {
				try {
					const jsonResponse = JSON.parse(responseData);
					if (res.statusCode >= 200 && res.statusCode < 300) {
						resolve(jsonResponse);
					} else {
						reject(
							new Error(
								`HTTP ${res.statusCode}: ${jsonResponse.error || responseData}`
							)
						);
					}
				} catch (parseError) {
					reject(new Error(`Invalid JSON response: ${responseData}`));
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		if (body) {
			req.write(JSON.stringify(body));
		}

		req.end();
	});
}

// Run the test
if (require.main === module) {
	testClaudeUsageResponse().catch(console.error);
}

module.exports = { testClaudeUsageResponse };
