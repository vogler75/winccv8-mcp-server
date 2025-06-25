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

## Configuration

### Environment Variables
```bash
# WinCC REST API Configuration
WINCC_URL=http://localhost:34569/WinCCRestService  # Default WinCC REST service URL
WINCC_USR=username1                                # Default username
WINCC_PWD=password1                                # Default password
WINCC_BEARER_TOKEN=                                # Optional bearer token
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

# Using node directly
node index.js

# Development mode with debugging
npm run dev
```

The server will start on port 3000 by default and listen for MCP requests at the `/mcp` endpoint.

## Technical Details

### Security Considerations
- **HTTPS Support**: Configure HTTPS for production environments
- **Certificate Validation**: The server can bypass SSL certificate validation (development only)
- **Authentication**: Always use proper authentication credentials
- **Network Security**: Ensure proper firewall and network security configurations

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

## License

MIT License - see package.json for details.

## Author

Created by Andreas Vogler, 2025