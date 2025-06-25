/*
 * Created by Andreas Vogler 2025
 *
 * A model context protocol server for WinCC V8 based on its REST API
 *
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from 'express';
import https from 'https';

// Define the URL of your WinCC REST server
const WINCC_URL = process.env.WINCC_URL || "http://localhost:34569/WinCCRestService";
const WINCC_USR = process.env.WINCC_USR || "username1";
const WINCC_PWD = process.env.WINCC_PWD || "password1";
const WINCC_BEARER_TOKEN = process.env.WINCC_BEARER_TOKEN || null;

// Create an HTTPS agent that ignores self-signed certificate errors
// WARNING: Use with caution, only for development or trusted internal networks.
const agentToUse = WINCC_URL.startsWith('https://')
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

console.log("WinCC URL: ", WINCC_URL);

const sessionData = {
  usr: WINCC_USR,
  pwd: WINCC_PWD,
  bearerToken: WINCC_BEARER_TOKEN
};

// Helper function to make HTTP requests to WinCC REST API
async function makeWinCCRequest(endpoint, method = 'GET', body = null) {
  const url = `${WINCC_URL}${endpoint}`;

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Add authentication - prefer bearer token, fallback to basic auth
  if (sessionData.bearerToken) {
    headers['Authorization'] = `Bearer ${sessionData.bearerToken}`;
  } else if (sessionData.usr && sessionData.pwd) {
    const credentials = Buffer.from(`${sessionData.usr}:${sessionData.pwd}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const options = {
    method,
    headers,
    agent: agentToUse
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    //console.log(`Response from WinCC API: ${JSON.stringify(data, null, 2)}`);
    return data;
  } catch (error) {
    console.error(`WinCC API request failed: ${error.message} ${method} ${url} ${body ? JSON.stringify(body) : ''}`);
    throw error;
  }
}

// Create server instance
const server = new McpServer({
  name: "WinCC V8 MCP Server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// ------------------------------------------------------------------------------------------------------------------------------------------------
// AUTHENTICATION TOOL
// ------------------------------------------------------------------------------------------------------------------------------------------------

server.tool(
  "login-user",
  `Logs a user in to WinCC using username and password. 
   Stores the session credentials for subsequent requests. 
   It is optional, because the MCP server could be started in the way that it is doing automatically a logon with the service account.`,
  {
    username: z.string().min(1, "Username cannot be empty."),
    password: z.string().min(1, "Password cannot be empty."),
  },
  async ({ username, password }, executionContext) => {
    try {
      // Store credentials for basic auth
      sessionData.usr = username;
      sessionData.pwd = password;
      sessionData.bearerToken = null; // Clear any existing bearer token

      // Test the connection by trying to get connections
      const testResult = await makeWinCCRequest("/tagManagement/Connections");

      return mcpResult(`Successfully logged in to WinCC as user '${username}'. Authentication credentials stored for session.`);
    } catch (error) {
      return mcpResult(`Login failed for user '${username}': ${error.message}`);
    }
  }
);

// ------------------------------------------------------------------------------------------------------------------------------------------------
// TAG MANAGEMENT TOOLS
// ------------------------------------------------------------------------------------------------------------------------------------------------

server.tool(
  "wincc-get-connections",
  "Read configuration data of all connections in WinCC Tag Management",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagManagement/Connections";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Connections:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving connections: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-connection",
  "Read configuration data of a specific connection",
  {
    connectionName: z.string().min(1, "Connection name cannot be empty")
  },
  async ({ connectionName }, executionContext) => {
    try {
      const endpoint = `/tagManagement/Connection/${encodeURIComponent(connectionName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Connection '${connectionName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving connection '${connectionName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-groups",
  "Read configuration data of all tag groups",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagManagement/Groups";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Tag Groups:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving tag groups: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-group",
  "Read configuration data of a specific tag group",
  {
    groupName: z.string().min(1, "Group name cannot be empty")
  },
  async ({ groupName }, executionContext) => {
    try {
      const endpoint = `/tagManagement/Group/${encodeURIComponent(groupName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Tag Group '${groupName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving tag group '${groupName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-structure-types",
  "Read configuration data of all structure types",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagManagement/StructureTypes";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Structure Types:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving structure types: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-structure-type",
  "Read configuration data of a specific structure type",
  {
    structureName: z.string().min(1, "Structure name cannot be empty")
  },
  async ({ structureName }, executionContext) => {
    try {
      const endpoint = `/tagManagement/StructureType/${encodeURIComponent(structureName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Structure Type '${structureName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving structure type '${structureName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-structure-variables",
  "Read instances of structure types",
  {
    structureTypeName: z.string().optional().describe("Name of the structure type"),
    typeNames: z.array(z.string()).optional().describe("Array of structure type names for multiple types")
  },
  async ({ structureTypeName, typeNames }, executionContext) => {
    try {
      let endpoint, method = 'GET', body = null;

      if (structureTypeName) {
        endpoint = `/tagManagement/StructureVariable/${encodeURIComponent(structureTypeName)}`;
      } else if (typeNames) {
        endpoint = "/tagManagement/StructureVariables";
        method = 'POST';
        body = { typeNames };
      } else {
        endpoint = "/tagManagement/StructureVariables";
      }

      const result = await makeWinCCRequest(endpoint, method, body);
      return mcpResult(`WinCC Structure Variables:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving structure variables: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-tag-value",
  "Read runtime value of a specific tag",
  {
    tagName: z.string().min(1, "Tag name cannot be empty")
  },
  async ({ tagName }, executionContext) => {
    try {
      const endpoint = `/tagManagement/Value/${encodeURIComponent(tagName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Tag Value '${tagName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error reading tag value '${tagName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-tag-values",
  "Read runtime values of multiple tags",
  {
    tagNames: z.array(z.string()).min(1, "At least one tag name is required")
  },
  async ({ tagNames }, executionContext) => {
    try {
      const endpoint = "/tagManagement/Values";
      const body = { variableNames: tagNames };
      const result = await makeWinCCRequest(endpoint, 'POST', body);
      return mcpResult(`WinCC Tag Values:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error reading tag values: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-write-tag-value",
  "Write a value to a specific tag",
  {
    tagName: z.string().min(1, "Tag name cannot be empty"),
    value: z.union([z.string(), z.number(), z.boolean()]).describe("Value to write to the tag")
  },
  async ({ tagName, value }, executionContext) => {
    try {
      const endpoint = `/tagManagement/Value/${encodeURIComponent(tagName)}`;
      const body = { value };
      const result = await makeWinCCRequest(endpoint, 'PUT', body);
      return mcpResult(`WinCC Tag Write Result '${tagName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error writing to tag '${tagName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-write-tag-values",
  "Write values to multiple tags",
  {
    tagValues: z.array(z.object({
      variableName: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()])
    })).min(1, "At least one tag value pair is required")
  },
  async ({ tagValues }, executionContext) => {
    try {
      const endpoint = "/tagManagement/Values";
      const result = await makeWinCCRequest(endpoint, 'PUT', tagValues);
      return mcpResult(`WinCC Multi-Tag Write Results:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error writing tag values: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-tag-config",
  "Read configuration data of a specific tag",
  {
    tagName: z.string().min(1, "Tag name cannot be empty")
  },
  async ({ tagName }, executionContext) => {
    try {
      const endpoint = `/tagManagement/variable/${encodeURIComponent(tagName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Tag Configuration '${tagName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving tag configuration '${tagName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-tags-config",
  "Read configuration data of all tags",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagManagement/variables";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Tags Configuration:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving tags configuration: ${error.message}`);
    }
  }
);

// ------------------------------------------------------------------------------------------------------------------------------------------------
// ARCHIVING SYSTEM TOOLS
// ------------------------------------------------------------------------------------------------------------------------------------------------

server.tool(
  "wincc-get-archives",
  "Read configuration data of all process value archives",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagLogging/Archives";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archives:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archives: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive",
  "Read configuration data of a specific process value archive",
  {
    archiveName: z.string().min(1, "Archive name cannot be empty")
  },
  async ({ archiveName }, executionContext) => {
    try {
      const endpoint = `/tagLogging/Archive/${encodeURIComponent(archiveName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive '${archiveName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive '${archiveName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive-variable",
  "Read configuration data of a specific archive variable",
  {
    archiveName: z.string().min(1, "Archive name cannot be empty"),
    variableName: z.string().min(1, "Variable name cannot be empty")
  },
  async ({ archiveName, variableName }, executionContext) => {
    try {
      const endpoint = `/tagLogging/Archive/${encodeURIComponent(archiveName)}/Variable/${encodeURIComponent(variableName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Variable '${variableName}' in '${archiveName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive variable '${variableName}' from '${archiveName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive-variables",
  "Read configuration data of all variables in an archive",
  {
    archiveName: z.string().min(1, "Archive name cannot be empty"),
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ archiveName, itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = `/tagLogging/Archive/${encodeURIComponent(archiveName)}/Variables`;
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Variables in '${archiveName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive variables from '${archiveName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive-value",
  "Read runtime value of an archive variable",
  {
    archiveName: z.string().min(1, "Archive name cannot be empty"),
    variableName: z.string().min(1, "Variable name cannot be empty")
  },
  async ({ archiveName, variableName }, executionContext) => {
    try {
      const endpoint = `/tagLogging/Archive/${encodeURIComponent(archiveName)}/Value/${encodeURIComponent(variableName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Value '${variableName}' from '${archiveName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive value '${variableName}' from '${archiveName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive-values",
  "Read runtime values of multiple archive variables",
  {
    variableNames: z.array(z.string()).optional().describe("Array of variable names from single archive"),
    archives: z.array(z.object({
      name: z.string(),
      variables: z.array(z.object({
        name: z.string(),
        timeFrom: z.string().optional(),
        timeTo: z.string().optional(),
        range: z.number().optional(),
        maxValues: z.number().optional()
      }))
    })).optional().describe("Array of archives with their variables and time filters")
  },
  async ({ variableNames, archives }, executionContext) => {
    try {
      const endpoint = "/tagLogging/Values";
      let body;

      if (variableNames) {
        body = { variableNames };
      } else if (archives) {
        body = { archives };
      } else {
        throw new Error("Either variableNames or archives must be provided");
      }

      const result = await makeWinCCRequest(endpoint, 'POST', body);
      return mcpResult(`WinCC Archive Values:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive values: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-timers",
  "Read configuration data of all archive system timers",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagLogging/Timers";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Timers:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving timers: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-timer",
  "Read configuration data of a specific archive system timer",
  {
    timerName: z.string().min(1, "Timer name cannot be empty")
  },
  async ({ timerName }, executionContext) => {
    try {
      const endpoint = `/tagLogging/Timer/${encodeURIComponent(timerName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Timer '${timerName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving timer '${timerName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive-tag",
  "Read configuration data of an archive system tag",
  {
    tagName: z.string().min(1, "Tag name cannot be empty")
  },
  async ({ tagName }, executionContext) => {
    try {
      const endpoint = `/tagLogging/Variable/${encodeURIComponent(tagName)}`;
      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Tag '${tagName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive tag '${tagName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-archive-tags",
  "Read configuration data of all archive system tags",
  {
    itemLimit: z.number().optional().describe("Maximum number of items to return"),
    continuationPoint: z.number().optional().describe("Continuation point for paging")
  },
  async ({ itemLimit, continuationPoint }, executionContext) => {
    try {
      let endpoint = "/tagLogging/Variables";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;

      const result = await makeWinCCRequest(endpoint);
      return mcpResult(`WinCC Archive Tags:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving archive tags: ${error.message}`);
    }
  }
);

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Express server setup for MCP requests
// ------------------------------------------------------------------------------------------------------------------------------------------------

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  console.log('Received POST MCP request');
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      transport.close();
      // server.close(); // DO NOT close the main server instance on each request
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get('/mcp', async (req, res) => {
  console.log('Received GET MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

app.delete('/mcp', async (req, res) => {
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`WinCC V8 MCP Server listening on port ${PORT}`);
});

function mcpResult(text) {
  return {
    content: [
      {
        type: "text",
        text: text
      }
    ]
  };
}
