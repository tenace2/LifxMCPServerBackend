# CORS Configuration Guide

## Overview

This guide explains how to properly configure CORS (Cross-Origin Resource Sharing) for the LIFX MCP Server Backend to enable session tracking headers for frontend applications.

## The Problem

When frontend applications make requests to the backend from a different origin (different domain, port, or protocol), browsers enforce CORS security policies. By default, browsers block access to custom headers for security reasons.

Without proper CORS configuration, your frontend will see `null` values for session tracking headers:

```javascript
// ❌ Without proper CORS - headers will be null
const requestsUsed = response.headers.get('x-requests-used'); // null
const requestsRemaining = response.headers.get('x-requests-remaining'); // null
```

## The Solution

The backend must explicitly expose custom headers in the CORS configuration using the `exposedHeaders` property.

### Complete CORS Configuration

```javascript
// In mcp-server-manager.js
const corsOptions = {
	origin: process.env.ALLOWED_ORIGINS?.split(',') || [
		'https://tenace2.github.io',
		'http://localhost:9003',
		'http://localhost:5173', // Added for local client testing
	],
	credentials: true,
	optionsSuccessStatus: 200,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: [
		'Content-Type',
		'Authorization',
		'x-demo-key',
		'x-session-id',
	],
	// ✅ This is the crucial part for session tracking
	exposedHeaders: ['x-requests-used', 'x-requests-remaining', 'x-daily-limit'],
};

app.use(cors(corsOptions));
```

## What Each Property Does

### `exposedHeaders` (Critical for Session Tracking)

- **Purpose**: Tells browsers which custom headers JavaScript can read
- **Required for**: Session tracking functionality
- **Without it**: Frontend gets `null` for all session headers

### `allowedHeaders`

- **Purpose**: Specifies which headers the frontend can send
- **Includes**: Authentication and content-type headers

### `origin`

- **Purpose**: Controls which domains can make requests
- **Security**: Prevents unauthorized domains from accessing your API

### `credentials`

- **Purpose**: Allows cookies and authentication headers
- **Required for**: Session-based authentication

## Frontend Header Reading

With proper CORS configuration, frontend can read session headers:

```javascript
// ✅ With proper CORS - headers will be available
const response = await fetch('/api/lifx/set_color', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'x-demo-key': 'LifxDemo',
		'x-session-id': sessionId,
	},
	body: JSON.stringify(data),
});

// Now these work correctly
const requestsUsed = response.headers.get('x-requests-used');
const requestsRemaining = response.headers.get('x-requests-remaining');
const dailyLimit = response.headers.get('x-daily-limit');

console.log(`Session usage: ${requestsUsed}/${dailyLimit}`);
```

## Testing CORS Configuration

### 1. Check with curl (Always Works)

```bash
curl -i -X POST "http://localhost:3001/api/lifx/set_color" \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: test-session-123" \
  -d '{"lifxApiKey":"your-key", "selector":"all", "color":"blue"}'
```

### 2. Check in Browser Console

```javascript
// This should show the headers if CORS is configured correctly
fetch('/api/session-info', {
	headers: {
		'x-demo-key': 'LifxDemo',
		'x-session-id': 'test-session-123',
	},
}).then((response) => {
	console.log('Session headers:');
	console.log('Used:', response.headers.get('x-requests-used'));
	console.log('Remaining:', response.headers.get('x-requests-remaining'));
	console.log('Limit:', response.headers.get('x-daily-limit'));
});
```

## Common Issues

### Issue 1: Headers Return `null`

**Cause**: Missing `exposedHeaders` in CORS configuration  
**Solution**: Add the `exposedHeaders` array as shown above

### Issue 2: CORS Preflight Failures

**Cause**: Missing `methods` or `allowedHeaders` in CORS configuration  
**Solution**: Ensure all required methods and headers are listed

### Issue 3: Origin Not Allowed

**Cause**: Frontend domain not in `origin` array  
**Solution**: Add your frontend domain to the `origin` array

## Environment Variables

For production deployments, use environment variables:

```bash
# .env file
ALLOWED_ORIGINS=https://your-frontend.com,http://localhost:3000,http://localhost:5173
```

## Security Considerations

1. **Restrict Origins**: Only include domains you control in `origin`
2. **Limit Headers**: Only expose headers that are necessary
3. **Review Regularly**: Audit CORS configuration periodically
4. **Use HTTPS**: Always use HTTPS in production

## Deployment Notes

### Railway Deployment

- Set `ALLOWED_ORIGINS` environment variable
- Include your Railway app domain in origins
- Test CORS configuration after deployment

### Local Development

- Include `http://localhost:3000`, `http://localhost:5173`, etc.
- Test with actual frontend before deploying
- Use browser dev tools to inspect headers

## Summary

The key to successful session tracking is the `exposedHeaders` property in your CORS configuration. Without it, browsers will block access to your custom session headers, making frontend session tracking impossible.

Always test CORS configuration with your actual frontend application, not just curl commands, as browsers enforce additional security restrictions that curl doesn't.
