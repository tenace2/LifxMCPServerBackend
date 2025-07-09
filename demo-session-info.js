#!/usr/bin/env node

/**
 * LIFX MCP Server Backend - Session Info Demo Script
 *
 * This script demonstrates how to use the session info endpoint
 * and provides examples of proper client-side implementation.
 */

const axios = require('axios');

class LifxMcpClient {
	constructor(baseUrl = 'http://localhost:3001') {
		this.baseUrl = baseUrl;
		this.sessionId = this.generateSessionId();
		this.demoKey = 'LifxDemo';
		this.sessionInfo = null;
	}

	generateSessionId() {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	getHeaders() {
		return {
			'Content-Type': 'application/json',
			'x-demo-key': this.demoKey,
			'x-session-id': this.sessionId,
		};
	}

	async makeRequest(endpoint, options = {}) {
		const url = `${this.baseUrl}${endpoint}`;
		const config = {
			headers: this.getHeaders(),
			...options,
		};

		try {
			const response = await axios(url, config);

			// Update session info from response headers
			this.updateSessionInfoFromHeaders(response.headers);

			return response.data;
		} catch (error) {
			if (error.response) {
				throw new Error(
					`HTTP ${error.response.status}: ${
						error.response.data.error || 'Request failed'
					}`
				);
			}
			throw error;
		}
	}

	updateSessionInfoFromHeaders(headers) {
		const used = headers['x-requests-used'];
		const remaining = headers['x-requests-remaining'];

		if (used && remaining) {
			this.sessionInfo = {
				...this.sessionInfo,
				requestsUsed: parseInt(used),
				requestsRemaining: parseInt(remaining),
			};
		}
	}

	async getSessionInfo() {
		try {
			const response = await this.makeRequest('/api/session-info', {
				method: 'GET',
			});

			this.sessionInfo = response.session;
			return response;
		} catch (error) {
			throw error;
		}
	}

	async clearSession() {
		const response = await this.makeRequest('/api/clear-session', {
			method: 'POST',
		});

		// Generate new session ID for next requests
		this.sessionId = this.generateSessionId();
		this.sessionInfo = null;

		return response;
	}

	async checkHealth() {
		const response = await axios.get(`${this.baseUrl}/health`);
		return response.data;
	}

	async getApiInfo() {
		const response = await axios.get(`${this.baseUrl}/api/info`);
		return response.data;
	}

	getSessionStatus() {
		if (!this.sessionInfo) {
			return { status: 'unknown', message: 'Session info not loaded' };
		}

		const { requestsUsed, requestsRemaining, requestLimit } = this.sessionInfo;
		const usagePercentage = (requestsUsed / requestLimit) * 100;

		if (requestsRemaining === 0) {
			return { status: 'exhausted', message: 'Session request limit reached' };
		} else if (usagePercentage > 80) {
			return {
				status: 'warning',
				message: `${requestsRemaining} requests remaining`,
			};
		} else {
			return {
				status: 'healthy',
				message: `${requestsRemaining} requests remaining`,
			};
		}
	}
}

async function demonstrateSessionInfo() {
	console.log('🚀 LIFX MCP Server Backend - Session Info Demo\n');

	const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
	const client = new LifxMcpClient(baseUrl);

	try {
		// 1. Check server health
		console.log('1️⃣  Checking server health...');
		const health = await client.checkHealth();
		console.log(`   ✅ Server status: ${health.status}`);
		console.log(`   📊 Uptime: ${Math.round(health.uptime)}s\n`);

		// 2. Get API information
		console.log('2️⃣  Getting API information...');
		const apiInfo = await client.getApiInfo();
		console.log(`   📋 API: ${apiInfo.name} v${apiInfo.version}`);
		console.log(
			`   🔄 Rate limits: ${apiInfo.rateLimit.requestsPerSession} requests per session`
		);
		console.log(`   📡 Available endpoints: ${apiInfo.endpoints.length}\n`);

		// 3. Try to get session info (should fail - no session established yet)
		console.log('3️⃣  Attempting to get session info (new session)...');
		try {
			await client.getSessionInfo();
			console.log('   ⚠️  Unexpected success - session should not exist yet');
		} catch (error) {
			console.log(`   ✅ Expected error: ${error.message}`);
			console.log(
				'   💡 This is normal - sessions are created on first authenticated request\n'
			);
		}

		// 4. Make a dummy authenticated request to establish session
		console.log('4️⃣  Establishing session with authenticated request...');
		console.log('   🔄 Making a test request to create session...');

		// Try to make a request that will establish session but fail gracefully
		try {
			await client.makeRequest('/api/claude', {
				method: 'POST',
				data: {
					claudeApiKey: 'test-key-will-fail',
					lifxApiKey: 'test-lifx-key-will-fail-12345678901234567890123456',
					message: 'test message',
				},
			});
		} catch (error) {
			// This is expected to fail, but it should establish our session
			console.log(
				`   ✅ Request failed as expected (${
					error.message.split(':')[1]?.trim() || 'validation error'
				})`
			);
			console.log('   💡 But session should now be established\n');
		}

		// 5. Now get session info (should succeed)
		console.log('5️⃣  Getting session info after establishing session...');
		try {
			const sessionResponse = await client.getSessionInfo();
			const session = sessionResponse.session;

			console.log('   ✅ Session info retrieved successfully!');
			console.log(`   🆔 Session ID: ${session.sessionId}`);
			console.log(`   🌍 Client IP: ${session.clientIP}`);
			console.log(
				`   📈 Requests used: ${session.requestsUsed}/${session.requestLimit}`
			);
			console.log(
				`   ⏱️  Created: ${new Date(session.createdAt).toLocaleString()}`
			);
			console.log(
				`   🕐 Session age: ${Math.round(session.sessionAge / 1000)}s`
			);
			console.log(`   🔥 Active: ${session.isActive}\n`);

			// Display session status
			const status = client.getSessionStatus();
			console.log(`   📊 Session status: ${status.status.toUpperCase()}`);
			console.log(`   💬 Message: ${status.message}\n`);
		} catch (error) {
			console.log(`   ❌ Failed to get session info: ${error.message}\n`);
		}

		// 6. Make a few more requests to see usage increment
		console.log(
			'6️⃣  Making additional requests to demonstrate usage tracking...'
		);
		for (let i = 1; i <= 3; i++) {
			try {
				console.log(`   🔄 Request ${i}/3...`);
				await client.getSessionInfo();
				const status = client.getSessionStatus();
				console.log(`   📊 Status: ${status.message}`);
			} catch (error) {
				console.log(`   ❌ Request ${i} failed: ${error.message}`);
			}
		}
		console.log();

		// 7. Clear session
		console.log('7️⃣  Clearing session...');
		try {
			const clearResponse = await client.clearSession();
			console.log(`   ✅ ${clearResponse.message}`);
			console.log(`   🆔 Cleared session: ${clearResponse.sessionId}`);
			console.log(`   🆕 New session ID: ${client.sessionId}\n`);
		} catch (error) {
			console.log(`   ❌ Failed to clear session: ${error.message}\n`);
		}

		// 8. Verify session is cleared
		console.log('8️⃣  Verifying session is cleared...');
		try {
			await client.getSessionInfo();
			console.log('   ⚠️  Unexpected success - session should be cleared');
		} catch (error) {
			console.log(`   ✅ Confirmed session cleared: ${error.message}\n`);
		}

		console.log('🎉 Demo completed successfully!');
		console.log('\n📚 Next steps:');
		console.log(
			'   • Use the client implementation from docs/client-implementation-guide.md'
		);
		console.log('   • Implement proper error handling for rate limits');
		console.log('   • Monitor session usage in your UI');
		console.log('   • Clear sessions when switching API keys');
	} catch (error) {
		console.error('❌ Demo failed:', error.message);
		console.error('🔧 Make sure the server is running on', baseUrl);
		process.exit(1);
	}
}

// Run the demonstration
if (require.main === module) {
	demonstrateSessionInfo().catch(console.error);
}

module.exports = { LifxMcpClient, demonstrateSessionInfo };
