# WinCC V8 MCP Server

A Model Context Protocol (MCP) server that provides access to Siemens WinCC V8 SCADA systems through their REST API. Created by Andreas Vogler in 2025.

## Features

### 🔐 **Authentication**
- User login with username/password credentials
- Support for Basic Authentication and Bearer Token authentication
- Automatic credential management for subsequent requests
- HTTPS support with optional certificate validation bypass

### �️ **Tag Management**
- **Connections**: Read configuration data of connections and specific connection details
- **Tag Groups**: List all tag groups and get specific group configurations
- **Structure Types**: Access structure type definitions and their instances
- **Tag Values**: Read single or multiple tag runtime values
- **Tag Writing**: Write values to individual tags or batch write to multiple tags
- **Tag Configuration**: Access tag configuration data and list all tags with pagination

### 📊 **Archive System**
- **Archives**: List all process value archives and get specific archive details
- **Archive Variables**: Access archive variable configurations and data
- **Archive Values**: Read current and historical archive values with filtering
- **Timers**: Manage archive system timers and their configurations
- **Archive Tags**: Access archive system tag configurations

### 🚨 **Alarm Logging**
- **Message Classes/Types/Groups/Blocks**: Discover message classes, types, groups, and blocks
- **Messages**: List all messages and read specific message details
- **Limit Values**: Read configured limit values and per-tag limits
- **Runtime Lists**: Query message lists, short/long-term archives, hit/lock/hide/hidden lists via REST filters

### 🌐 **HTTP Transport**
- Express.js server with HTTP endpoints
- Streamable HTTP server transport for MCP communication
- JSON-based request/response handling
- Error handling and proper HTTP status codes

## Available Tools

### Authentication
- `login-user` - Log in to WinCC with username and password

### Tag Management
- `wincc-get-connections` - Read all connection configurations
- `wincc-get-connection` - Read specific connection configuration
- `wincc-get-groups` - Read all tag group configurations
- `wincc-get-group` - Read specific tag group configuration
- `wincc-get-structure-types` - Read all structure type configurations
- `wincc-get-structure-type` - Read specific structure type configuration
- `wincc-get-structure-variables` - Read structure type instances
- `wincc-get-tag-value` - Read runtime value of a specific tag
- `wincc-get-tag-values` - Read runtime values of multiple tags
- `wincc-write-tag-value` - Write value to a specific tag
- `wincc-write-tag-values` - Write values to multiple tags
- `wincc-get-tag-config` - Read configuration of a specific tag
- `wincc-get-tags-config` - Read configuration of all tags

### Archive System
- `wincc-get-archives` - Read all process value archive configurations
- `wincc-get-archive` - Read specific archive configuration
- `wincc-get-archive-variable` - Read specific archive variable configuration
- `wincc-get-archive-variables` - Read all variables in an archive
- `wincc-get-archive-value` - Read runtime value of an archive variable
- `wincc-get-archive-values` - Read runtime values of multiple archive variables
- `wincc-get-timers` - Read all archive system timer configurations
- `wincc-get-timer` - Read specific timer configuration
- `wincc-get-archive-tag` - Read archive system tag configuration
- `wincc-get-archive-tags` - Read all archive system tag configurations

### Alarm Logging
- `wincc-get-alarm-message-classes` - List message classes (GET /alarmLogging/MessageClasses)
- `wincc-get-alarm-message-class` - Read specific message class (GET /alarmLogging/MessageClass/{messageClassName})
- `wincc-get-alarm-message-types` - List message types (GET /alarmLogging/MessageTypes)
- `wincc-get-alarm-message-type` - Read specific message type (GET /alarmLogging/MessageType/{messageTypeName})
- `wincc-get-alarm-message-groups` - List message groups (GET /alarmLogging/MessageGroups)
- `wincc-get-alarm-message-group` - Read specific message group (GET /alarmLogging/MessageGroup/{messageGroupName})
- `wincc-get-alarm-message-blocks` - List message blocks (GET /alarmLogging/MessageBlocks)
- `wincc-get-alarm-message-block` - Read specific message block (GET /alarmLogging/MessageBlock/{messageBlockName})
- `wincc-get-alarm-messages` - List messages (GET /alarmLogging/Messages)
- `wincc-get-alarm-message` - Read specific message by number (GET /alarmLogging/Message/{messageNumber})
- `wincc-get-alarm-limit-values` - List limit values (GET /alarmLogging/LimitValues)
- `wincc-get-alarm-limit-value` - Read per-tag limit values (GET /alarmLogging/LimitValue/{tagName})
- `wincc-get-alarm-rest-filters` - List REST filters (GET /alarmLogging/RestFilters)
- `wincc-get-alarm-rest-filter` - Read REST filter (GET /alarmLogging/RestFilter/{filterName})
- `wincc-get-alarm-message-list` - Read runtime messages of a message list (GET /alarmLogging/MessageList/{filterName})
- `wincc-get-alarm-short-term-archive` - Read runtime messages from a short-term archive (GET /alarmLogging/ShortTermArchive/{filterName}). Supports `maxValues` to limit returned messages (message system).
- `wincc-get-alarm-long-term-archive` - Read runtime messages from a long-term archive (GET /alarmLogging/LongTermArchive/{filterName}). Supports `maxValues` to limit returned messages (message system).
- `wincc-get-alarm-hit-list` - Read runtime messages from a hit list (GET /alarmLogging/HitList/{filterName}). Supports `maxValues` to limit returned messages (message system).
- `wincc-get-alarm-lock-list` - Read runtime messages from a lock list (GET /alarmLogging/LockList/{filterName})
- `wincc-get-alarm-hide-list` - Read runtime messages from a list to be hidden (GET /alarmLogging/Hidelist/{filterName})
- `wincc-get-alarm-hidden-message-list` - Read runtime messages from a list of hidden messages (GET /alarmLogging/HiddenMessageList/{filterName})

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/wincc-mcp-server.git
cd wincc-mcp-server
```

2. Install dependencies:
```bash
npm install
```

## Disclaimer

**Security Notice:** This server has not been hardened or secured for production use. It is the responsibility of the user to implement appropriate security measures (such as authentication, authorization, network restrictions, and HTTPS) before deploying or exposing this server in any environment.

## Configuration

### Environment Variables
```bash
# WinCC REST API Configuration
WINCC_URL=https://localhost:34569/WinCCRestService  # Default WinCC REST service URL
WINCC_USR=username1                                # Default username
WINCC_PWD=password1                                # Default password
WINCC_BEARER_TOKEN=                                # Optional bearer token
WINCC_SKIP_CERTIFICATE_VALIDATION=false            # Set to true to skip SSL certificate validation (development only)
NODE_TLS_REJECT_UNAUTHORIZED=0                     # Set to 0 to disable TLS certificate validation (development only)

# CORS Configuration
WINCC_ALLOW_ORIGIN=*                               # CORS origin setting - '*' allows all origins, or specify specific URLs like 'http://localhost:3000'

# MCP Server Port
PORT=3000                                          # MCP server port (can also be set via --port)
```

### WinCC System Setup
1. **Enable WinCC REST Service**: In WinCC Configuration Studio → Computer → Properties → Startup → enable the WinCC REST service
2. **Configure Authentication**: Set up user accounts with appropriate permissions
3. **Network Configuration**: Ensure the REST service port (default 34569) is accessible
4. **HTTPS Certificate**: For production, configure proper SSL certificates

## Usage

### Starting the Server
```bash
# Using npm
npm start

# Using node directly (default port 3000)
node index.js

# Development mode with debugging
npm run dev
```

The server starts on port 3000 by default (or `$PORT` if set) and listens for MCP requests at the `/mcp` endpoint.

### CLI Options
You can override configuration via command-line flags:
```bash
# Set MCP server port
node index.js --port 4000

# Set WinCC REST base URL
node index.js --wincc-url https://my-host:34569/WinCCRestService

# Authentication (basic)
node index.js --wincc-usr myuser --wincc-pwd mypass

# Authentication (bearer token takes precedence over basic)
node index.js --wincc-bearer-token "eyJhbGciOi..."

# CORS allowed origin
node index.js --wincc-allow-origin "*"
node index.js --wincc-allow-origin "http://localhost:5173"

# Skip certificate validation for https (development only)
node index.js --wincc-skip-certificate-validation

# Control Node's TLS rejection directly (development only)
node index.js --node-tls-reject-unauthorized 0

# Combine options
node index.js --port 4000 \
  --wincc-url https://my-host:34569/WinCCRestService \
  --wincc-usr myuser --wincc-pwd mypass \
  --wincc-allow-origin "http://localhost:5173" \
  --wincc-skip-certificate-validation

# If installed via npm (bin: wincc-mcp-server)
wincc-mcp-server --port 4000 --wincc-url https://my-host:34569/WinCCRestService

# Show help
node index.js --help
```

Precedence: CLI flags override environment variables; otherwise defaults apply.

## Connecting with a Claude Desktop Client

To use this MCP server with the Claude AI desktop application (or other clients supporting `mcp-remote`), you need to configure the client to connect to this server. For the Claude Desktop application, this is typically done by editing a `claude_desktop_config.json` file. The location of this file varies by operating system but is usually within the Claude application's support or configuration directory.

Add or update the `mcpServers` section in your `claude_desktop_config.json` file like this:

```json
{
  "mcpServers": {
    "WinCC V8": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

## Language Settings

- Accept-Language: Preferred response language for localized texts (e.g., message text)
- Content-Language: Language context for identifiers passed in URL or query
- Default: If omitted, WinCC typically defaults to `en-US`

## Runtime List Notes

- Message list endpoints (`MessageList`, `ShortTermArchive`, `LongTermArchive`, `HitList`, `LockList`, `Hidelist`, `HiddenMessageList`) accept a `filterName` path segment referring to a configured REST filter.
- Paging (`itemLimit`, `continuationPoint`) applies to configuration list endpoints, not message system runtime lists.
- For `ShortTermArchive`, `LongTermArchive`, and `HitList`, you can use `maxValues` to cap the number of returned messages (up to 1000 unless otherwise specified).
- Combine with `Accept-Language` and `Content-Language` as needed.

## Technical Details

### Security Considerations
- **HTTPS Support**: Configure HTTPS for production environments
- **Certificate Validation**: The server can bypass SSL certificate validation (development only)
- **Authentication**: Always use proper authentication credentials
- **Network Security**: Ensure proper firewall and network security configurations
- **CORS Configuration**: Use `WINCC_ALLOW_ORIGIN` to restrict allowed origins in production

### CORS (Cross-Origin Resource Sharing)
The server includes CORS support to allow web applications to access the MCP endpoints from different origins:

- **Development**: Use `WINCC_ALLOW_ORIGIN=*` to allow all origins
- **Production**: Specify exact origins like `WINCC_ALLOW_ORIGIN=https://yourdomain.com,https://anotherdomain.com`
- **Multiple Origins**: Separate multiple origins with commas
- **Security**: Never use `*` in production environments with sensitive data

## Troubleshooting

### Common Issues
1. **Connection Failed**: Check WinCC REST service is running and accessible
2. **Authentication Error**: Verify username/password or bearer token
3. **HTTPS Certificate Error**: Use proper certificates or disable validation for development
4. **Tag Not Found**: Ensure tag names are correct and accessible
5. **Permission Denied**: Check user permissions in WinCC configuration

### Debug Mode
Run with debugging enabled:
```bash
npm run dev
```

## Author

Created by Andreas Vogler, 2025
