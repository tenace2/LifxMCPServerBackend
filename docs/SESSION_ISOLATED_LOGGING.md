# Session-Isolated Logging Implementation

## Overview

This implementation provides session-isolated logging with system log inclusion to ensure privacy between sessions while maintaining essential system visibility.

## Key Features

### 1. Session-Scoped Log Storage

- **System Logs**: Visible to all sessions (server startup, configuration, critical errors)
- **Session Logs**: Isolated per session (user requests, session-specific errors, MCP processes)

### 2. Storage Structure

```javascript
logStorage = {
  system: {
    backend: [], // System-wide backend logs
    mcp: []      // System-wide MCP logs
  },
  sessions: Map {
    "session-1": { backend: [], mcp: [] },
    "session-2": { backend: [], mcp: [] },
    // ...
  }
}
```

### 3. Log Classification

Logs are automatically classified as system or session based on:

- **System Logs**: Server startup, configuration, critical errors, no sessionId
- **Session Logs**: User requests, session-specific errors, MCP processes with sessionId

### 4. Memory Management

- **maxLogEntries**: 500 per storage area (reduced from 1000)
- **maxSessions**: 50 sessions maximum to prevent memory bloat
- **Automatic Cleanup**: Integrated with existing session cleanup

## API Changes

### Log Endpoints (Backward Compatible)

- `GET /api/logs/backend` - Returns system + session logs for requesting session
- `GET /api/logs/mcp` - Returns system + session MCP logs for requesting session
- `GET /api/logs` - Updated with session information

### Response Format

```json
{
  "success": true,
  "logs": [...],
  "count": 25,
  "metadata": {
    "sessionId": "session-123",
    "systemLogs": 10,
    "sessionLogs": 15,
    "totalCombined": 25
  },
  "filters": {...},
  "note": "Showing system logs + your session logs (privacy protected)"
}
```

## Privacy Protection

### What Each Session Can See:

✅ **Own session logs**: Requests, responses, errors  
✅ **System logs**: Server startup, configuration, health  
✅ **Own MCP processes**: Process spawn, tool calls, results

### What Each Session Cannot See:

❌ **Other sessions' requests/responses**  
❌ **Other sessions' errors**  
❌ **Other sessions' MCP processes**  
❌ **Other users' sensitive data**

## Implementation Details

### 1. Session-Aware Logging

```javascript
// Create session-aware logger
const sessionLogger = createSessionLogger(sessionId);
sessionLogger.info('Message', { key: 'value' });
```

### 2. Log Classification Logic

```javascript
const isSystemLog = (message, meta) => {
	// System keywords: 'server started', 'configuration', etc.
	// No sessionId + critical errors
	// Server-level operations
};
```

### 3. Automatic Cleanup

- Integrated with existing session cleanup in `rateLimit.js`
- Removes session logs when sessions expire
- Prevents memory leaks

### 4. MCP Process Integration

- Session context passed to MCP processes via environment variables
- MCP logs tagged with originating session
- Process spawn/termination logged per session

## Migration Impact

### Client-Side Changes: MINIMAL

- Same API endpoints
- Same response structure
- Enhanced metadata with session info
- Better privacy messaging

### Benefits for Clients:

- **Reduced noise**: Only relevant logs displayed
- **Improved performance**: Smaller log payloads
- **Better privacy**: No exposure to other sessions
- **Enhanced debugging**: Focused on user's specific actions

### New Features:

- Session ID displayed in log metadata
- System vs session log categorization
- Combined log counts for transparency

## Configuration

### Environment Variables:

- `SESSION_MAX_AGE`: Session cleanup interval (default: 24 hours)
- `SESSION_CLEANUP_INTERVAL`: Cleanup frequency (default: 1 hour)
- `LOG_LEVEL`: Logging level for system logs

### Memory Limits:

- 500 logs per storage area (system/session)
- 50 maximum concurrent sessions
- Automatic oldest-session removal

## Security Benefits

1. **Complete Session Isolation**: No cross-session log visibility
2. **Privacy Protection**: User data confined to session scope
3. **System Transparency**: Essential server info still available
4. **Memory Safety**: Prevents unbounded growth
5. **Audit Trail**: Session-specific logging for debugging

## Monitoring

The system provides enhanced monitoring:

- Active session count
- System vs session log distribution
- Memory usage per session
- Cleanup statistics

This implementation maintains full backward compatibility while providing enterprise-grade privacy protection for multi-user environments.
