#!/usr/bin/env node

/**
 * Test Script for LIFX MCP Server Backend
 *
 * This script helps you test your deployed Railway backend
 * Run with: node test-deployment.js <YOUR_RAILWAY_URL>
 */

const https = require('https');
const http = require('http');

const RAILWAY_URL = process.argv[2];

if (!RAILWAY_URL) {
	console.error('Usage: node test-deployment.js <YOUR_RAILWAY_URL>');
	console.error(
		'Example: node test-deployment.js https://your-app.railway.app'
	);
	process.exit(1);
}

const baseUrl = RAILWAY_URL.replace(/\/$/, ''); // Remove trailing slash

function makeRequest(url, options = {}) {
	const urlObj = new URL(url);
	const client = urlObj.protocol === 'https:' ? https : http;

	return new Promise((resolve, reject) => {
		const req = client.request(
			url,
			{
				method: options.method || 'GET',
				headers: options.headers || {},
				timeout: 10000,
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					try {
						const jsonData = JSON.parse(data);
						resolve({ status: res.statusCode, data: jsonData });
					} catch (e) {
						resolve({ status: res.statusCode, data: data });
					}
				});
			}
		);

		req.on('error', reject);
		req.on('timeout', () => reject(new Error('Request timeout')));

		if (options.body) {
			req.write(JSON.stringify(options.body));
		}

		req.end();
	});
}

async function testEndpoint(name, url, options = {}) {
	console.log(`\n🧪 Testing ${name}...`);
	try {
		const result = await makeRequest(url, options);

		if (result.status >= 200 && result.status < 300) {
			console.log(`✅ ${name}: PASSED (${result.status})`);
			if (options.showResponse) {
				console.log(`   Response:`, JSON.stringify(result.data, null, 2));
			}
			return true;
		} else {
			console.log(`❌ ${name}: FAILED (${result.status})`);
			console.log(`   Response:`, result.data);
			return false;
		}
	} catch (error) {
		console.log(`❌ ${name}: ERROR - ${error.message}`);
		return false;
	}
}

async function runTests() {
	console.log(`🚀 Testing Railway Deployment: ${baseUrl}`);
	console.log('='.repeat(60));

	let passedTests = 0;
	let totalTests = 0;

	// Test 1: Health Check
	totalTests++;
	if (
		await testEndpoint('Health Check', `${baseUrl}/health`, {
			showResponse: true,
		})
	) {
		passedTests++;
	}

	// Test 2: API Info
	totalTests++;
	if (
		await testEndpoint('API Info', `${baseUrl}/api/info`, {
			showResponse: false,
		})
	) {
		passedTests++;
	}

	// Test 3: Authentication (should fail without key)
	totalTests++;
	if (
		await testEndpoint('Auth Test (should fail)', `${baseUrl}/api/claude`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: { message: 'test' },
		})
	) {
		// This should actually fail, so if it passes, that's wrong
		console.log(
			`⚠️  Warning: Authentication test passed when it should have failed`
		);
	} else {
		// Expected to fail
		console.log(`✅ Authentication properly rejects unauthorized requests`);
		passedTests++;
	}

	// Test 4: Session ID requirement (should fail without session)
	totalTests++;
	const sessionTestResult = await makeRequest(`${baseUrl}/api/claude`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-demo-key': 'LifxDemo2024',
		},
		body: { message: 'test' },
	});

	if (
		sessionTestResult.status === 400 &&
		sessionTestResult.data.code === 'MISSING_SESSION_ID'
	) {
		console.log(`✅ Session ID requirement: PASSED`);
		passedTests++;
	} else {
		console.log(`❌ Session ID requirement: FAILED`);
		console.log(
			`   Expected 400 with MISSING_SESSION_ID, got:`,
			sessionTestResult
		);
	}

	// Test 5: CORS headers
	totalTests++;
	try {
		const corsResult = await makeRequest(`${baseUrl}/health`, {
			method: 'OPTIONS',
		});

		if (corsResult.status === 200 || corsResult.status === 204) {
			console.log(`✅ CORS preflight: PASSED (${corsResult.status})`);
			passedTests++;
		} else {
			console.log(`❌ CORS preflight: FAILED (${corsResult.status})`);
		}
	} catch (error) {
		console.log(`❌ CORS preflight: ERROR - ${error.message}`);
	}

	// Final Results
	console.log('\n' + '='.repeat(60));
	console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);

	if (passedTests === totalTests) {
		console.log(
			'🎉 All tests passed! Your Railway deployment is working correctly.'
		);
		console.log('\n📝 Next steps:');
		console.log('1. Update your frontend with this Railway URL');
		console.log('2. Test with real Claude and LIFX API keys');
		console.log('3. Deploy your updated frontend to GitHub Pages');
	} else {
		console.log(
			'⚠️  Some tests failed. Check Railway logs and environment variables.'
		);
		console.log('\n🔧 Troubleshooting:');
		console.log('1. Check Railway deployment logs');
		console.log('2. Verify environment variables are set correctly');
		console.log('3. Ensure the app has finished deploying');
	}

	console.log(`\n🔗 Railway URL: ${baseUrl}`);
	console.log(`🔗 Health check: ${baseUrl}/health`);
	console.log(`🔗 API info: ${baseUrl}/api/info`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
	console.error('❌ Unhandled error:', error.message);
	process.exit(1);
});

runTests().catch((error) => {
	console.error('❌ Test suite failed:', error.message);
	process.exit(1);
});
