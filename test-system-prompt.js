#!/usr/bin/env node

/**
 * Test script to verify systemPromptEnabled parameter behavior
 * This will test both enabled and disabled system prompt scenarios
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test configuration
const TEST_CONFIG = {
	claudeApiKey: 'sk-ant-your-key-here', // Replace with actual key
	lifxApiKey: 'your-lifx-key-here', // Replace with actual key
	sessionId: 'test-session-' + Date.now(),
};

async function testSystemPrompt() {
	console.log('🔬 Testing System Prompt Behavior\n');

	const headers = {
		'Content-Type': 'application/json',
		'x-session-id': TEST_CONFIG.sessionId,
		'x-api-key': 'development',
	};

	try {
		// Test 1: System prompt enabled (default behavior)
		console.log(
			'📝 Test 1: System prompt ENABLED (should restrict to lighting topics)'
		);
		const enabledResponse = await axios.post(
			`${BASE_URL}/api/claude`,
			{
				claudeApiKey: TEST_CONFIG.claudeApiKey,
				lifxApiKey: TEST_CONFIG.lifxApiKey,
				message: 'What is the capital of France?', // Non-lighting question
				systemPromptEnabled: true,
				maxTokens: 500,
			},
			{ headers }
		);

		console.log('✅ Response with system prompt enabled:');
		console.log(
			'   Message:',
			enabledResponse.data.response?.content?.[0]?.text?.substring(0, 200) +
				'...'
		);
		console.log('   Should decline and redirect to lighting topics\n');

		// Test 2: System prompt disabled
		console.log(
			'📝 Test 2: System prompt DISABLED (should answer general questions)'
		);
		const disabledResponse = await axios.post(
			`${BASE_URL}/api/claude`,
			{
				claudeApiKey: TEST_CONFIG.claudeApiKey,
				lifxApiKey: TEST_CONFIG.lifxApiKey,
				message: 'What is the capital of France?', // Same non-lighting question
				systemPromptEnabled: false,
				maxTokens: 500,
			},
			{ headers }
		);

		console.log('✅ Response with system prompt disabled:');
		console.log(
			'   Message:',
			disabledResponse.data.response?.content?.[0]?.text?.substring(0, 200) +
				'...'
		);
		console.log('   Should answer the general question normally\n');

		// Test 3: Lighting question with system prompt enabled
		console.log(
			'📝 Test 3: Lighting question with system prompt ENABLED (should work normally)'
		);
		const lightingResponse = await axios.post(
			`${BASE_URL}/api/claude`,
			{
				claudeApiKey: TEST_CONFIG.claudeApiKey,
				lifxApiKey: TEST_CONFIG.lifxApiKey,
				message: 'Turn on all my lights',
				systemPromptEnabled: true,
				maxTokens: 500,
			},
			{ headers }
		);

		console.log('✅ Response for lighting question:');
		console.log(
			'   Message:',
			lightingResponse.data.response?.content?.[0]?.text?.substring(0, 200) +
				'...'
		);
		console.log('   Should attempt to control lights\n');

		console.log('🎉 System prompt tests completed!');
		console.log('\n📊 Summary:');
		console.log('   Test 1 (enabled + non-lighting): Should decline');
		console.log('   Test 2 (disabled + non-lighting): Should answer');
		console.log('   Test 3 (enabled + lighting): Should control lights');

		// Show raw API requests for debugging
		console.log('\n🔍 Debug Info:');
		console.log('   Session ID:', TEST_CONFIG.sessionId);
		console.log('   Base URL:', BASE_URL);
		console.log(
			'   Claude API Key:',
			TEST_CONFIG.claudeApiKey ? '✅ Provided' : '❌ Missing'
		);
		console.log(
			'   LIFX API Key:',
			TEST_CONFIG.lifxApiKey ? '✅ Provided' : '❌ Missing'
		);
	} catch (error) {
		console.error('❌ Test failed:', error.response?.data || error.message);

		if (error.response?.status === 400) {
			console.log('\n💡 Tip: Make sure to update the API keys in this script:');
			console.log(
				'   - Replace "sk-ant-your-key-here" with your actual Claude API key'
			);
			console.log(
				'   - Replace "your-lifx-key-here" with your actual LIFX API key'
			);
		}

		if (error.code === 'ECONNREFUSED') {
			console.log('\n💡 Tip: Make sure the server is running on port 3001');
			console.log('   Run: npm start');
		}
	}
}

// Check if server is running first
async function checkServer() {
	try {
		const response = await axios.get(`${BASE_URL}/health`);
		console.log('✅ Server is running:', response.data.status);
		return true;
	} catch (error) {
		console.error(
			'❌ Server not running. Please start the server first with: npm start'
		);
		return false;
	}
}

async function main() {
	console.log('🚀 LIFX MCP Server - System Prompt Test\n');

	const serverRunning = await checkServer();
	if (!serverRunning) {
		process.exit(1);
	}

	// Check if API keys are configured
	if (
		TEST_CONFIG.claudeApiKey === 'sk-ant-your-key-here' ||
		TEST_CONFIG.lifxApiKey === 'your-lifx-key-here'
	) {
		console.log(
			'⚠️  Please update the API keys in this script before running tests\n'
		);
		console.log('Edit the TEST_CONFIG object at the top of this file:\n');
		console.log('const TEST_CONFIG = {');
		console.log('  claudeApiKey: "your-actual-claude-key",');
		console.log('  lifxApiKey: "your-actual-lifx-key",');
		console.log('  sessionId: "test-session-" + Date.now()');
		console.log('};\n');
		process.exit(1);
	}

	await testSystemPrompt();
}

if (require.main === module) {
	main().catch(console.error);
}

module.exports = { testSystemPrompt };
