#!/usr/bin/env node

/**
 * Test script to verify multi-user session functionality
 * This script simulates multiple users creating sessions simultaneously
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const DEMO_KEY = 'LifxDemo';

// Generate unique session IDs
function generateSessionId() {
	return `test_session_${Date.now()}_${Math.random()
		.toString(36)
		.substr(2, 9)}`;
}

// Make HTTP request helper
function makeRequest(sessionId, path = '/api/info', method = 'GET') {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: 'localhost',
			port: 3001,
			path: path,
			method: method,
			headers: {
				'Content-Type': 'application/json',
				'x-demo-key': DEMO_KEY,
				'x-session-id': sessionId,
			},
		};

		const req = http.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				try {
					const jsonData = JSON.parse(data);
					resolve({
						status: res.statusCode,
						data: jsonData,
						headers: res.headers,
					});
				} catch (e) {
					resolve({ status: res.statusCode, data: data, headers: res.headers });
				}
			});
		});

		req.on('error', reject);
		req.end();
	});
}

async function testMultiUserSessions() {
	console.log('🧪 Testing Multi-User Session Support\n');

	try {
		// Test 1: Check server is running
		console.log('1. Checking server health...');
		const healthCheck = await makeRequest('health_check', '/health');
		if (healthCheck.status !== 200) {
			throw new Error(`Server not running. Status: ${healthCheck.status}`);
		}
		console.log('✅ Server is running\n');

		// Test 2: Create multiple sessions simultaneously
		console.log('2. Creating multiple sessions...');
		const sessions = [];
		for (let i = 0; i < 3; i++) {
			const sessionId = generateSessionId();
			sessions.push(sessionId);
			console.log(`   Creating session ${i + 1}: ${sessionId}`);
		}

		// Test 3: Make requests with different sessions
		console.log('\n3. Testing concurrent session access...');
		const promises = sessions.map(async (sessionId, index) => {
			const response = await makeRequest(sessionId, '/api/info');
			return { sessionId, response, index: index + 1 };
		});

		const results = await Promise.all(promises);

		// Analyze results
		console.log('\n📊 Results:');
		let successCount = 0;
		results.forEach(({ sessionId, response, index }) => {
			if (response.status === 200) {
				successCount++;
				console.log(
					`✅ Session ${index} (${sessionId.substr(0, 20)}...): SUCCESS`
				);
				if (
					response.data.rateLimit &&
					response.data.rateLimit.multiUserEnabled
				) {
					console.log(
						`   Multi-user mode: ${response.data.rateLimit.multiUserEnabled}`
					);
				}
			} else {
				console.log(
					`❌ Session ${index} (${sessionId.substr(0, 20)}...): FAILED (${
						response.status
					})`
				);
				console.log(`   Error: ${response.data.error || 'Unknown error'}`);
			}
		});

		console.log(`\n🎯 Summary:`);
		console.log(`   Total sessions tested: ${sessions.length}`);
		console.log(`   Successful sessions: ${successCount}`);
		console.log(
			`   Multi-user support: ${
				successCount === sessions.length ? 'WORKING ✅' : 'ISSUES ❌'
			}`
		);

		if (successCount === sessions.length) {
			console.log('\n🎉 Multi-user session support is working correctly!');
			console.log(
				'   Multiple users can now access the server simultaneously.'
			);
		} else {
			console.log(
				'\n⚠️  There may be issues with the multi-user implementation.'
			);
		}
	} catch (error) {
		console.error('\n❌ Test failed:', error.message);
		console.log('\n💡 Make sure the server is running with: npm run dev');
	}
}

// Run the test
if (require.main === module) {
	testMultiUserSessions();
}

module.exports = { testMultiUserSessions };
