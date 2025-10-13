#!/usr/bin/env node
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

// ------------------------------
// Minimal CLI argument parsing
// ------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    let key, val;
    if (eq !== -1) {
      key = a.slice(2, eq);
      val = a.slice(eq + 1);
    } else {
      key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        val = next; i++;
      } else {
        val = 'true';
      }
    }
    out[key] = val;
  }
  return out;
}

function parseBoolean(v, defaultVal = false) {
  if (v === undefined || v === null) return defaultVal;
  const s = String(v).toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return defaultVal;
}

function printHelp() {
  const help = `WinCC V8 MCP Server

Usage:
  node index.js [options]
  wincc-mcp-server [options]

Options:
  --port <number>                         MCP server port (default: 3000 or $PORT)
  --wincc-url <url>                       WinCC V8 REST base URL (default: $WINCC_URL or https://<hostname>:34569/WinCCRestService)
  --wincc-usr <username>                  Username for basic auth (default: $WINCC_USR or 'username1')
  --wincc-pwd <password>                  Password for basic auth (default: $WINCC_PWD or 'password1')
  --wincc-bearer-token <token>            Bearer token (overrides basic auth)
  --wincc-allow-origin <origin>           CORS allowed origin, e.g. '*' or 'http://host:port'
  --wincc-skip-certificate-validation     If set (or =true), ignore self-signed certs for https
  --node-tls-reject-unauthorized <0|1>    Set NODE_TLS_REJECT_UNAUTHORIZED (0 disables TLS verification)
  --debug                                 Enable debug logging
  -h, --help                              Show this help

Environment variables (still supported):
  PORT
  WINCC_URL
  WINCC_USR
  WINCC_PWD
  WINCC_BEARER_TOKEN
  WINCC_ALLOW_ORIGIN
  WINCC_SKIP_CERTIFICATE_VALIDATION
  NODE_TLS_REJECT_UNAUTHORIZED
  DEBUG
`;
  console.log(help);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

// Apply NODE_TLS_REJECT_UNAUTHORIZED as early as possible if passed
if (args['node-tls-reject-unauthorized'] !== undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = String(args['node-tls-reject-unauthorized']);
}

// Define the URL of your WinCC REST server
const os = await import('os');
const hostname = os.hostname();
const WINCC_URL = (args['wincc-url']) || process.env.WINCC_URL || `https://${hostname}:34569/WinCCRestService`;
const WINCC_USR = (args['wincc-usr']) || process.env.WINCC_USR || "username1";
const WINCC_PWD = (args['wincc-pwd']) || process.env.WINCC_PWD || "password1";
const WINCC_BEARER_TOKEN = (args['wincc-bearer-token']) || process.env.WINCC_BEARER_TOKEN || null;
const WINCC_ALLOW_ORIGIN = (args['wincc-allow-origin']) || process.env.WINCC_ALLOW_ORIGIN || null;
const WINCC_SKIP_CERT_VALIDATION = parseBoolean(
  args['wincc-skip-certificate-validation'] ?? process.env.WINCC_SKIP_CERTIFICATE_VALIDATION,
  false
);
const DEBUG = parseBoolean(args['debug'] ?? process.env.DEBUG, false);

// Create an HTTPS agent that ignores self-signed certificate errors
// WARNING: Use with caution, only for development or trusted internal networks.
const agentToUse = WINCC_URL.startsWith('https://') && WINCC_SKIP_CERT_VALIDATION
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

const sessionData = {
  usr: WINCC_USR,
  pwd: WINCC_PWD,
  bearerToken: WINCC_BEARER_TOKEN
};

// Helper function to make HTTP requests to WinCC REST API
async function makeWinCCRequest(endpoint, method = 'GET', body = null, extraHeaders = undefined) {
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

  // Merge optional extra headers (e.g., language settings)
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v !== undefined && v !== null && v !== '') headers[k] = v;
    }
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
    return data;
  } catch (error) {
    console.error(`WinCC API request failed: ${error.message} ${method} ${url} ${body ? JSON.stringify(body) : ''}`);

    // Enhanced error logging with more details
    console.error('=== WinCC API Request Failed ===');
    console.error('URL:', url);
    console.error('Method:', method);
    console.error('Headers:', JSON.stringify(headers, null, 2));
    console.error('Body:', body ? JSON.stringify(body, null, 2) : 'No body');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error cause:', error.cause);
    console.error('Error stack:', error.stack);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'CERT_HAS_EXPIRED' ||
        error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      console.error('SSL Certificate issue detected');
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      console.error('Connection issue detected');
    }
    if (error.code === 'ETIMEDOUT' || error.name === 'AbortError') {
      console.error('Timeout issue detected');
    }
    
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
      sessionData.usr = username;
      sessionData.pwd = password;
      sessionData.bearerToken = null; // Clear any existing bearer token

      await makeWinCCRequest("/tagManagement/Connections");

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
  "Reads configuration data of all connections in Tag Management. Base URL: /tagManagement. Endpoint: Connections. According to WinCC REST docs, returns connections created below communication drivers; supports paging via itemLimit and continuationPoint.",
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
// ALARM LOGGING TOOLS
// ------------------------------------------------------------------------------------------------------------------------------------------------



server.tool(
  "wincc-get-alarm-message-classes",
  "Lists message classes. GET /alarmLogging/MessageClasses with optional paging (itemLimit, continuationPoint). Use Accept-Language for response language and Content-Language for name resolution.",
  {
    itemLimit: z.number().optional(),
    continuationPoint: z.number().optional(),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ itemLimit, continuationPoint, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      let endpoint = "/alarmLogging/MessageClasses";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Classes:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message classes: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-class",
  "Reads a message class. GET /alarmLogging/MessageClass/{messageClassName}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    messageClassName: z.string().min(1, "Message class name cannot be empty"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ messageClassName, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/MessageClass/${encodeURIComponent(messageClassName)}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Class '${messageClassName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message class '${messageClassName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-types",
  "Lists message types. GET /alarmLogging/MessageTypes with optional paging (itemLimit, continuationPoint). Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    itemLimit: z.number().optional(),
    continuationPoint: z.number().optional(),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ itemLimit, continuationPoint, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      let endpoint = "/alarmLogging/MessageTypes";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Types:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message types: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-type",
  "Reads a message type. GET /alarmLogging/MessageType/{messageTypeName}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    messageTypeName: z.string().min(1, "Message type name cannot be empty"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ messageTypeName, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/MessageType/${encodeURIComponent(messageTypeName)}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Type '${messageTypeName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message type '${messageTypeName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-blocks",
  "Lists message blocks. GET /alarmLogging/MessageBlocks with optional paging (itemLimit, continuationPoint). Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    itemLimit: z.number().optional(),
    continuationPoint: z.number().optional(),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ itemLimit, continuationPoint, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      let endpoint = "/alarmLogging/MessageBlocks";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Blocks:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message blocks: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-block",
  "Reads a message block. GET /alarmLogging/MessageBlock/{messageBlockName}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    messageBlockName: z.string().min(1, "Message block name cannot be empty"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ messageBlockName, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/MessageBlock/${encodeURIComponent(messageBlockName)}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Block '${messageBlockName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message block '${messageBlockName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-messages",
  "Lists messages. GET /alarmLogging/Messages with optional paging (itemLimit, continuationPoint). Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    itemLimit: z.number().optional(),
    continuationPoint: z.number().optional(),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ itemLimit, continuationPoint, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      let endpoint = "/alarmLogging/Messages";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Messages:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving messages: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message",
  "Reads a message. GET /alarmLogging/Message/{messageNumber}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    messageNumber: z.union([z.string(), z.number()]).describe("Message number identifier"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ messageNumber, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/Message/${encodeURIComponent(String(messageNumber))}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message '${messageNumber}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message '${messageNumber}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-limit-values",
  "Lists limit values. GET /alarmLogging/LimitValues with optional paging (itemLimit, continuationPoint). Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    itemLimit: z.number().optional(),
    continuationPoint: z.number().optional(),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ itemLimit, continuationPoint, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      let endpoint = "/alarmLogging/LimitValues";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Limit Values:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving limit values: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-limit-value",
  "Reads limit values for a tag. GET /alarmLogging/LimitValue/{tagName}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    tagName: z.string().min(1, "Tag name cannot be empty"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ tagName, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/LimitValue/${encodeURIComponent(tagName)}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Limit Value for tag '${tagName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving limit value for tag '${tagName}': ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-groups",
  "Lists message groups. GET /alarmLogging/MessageGroups with optional paging (itemLimit, continuationPoint). Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    itemLimit: z.number().optional(),
    continuationPoint: z.number().optional(),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ itemLimit, continuationPoint, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      let endpoint = "/alarmLogging/MessageGroups";
      const params = new URLSearchParams();
      if (itemLimit) params.append("itemLimit", itemLimit.toString());
      if (continuationPoint) params.append("continuationPoint", continuationPoint.toString());
      if (params.toString()) endpoint += `?${params.toString()}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Groups:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message groups: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-message-group",
  "Reads a message group. GET /alarmLogging/MessageGroup/{messageGroupName}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    messageGroupName: z.string().min(1, "Message group name cannot be empty"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ messageGroupName, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/MessageGroup/${encodeURIComponent(messageGroupName)}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC Message Group '${messageGroupName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving message group '${messageGroupName}': ${error.message}`);
    }
  }
);




// Alarm Logging runtime tools: RestFilters and message lists
server.tool(
  "wincc-get-alarm-rest-filters",
  "Lists configured REST filters. GET /alarmLogging/RestFilters. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = "/alarmLogging/RestFilters";
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC REST Filters:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving REST filters: ${error.message}`);
    }
  }
);

server.tool(
  "wincc-get-alarm-rest-filter",
  "Reads a REST filter. GET /alarmLogging/RestFilter/{filterName}. Use Accept-Language for response language and Content-Language for identifier resolution.",
  {
    filterName: z.string().min(1, "Filter name cannot be empty"),
    acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
    contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE")
  },
  async ({ filterName, acceptLanguage, contentLanguage }, executionContext) => {
    try {
      const endpoint = `/alarmLogging/RestFilter/${encodeURIComponent(filterName)}`;
      const headers = {
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
        ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
      };
      const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
      return mcpResult(`WinCC REST Filter '${filterName}':\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      return mcpResult(`Error retrieving REST filter '${filterName}': ${error.message}`);
    }
  }
);

function defineAlarmListTool(name, pathSegment, description, { allowMaxValues = false } = {}) {
  const toolDescription = allowMaxValues
    ? `${description} GET /alarmLogging/${pathSegment}/{filterName}. Optional query: maxValues (message system). Use Accept-Language for response language and Content-Language for identifier resolution.`
    : `${description} GET /alarmLogging/${pathSegment}/{filterName}. Use Accept-Language for response language and Content-Language for identifier resolution.`;

  const schemaShape = allowMaxValues
    ? {
        filterName: z.string().min(1, "Filter name cannot be empty"),
        maxValues: z.number().optional().describe("Maximum number of messages (message system)"),
        acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
        contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE"),
      }
    : {
        filterName: z.string().min(1, "Filter name cannot be empty"),
        acceptLanguage: z.string().optional().describe("Preferred response language, e.g., en-US, de-DE"),
        contentLanguage: z.string().optional().describe("Language for identifiers in URL/query, e.g., en-US, de-DE"),
      };

  server.tool(
    name,
    toolDescription,
    schemaShape,
    async (args, executionContext) => {
      const { filterName, acceptLanguage, contentLanguage } = args;
      try {
        let endpoint = `/alarmLogging/${pathSegment}/${encodeURIComponent(filterName)}`;
        if (allowMaxValues && typeof args.maxValues === 'number') {
          const params = new URLSearchParams();
          params.append('maxValues', String(args.maxValues));
          endpoint += `?${params.toString()}`;
        }
        const headers = {
          ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
          ...(contentLanguage ? { 'Content-Language': contentLanguage } : {})
        };
        const result = await makeWinCCRequest(endpoint, 'GET', null, headers);
        return mcpResult(`WinCC ${pathSegment} messages for filter '${filterName}':\n${JSON.stringify(result, null, 2)}`);
      } catch (error) {
        return mcpResult(`Error retrieving ${pathSegment} messages for filter '${filterName}': ${error.message}`);
      }
    }
  );
}

defineAlarmListTool("wincc-get-alarm-message-list", "MessageList", "Read runtime messages of a message list.");

defineAlarmListTool("wincc-get-alarm-short-term-archive", "ShortTermArchive", "Read runtime messages from a short-term archive.", { allowMaxValues: true });

defineAlarmListTool("wincc-get-alarm-long-term-archive", "LongTermArchive", "Read runtime messages from a long-term archive.", { allowMaxValues: true });

defineAlarmListTool("wincc-get-alarm-hit-list", "HitList", "Read runtime messages from a hit list.", { allowMaxValues: true });

defineAlarmListTool("wincc-get-alarm-lock-list", "LockList", "Read runtime messages from a lock list.");

defineAlarmListTool("wincc-get-alarm-hide-list", "Hidelist", "Read runtime messages from a list of messages to be hidden.");

defineAlarmListTool("wincc-get-alarm-hidden-message-list", "HiddenMessageList", "Read runtime messages from a list of hidden messages.");

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Express server setup for MCP requests
// ------------------------------------------------------------------------------------------------------------------------------------------------

const app = express();

// CORS middleware to allow cross-origin requests
app.use((req, res, next) => {
  if (DEBUG) {
    console.log(`[CORS] ${req.method} ${req.path} from origin: ${req.headers.origin || '(none)'}`);
  }

  if (WINCC_ALLOW_ORIGIN) {
    res.header('Access-Control-Allow-Origin', WINCC_ALLOW_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, mcp-protocol-version');
    if (DEBUG) {
      console.log(`[CORS] Headers set with Allow-Origin: ${WINCC_ALLOW_ORIGIN}`);
    }
  } else if (DEBUG) {
    console.log('[CORS] WARNING: WINCC_ALLOW_ORIGIN not set, CORS headers not added');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (DEBUG) {
      console.log('[CORS] Handling OPTIONS preflight request');
    }
    return res.status(200).end();
  }

  next();
});

app.use(express.json());

app.post('/mcp', async (req, res) => {
  if (DEBUG) {
    console.log('Received POST MCP request: ' + req.url + ' ' + JSON.stringify(req.body, null, 2));
  }
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      transport.close();
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
  if (DEBUG) {
    console.log('Received GET MCP request');
  }
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
  if (DEBUG) {
    console.log('Received DELETE MCP request');
  }
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
const parsedPort = args.port || process.env.PORT;
let PORT = 3000;
if (parsedPort !== undefined) {
  const n = Number(parsedPort);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`Invalid --port value: '${parsedPort}'. Expected integer 1-65535.`);
    process.exit(1);
  }
  PORT = n;
}

// Print effective configuration at startup
console.log('\n=== WinCC V8 MCP Server Configuration ===');
console.log(`Port: ${PORT}`);
console.log(`WinCC URL: ${WINCC_URL}`);
console.log(`WinCC Username: ${WINCC_USR}`);
console.log(`WinCC Password: ${WINCC_PWD ? '***' + WINCC_PWD.slice(-3) : '(not set)'}`);
console.log(`WinCC Bearer Token: ${WINCC_BEARER_TOKEN ? '***' + WINCC_BEARER_TOKEN.slice(-8) : '(not set)'}`);
console.log(`CORS Allow Origin: ${WINCC_ALLOW_ORIGIN || '(not set - CORS disabled)'}`);
console.log(`Skip Certificate Validation: ${WINCC_SKIP_CERT_VALIDATION}`);
console.log(`NODE_TLS_REJECT_UNAUTHORIZED: ${process.env.NODE_TLS_REJECT_UNAUTHORIZED || '(not set)'}`);
console.log(`Debug Mode: ${DEBUG}`);
console.log('==========================================\n');

app.listen(PORT, () => {
  console.log(`WinCC V8 MCP Server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
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
