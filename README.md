# LIFX MCP Server Backend

A secure backend server for the LIFX-Claude smart light control application. This server provides RESTful API endpoints for controlling LIFX smart lights through Claude AI integration using the Model Context Protocol (MCP).

Note this project was developed using Copilot AI agent Claude Sonnet 4.
Please review the server_copilot_instructions.md document to obtain an
overview of the guidelines the AI agent used when developing this project.

The LIFX MCP Server code was from project by James Furey link here:
https://mcp.so/server/lifx-api-mcp-server/furey

## CRUCIAL NOTE - only works with my front end client!

This sever is one of my first attempts to deploy to Railway, and does not
have any Railway environment variables set up on Railway to flexibly handle
other ALLOWED_ORIGINS.

My client app is available at:
https://tenace2.github.io/LifxFrontEnd/

If you create your own front end client for this server you can alter the CORS
section of this code in the `mcp-server-manager.js` code at about line 60, a snippet
is previded below. As you can see this server is very restricted.

```
// CORS configuration
const corsOptions = {
	origin: process.env.ALLOWED_ORIGINS?.split(',') || [
		'https://tenace2.github.io',
		'http://localhost:9003',
		'http://localhost:5173', // Added for local client testing
	],
```

## 🏗️ Architecture

```
GitHub Pages Client → Railway HTTP API → MCP Server → LIFX API
                   ← Railway HTTP API ← MCP Server ← LIFX API
                   ↓
                Claude API (api.anthropic.com)
```

### Key Components

- **HTTP API Server** (`mcp-server-manager.js`) - Express.js server handling client requests
- **LIFX MCP Server** (`lifx-api-mcp-server.js`) - Child process implementing MCP protocol
- **Security Middleware** - Rate limiting, session management, input validation
- **Service Modules** - Claude API integration and MCP process management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Claude API key (from Anthropic)
- LIFX API token (from LIFX Cloud)

### Installation

1. **Clone and setup:**

   ```bash
   cd LifxMCPServerBackend
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run locally:**

   ```bash
   npm run dev
   ```

4. **Test the server:**
   ```bash
   curl http://localhost:3001/health
   ```

## ⚡ Latest Updates

### Complete Session Privacy Fix (v1.2.1) - July 29, 2025

**🔒 Critical Privacy Enhancement - FULLY RESOLVED:**

- **Fixed complete session log isolation** - Users can no longer see ANY other users' MCP process activity
- **Resolved dual logging issue** - Both winston logger and MCP callback systems now properly session-isolated
- **Complete privacy protection** - ALL LIFX command results now stay within originating sessions
- **Enhanced multi-user security** - Perfect session boundaries for Railway deployment
- **Comprehensive fix** - All MCP lifecycle events (spawn, methods, cleanup) properly isolated
- **Backward compatible** - No client changes required, improved privacy automatically applied

**Technical Details:**
This fix resolves a critical issue where BOTH logging systems were sharing data across sessions:

1. **Winston logger calls** (like `logger.debug()`) were missing sessionId → created "system" logs visible to all
2. **MCP callback calls** (like `captureMcpLog()`) had sessionId → properly isolated

Both systems now include sessionId, ensuring complete session isolation and eliminating the cross-session leakage where users could see other users' "Successfully updated X lights" messages and MCP activity.

## ✨ Recent Enhancements

### Enhanced MCP Server (v1.2.0)

**Improved AI Chatbot Usability:**

- **Smart Selector Resolution**: New `resolve_selector` tool helps AI resolve ambiguous room names like "bedroom" → "group:Bedroom"
- **Enhanced Error Messages**: When selectors fail, the system now provides available groups and labels for better error recovery
- **Detailed Tool Schemas**: Comprehensive documentation in tool schemas helps AI understand proper selector usage
- **Selector Examples**: The `list_lights` tool now returns `selector_examples` mapping common room names to proper selectors

**Fixed Conversation Flow:**

- **Multi-Step Tool Execution**: Fixed Claude API integration to properly handle multi-step conversations (list_lights → analyze → execute commands)
- **Tool Execution Loop**: Implemented proper conversation loop that continues until Claude completes its intended workflow

**Example of Enhanced User Experience:**

```
User: "Turn the bedroom lights blue"
1. AI calls resolve_selector with "bedroom" → gets "group:Bedroom"
2. AI calls set_color with proper selector "group:Bedroom"
3. Lights change successfully with helpful feedback
```

**Before vs After:**

- **Before**: "Could not find light with selector 'bedroom'" (user confusion)
- **After**: "Using 'group:Bedroom' for 'bedroom'. Successfully set 2 lights to blue" (clear guidance)

## 🔐 Security Features

### Session Management

- **Multi-user support** - Multiple users can access simultaneously
- **Session request limits** - 100 requests per session
- **Automatic session cleanup** - Expires old sessions
- **Unique session tracking** - Each user gets independent session limits

### Rate Limiting

- **IP-based limits** - 30 requests per minute per IP
- **Concurrent process limits** - Max 5 MCP processes
- **Request size limits** - 1MB max payload

### Access Control

- **Demo access key** - Simple shared key protection
- **Input validation** - Sanitizes all inputs
- **CORS protection** - Restricts origins

## 📡 API Endpoints

### Health Check

```http
GET /health
```

### API Information

```http
GET /api/info
```

### Claude Chat with LIFX Control

```http
POST /api/claude
Content-Type: application/json
x-demo-key: LifxDemo
x-session-id: your-session-id

{
  "claudeApiKey": "sk-ant-...",
  "lifxApiKey": "your-lifx-token",
  "message": "Turn on the living room lights and make them blue",
  "systemPromptEnabled": true,
  "maxTokens": 1000
}
```

### Direct LIFX Control

```http
POST /api/lifx/{action}
Content-Type: application/json
x-demo-key: LifxDemo
x-session-id: your-session-id

{
  "lifxApiKey": "your-lifx-token",
  "selector": "all",
  "color": "blue",
  "brightness": 0.8
}
```

### Enhanced LIFX Tools

The MCP server now includes enhanced tools with improved AI chatbot usability:

#### Core Tools:

- **`list_lights`** - Returns lights with `selector_examples` mapping (e.g., `{"bedroom": "group:Bedroom"}`)
- **`set_light_state`** - Enhanced with smart error messages showing available groups/labels
- **`set_color`** - Improved error handling with selector suggestions
- **`resolve_selector`** - **NEW**: Resolves ambiguous names like "bedroom" to proper selectors

#### Effect Tools:

- **`breathe_effect`** - Smooth breathing effect
- **`pulse_effect`** - Quick flashing effect

#### Example Enhanced Error Handling:

```json
{
	"error": "Could not find light with selector 'livingroom'. Available groups: [Bedroom, Kitchen, Office]. Available labels: [Table Lamp, Ceiling Light]. Try using 'group:GroupName' format."
}
```

### System Prompt Modes

The `systemPromptEnabled` parameter controls Claude's conversation scope:

- **`true` (default)**: Restrictive mode - Claude only discusses lighting topics
- **`false`**: General mode - Claude answers any question + maintains LIFX awareness

Both modes always include LIFX capabilities. See [client implementation guide](docs/client-implementation-guide.md) for details.

## 🌍 Railway Deployment

**Note:** This server is designed for cloud deployment with reverse proxy support. The multi-user session management works seamlessly with Railway's load balancing infrastructure.

### Environment Variables

Set these in your Railway project:

```env
NODE_ENV=production
PORT=3001
DEMO_ACCESS_KEY=LifxDemo
LOG_LEVEL=info
ALLOWED_ORIGINS=https://tenace2.github.io
```

### Deploy to Railway

1. **Connect repository:**

   - Connect your GitHub repository to Railway
   - Railway will auto-detect Node.js and deploy

2. **Set environment variables:**

   - Go to your Railway project settings
   - Add the environment variables listed above

3. **Deploy:**
   - Railway will automatically deploy on git push
   - Your API will be available at `https://your-app.railway.app`

## 🛠️ Development

### Project Structure

```
LifxMCPServerBackend/
├── CHANGELOG.md                    # Version history and enhancements
├── README.md                       # This documentation
├── package.json                    # Dependencies and scripts
├── railway.json                    # Railway deployment config
├── .env.example                    # Environment variables template
├── mcp-server-manager.js           # Main HTTP API server
├── lifx-api-mcp-server.js          # MCP server (child process)
├── demo-session-info.js            # Demo session utilities
├── monitor-usage.sh               # Server usage monitoring script
├── docs/                          # Documentation
│   ├── COMPLETE_SETUP_GUIDE.md    # Comprehensive setup guide
│   ├── MULTI_USER_IMPLEMENTATION.md # Multi-user session guide
│   ├── SESSION_ISOLATED_LOGGING.md # Logging implementation details
│   ├── client-implementation-guide.md # Client integration guide
│   ├── server_copilot_instructions.md # AI assistant instructions
│   └── testing/                   # Testing documentation and scripts
│       ├── testing-guide.md       # Complete testing guide
│       ├── curl-commands-manual.md # Manual API testing commands
│       ├── simple-test.sh         # Basic functionality test
│       ├── quick-comparison-test.sh # System prompt comparison test
│       ├── test-claude-curl.sh    # Claude API testing with curl
│       ├── test-deployment.js     # Railway deployment testing
│       ├── test-mcp-direct.js     # Direct MCP server testing
│       ├── test-multi-user.js     # Multi-user functionality test
│       ├── test-system-prompt.js  # System prompt behavior test
│       └── test-system-prompt-minimal.js # Minimal system prompt test
├── middleware/                     # Express middleware
│   ├── auth.js                    # Access control
│   ├── rateLimit.js               # Rate limiting logic
│   └── validation.js              # Input validation
├── services/                      # Core services
│   ├── claudeApi.js               # Claude API integration
│   ├── mcpManager.js              # MCP process management
│   └── logger.js                  # Logging configuration
├── tests/                         # Test suites
│   └── integration/
│       └── server.test.js         # Integration tests
└── utils/                         # Utility modules
    ├── security.js                # Security utilities
    └── cleanup.js                 # Resource cleanup
```

### Scripts

```bash
npm start       # Start production server
npm run dev     # Start development server with nodemon
npm test        # Run tests (when implemented)
```

### Testing

The project includes multiple types of tests for different purposes:

**Quick Testing:**

- `simple-test.sh` - Basic functionality test with curl commands
- `quick-comparison-test.sh` - System prompt behavior comparison

**API Testing:**

- `test-system-prompt.js` - Comprehensive system prompt testing
- `test-mcp-direct.js` - Direct MCP server testing
- `demo-session-info.js` - Session management demonstration

**Monitoring:**

- `monitor-usage.sh` - Real-time server usage monitoring

**Unit/Integration Tests:**

- `tests/integration/server.test.js` - Formal test suite (Jest/Supertest)

For detailed testing instructions, see [Testing Guide](docs/testing-guide.md).

### Debugging

View logs:

```bash
# Local development
npm run dev

# Railway logs
railway logs
```

## 🔧 Configuration

### Environment Variables

| Variable                | Default       | Description                    |
| ----------------------- | ------------- | ------------------------------ |
| `NODE_ENV`              | `development` | Environment mode               |
| `PORT`                  | `3001`        | Server port                    |
| `DEMO_ACCESS_KEY`       | `LifxDemo`    | Access key for demo protection |
| `LOG_LEVEL`             | `info`        | Logging level                  |
| `ALLOWED_ORIGINS`       | -             | Comma-separated CORS origins   |
| `SESSION_REQUEST_LIMIT` | `100`         | Requests per session           |
| `IP_RATE_LIMIT_MAX`     | `30`          | Requests per minute per IP     |
| `MAX_CONCURRENT_MCP`    | `5`           | Max concurrent MCP processes   |

### Security Configuration

Update these for production:

- Change `DEMO_ACCESS_KEY` to a secure value
- Set specific `ALLOWED_ORIGINS` for your client
- Consider implementing proper authentication

## 🤝 Client Integration

### Frontend Setup

Your Vue.js client should:

1. **Include required headers:**

   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'x-demo-key': 'LifxDemo',
     'x-session-id': generateSessionId()
   }
   ```

2. **Handle rate limiting:**

   ```javascript
   // Check response headers
   const requestsUsed = response.headers['x-requests-used'];
   const requestsRemaining = response.headers['x-requests-remaining'];
   ```

3. **Error handling:**
   ```javascript
   try {
   	const response = await fetch('/api/claude', options);
   	if (response.status === 429) {
   		// Handle rate limiting
   	}
   } catch (error) {
   	// Handle network errors
   }
   ```

## 📝 API Examples

### List Lights

```bash
curl -X POST https://your-app.railway.app/api/lifx/list_lights \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: session123" \
  -d '{"lifxApiKey": "your-token"}'
```

### Set Light Color

```bash
curl -X POST https://your-app.railway.app/api/lifx/set_color \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: session123" \
  -d '{
    "lifxApiKey": "your-token",
    "selector": "all",
    "color": "red"
  }'
```

### Claude Chat

```bash
curl -X POST https://your-app.railway.app/api/claude \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: session123" \
  -d '{
    "claudeApiKey": "sk-ant-...",
    "lifxApiKey": "your-token",
    "message": "Make the lights green"
  }'
```

### Enhanced Selector Resolution

Use the new `resolve_selector` tool to handle ambiguous room names:

```bash
curl -X POST https://your-app.railway.app/api/lifx/resolve_selector \
  -H "Content-Type: application/json" \
  -H "x-demo-key: LifxDemo" \
  -H "x-session-id: session123" \
  -d '{
    "lifxApiKey": "your-token",
    "name": "bedroom"
  }'
```

**Response:**

```json
{
	"query": "bedroom",
	"suggestions": [
		{
			"type": "group",
			"selector": "group:Bedroom",
			"display_name": "Bedroom",
			"match_type": "exact"
		}
	],
	"recommendation": "group:Bedroom",
	"available_groups": ["Bedroom", "Kitchen", "Office"],
	"available_labels": ["Table Lamp", "Ceiling Light"]
}
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS errors:**

   - Check `ALLOWED_ORIGINS` environment variable
   - Ensure your client origin is included

2. **Rate limiting:**

   - Check response headers for usage info
   - Implement proper session management

3. **MCP spawn errors:**

   - Check LIFX API token validity
   - Monitor server logs for process issues

4. **Claude API errors:**

   - Verify Claude API key format (`sk-ant-...`)
   - Check API quota and billing

5. **Session log isolation:**

   - **Issue**: Seeing other users' activity in your session logs
   - **FULLY FIXED in v1.2.1**: Complete session isolation now implemented for ALL logging systems
   - **Behavior**: You only see your own MCP processes + system logs (no cross-session leakage)
   - **Privacy**: Other sessions' LIFX commands and MCP activity completely hidden from your view
   - **Technical**: Both winston logger and MCP callback systems now properly session-isolated

6. **Railway vs API logs difference:**

   - **Railway logs**: Show console output (system-level activity)
   - **API logs** (`/api/logs/*`): Show session-specific + system logs from memory
   - **Why different**: API serves privacy-protected, session-isolated logs
   - **Expected**: API logs are filtered per session for multi-user privacy
   - **Post-fix**: Cross-session leakage completely eliminated

### Monitoring

Monitor these metrics:

- Request rate and errors
- Memory usage
- Active MCP processes
- Session counts

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:

- Check the GitHub Issues
- Review the troubleshooting section
- Check Railway deployment logs
