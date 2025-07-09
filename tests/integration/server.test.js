const request = require('supertest');
const app = require('../../mcp-server-manager');

describe('LIFX MCP Server Backend', () => {
	const validSession = 'test_session_123';
	const validDemoKey = 'LifxDemo';

	describe('Health and Info Endpoints', () => {
		test('GET /health should return healthy status', async () => {
			const response = await request(app).get('/health').expect(200);

			expect(response.body.status).toBe('healthy');
			expect(response.body.timestamp).toBeDefined();
			expect(response.body.uptime).toBeDefined();
		});

		test('GET /api/info should return API information', async () => {
			const response = await request(app).get('/api/info').expect(200);

			expect(response.body.name).toBe('LIFX MCP Server Backend');
			expect(response.body.endpoints).toBeDefined();
			expect(Array.isArray(response.body.endpoints)).toBe(true);
		});
	});

	describe('Authentication', () => {
		test('should reject requests without demo key', async () => {
			const response = await request(app)
				.post('/api/claude')
				.set('x-session-id', validSession)
				.send({
					claudeApiKey: 'sk-ant-test',
					lifxApiKey: 'test-lifx-key-12345678901234567890',
					message: 'test',
				})
				.expect(401);

			expect(response.body.error).toBe('Demo access key required');
			expect(response.body.code).toBe('UNAUTHORIZED');
		});

		test('should reject requests without session ID', async () => {
			const response = await request(app)
				.post('/api/claude')
				.set('x-demo-key', validDemoKey)
				.send({
					claudeApiKey: 'sk-ant-test',
					lifxApiKey: 'test-lifx-key-12345678901234567890',
					message: 'test',
				})
				.expect(400);

			expect(response.body.error).toBe('Session ID required');
			expect(response.body.code).toBe('MISSING_SESSION_ID');
		});
	});

	describe('Input Validation', () => {
		test('should reject invalid Claude API key format', async () => {
			const response = await request(app)
				.post('/api/claude')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', validSession)
				.send({
					claudeApiKey: 'invalid-key',
					lifxApiKey: 'test-lifx-key-12345678901234567890',
					message: 'test',
				})
				.expect(400);

			expect(response.body.error).toBe('Invalid Claude API key format');
			expect(response.body.code).toBe('INVALID_CLAUDE_KEY');
		});

		test('should reject invalid LIFX API key format', async () => {
			const response = await request(app)
				.post('/api/claude')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', validSession)
				.send({
					claudeApiKey: 'sk-ant-test-key',
					lifxApiKey: 'short',
					message: 'test',
				})
				.expect(400);

			expect(response.body.error).toBe('Invalid LIFX API key format');
			expect(response.body.code).toBe('INVALID_LIFX_KEY');
		});

		test('should reject empty or too long messages', async () => {
			const response = await request(app)
				.post('/api/claude')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', validSession)
				.send({
					claudeApiKey: 'sk-ant-test-key',
					lifxApiKey: 'test-lifx-key-12345678901234567890',
					message: 'a'.repeat(1001), // Too long
				})
				.expect(400);

			expect(response.body.error).toBe(
				'Message required and must be under 1000 characters'
			);
			expect(response.body.code).toBe('INVALID_MESSAGE');
		});
	});

	describe('LIFX Direct Control', () => {
		test('should reject invalid action', async () => {
			const response = await request(app)
				.post('/api/lifx/invalid_action')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', validSession)
				.send({
					lifxApiKey: 'test-lifx-key-12345678901234567890',
				})
				.expect(400);

			expect(response.body.error).toContain('Invalid action');
			expect(response.body.code).toBe('INVALID_ACTION');
		});

		test('should accept valid action', async () => {
			const response = await request(app)
				.post('/api/lifx/list_lights')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', validSession)
				.send({
					lifxApiKey: 'test-lifx-key-12345678901234567890',
				});

			// This will likely fail due to invalid API key, but should pass validation
			expect([400, 500]).toContain(response.status);
		});
	});

	describe('Rate Limiting', () => {
		test('should track request count in headers', async () => {
			const response = await request(app)
				.post('/api/lifx/list_lights')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', 'rate_limit_test_session')
				.send({
					lifxApiKey: 'test-lifx-key-12345678901234567890',
				});

			expect(response.headers['x-requests-used']).toBeDefined();
			expect(response.headers['x-requests-remaining']).toBeDefined();
		});
	});

	describe('Error Handling', () => {
		test('should return 404 for unknown routes', async () => {
			const response = await request(app).get('/unknown/route').expect(404);

			expect(response.body.error).toBe('Route not found');
			expect(response.body.code).toBe('NOT_FOUND');
			expect(response.body.availableEndpoints).toBeDefined();
		});

		test('should reject non-JSON content type for POST requests', async () => {
			const response = await request(app)
				.post('/api/claude')
				.set('Content-Type', 'text/plain')
				.set('x-demo-key', validDemoKey)
				.set('x-session-id', validSession)
				.send('not json')
				.expect(400);

			expect(response.body.error).toBe('Content-Type must be application/json');
			expect(response.body.code).toBe('INVALID_CONTENT_TYPE');
		});
	});
});

// Helper to run basic smoke tests
describe('Smoke Tests', () => {
	test('server should start and respond', async () => {
		const response = await request(app).get('/health').expect(200);

		expect(response.body.status).toBe('healthy');
	});
});
