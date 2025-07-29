# Changelog

All notable changes to the LIFX MCP Server Backend project will be documented in this file.

## [1.2.1] - 2025-07-29

### 🔒 Critical Privacy Fix - Session Log Isolation Complete

#### Fixed

- **Complete Session Log Isolation**: Fixed critical issue where MCP process logs were leaking between user sessions
  - **Problem**: Both MCP stdout/stderr logs AND winston logger calls were being shared across all sessions due to missing session context
  - **Impact**: Users could see other users' LIFX command results and MCP activity in their log views
  - **Root Cause**: Dual logging system where `logger.debug()` calls lacked `sessionId` while `captureMcpLog()` calls had it
  - **Solution**: Added proper `sessionId` tagging to ALL logging calls in MCP manager system
  - **Result**: Complete session isolation - users now only see their own MCP process logs and system-level logs
  - **Security**: Prevents cross-session data exposure in multi-user Railway deployment

#### Technical Details

- **Updated ALL winston logger calls** in `services/mcpManager.js` to include `sessionId` parameter
- **Enhanced function signatures**: `callMcpMethod()`, `initializeMcpServer()`, `cleanupMcpProcess()` now accept `sessionId`
- **Updated all callers**: Both `mcp-server-manager.js` and `claudeApi.js` now pass session context
- **Fixed dual logging issue**: Both winston logger and MCP callback system now properly session-isolated
- **Comprehensive coverage**: Spawn, exit, stdout, stderr, method calls, initialization, and cleanup all properly tagged
- **Maintains backward compatibility** with existing API endpoints

#### Verification

- **Before**: `"logType": "system"` for MCP logs → visible to all sessions
- **After**: `"logType": "session"` with proper `sessionId` → isolated per user
- **Complete elimination** of cross-session log leakage

## [1.2.0] - 2025-01-23

### ✨ Enhanced MCP Server for Better AI Chatbot Usability

#### Added

- **`resolve_selector` Tool**: New helper tool to resolve ambiguous room names to proper LIFX selectors
  - Input: `{"name": "bedroom"}`
  - Output: Suggestions with proper selectors like `"group:Bedroom"`
  - Includes match confidence and available alternatives

#### Enhanced

- **`list_lights` Response**: Now includes enhanced metadata for AI guidance:

  - `selector_examples`: Maps common room names to proper selectors (e.g., `{"bedroom": "group:Bedroom"}`)
  - `available_groups`: Array of all group names
  - `available_labels`: Array of all individual light labels
  - `selector_help`: Comprehensive selector format documentation

- **Error Messages**: Smart error handling with actionable guidance:

  - **Before**: `"Could not find light with selector 'bedroom'"`
  - **After**: `"Could not find light with selector 'bedroom'. Available groups: [Bedroom, Kitchen, Office]. Available labels: [Table Lamp, Ceiling Light]. Try using 'group:GroupName' or 'label:LightLabel' format."`

- **Tool Schemas**: Comprehensive documentation in all tool schemas with:
  - Detailed selector format examples
  - Clear parameter descriptions
  - Usage guidance for AI chatbots

#### Fixed

- **Multi-Step Tool Execution**: Fixed critical conversation flow issue where Claude's tool execution was ending prematurely
  - Implemented proper conversation loop with `while (response.stop_reason === 'tool_use')`
  - Claude can now complete complex multi-step workflows (list_lights → analyze → execute commands)
  - Fixed token usage accumulation across conversation steps

### 🔧 Technical Improvements

#### Enhanced Error Handling

- `set_light_state` and `set_color` tools now provide available options when selectors fail
- Smart fallback behavior with helpful suggestions
- Better error context for debugging

#### Improved Documentation

- Updated README.md with enhanced features section
- Enhanced client implementation guide with new tool examples
- Updated testing guide with enhanced feature testing
- Comprehensive API documentation updates

### 🎯 User Experience Improvements

#### Before vs After Examples

**Scenario: User says "Change bedroom lights to blue"**

**Before Enhancement:**

1. AI tries `selector: "bedroom"` → Error: "Could not find light"
2. User confused, doesn't know available options
3. Manual troubleshooting required

**After Enhancement:**

1. AI calls `resolve_selector` with "bedroom" → Gets `"group:Bedroom"`
2. AI calls `set_color` with proper selector `"group:Bedroom"`
3. Success with helpful feedback: "Successfully set 2 bedroom lights to blue"

#### Smart Selector Resolution

- Handles case-insensitive room names
- Provides exact and partial matches
- Returns recommendations ranked by confidence
- Fallback guidance when no matches found

### 🧪 Testing

- Added comprehensive test cases for enhanced features
- New test script `test-enhanced-features.sh` for validation
- Enhanced error scenario testing
- Multi-step conversation flow validation

### 📚 Documentation Updates

- README.md: Added "Recent Enhancements" section with examples
- Client Implementation Guide: Added Enhanced LIFX API Tools section
- Testing Guide: Added "Testing Enhanced Features" section
- Complete Setup Guide: Added latest enhancements overview
- Server Copilot Instructions: Added enhanced MCP server implementation details

---

## [1.1.0] - 2024-12-15

### Added

- Multi-user session management
- Enhanced rate limiting with session-based tracking
- Comprehensive logging system
- System prompt behavior controls
- Professional testing suite

### Enhanced

- Railway deployment configuration
- CORS security implementation
- Input validation middleware
- Error handling and monitoring

---

## [1.0.0] - 2024-11-20

### Added

- Initial LIFX MCP Server Backend implementation
- Express.js HTTP API server
- Claude AI integration with MCP protocol
- Basic LIFX light control tools
- Railway deployment support
- Security middleware (rate limiting, access control)

### Core Features

- Health check endpoint
- Claude chat endpoint with LIFX integration
- Direct LIFX control endpoints
- Session management
- Basic error handling

---

## Development Notes

### Enhanced Features Implementation

The v1.2.0 enhancements focus on improving AI chatbot usability by:

1. **Reducing User Friction**: Users can use natural room names without needing to know LIFX selector syntax
2. **Self-Healing Errors**: When things go wrong, the system provides actionable guidance
3. **AI-Friendly Design**: All tools provide comprehensive information for AI decision-making
4. **Robust Conversation Flow**: Multi-step interactions work reliably

### Contributing

When adding new features, ensure:

- Enhanced error messages with available options
- Comprehensive tool schema documentation
- AI-friendly response formats with guidance
- Proper conversation flow handling
- Updated documentation and tests

### Migration Notes

- All existing API endpoints remain compatible
- New features are additive and don't break existing functionality
- Enhanced responses include additional fields but maintain backward compatibility
