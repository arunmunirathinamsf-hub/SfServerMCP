#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

// ── Salesforce session ────────────────────────────────────────────────────────

let sfSession = null;

async function getSFSession() {
  if (sfSession?.access_token) return sfSession;

  const { SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD } = process.env;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    username: SF_USERNAME,
    password: SF_PASSWORD,
  });

  const res = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Salesforce auth failed');
  sfSession = { access_token: data.access_token, instance_url: data.instance_url };
  return sfSession;
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function sfGet(path) {
  const sf = await getSFSession();
  const res = await fetch(`${sf.instance_url}${path}`, {
    headers: { Authorization: `Bearer ${sf.access_token}` },
  });
  return res.json();
}

async function runSoql(query) {
  const sf = await getSFSession();
  const res = await fetch(
    `${sf.instance_url}/services/data/v60.0/query?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${sf.access_token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data[0]?.message || 'SOQL query failed');
  const records = data.records.map(({ attributes, ...rest }) => rest);
  return { totalSize: data.totalSize, records };
}

async function describeObject(objectName) {
  const data = await sfGet(`/services/data/v60.0/sobjects/${objectName}/describe`);
  return {
    name: data.name,
    label: data.label,
    fields: data.fields.map(f => ({ name: f.name, label: f.label, type: f.type })),
  };
}

async function listObjects() {
  const data = await sfGet('/services/data/v60.0/sobjects');
  return data.sobjects
    .filter(o => o.queryable)
    .map(o => ({ name: o.name, label: o.label, custom: o.custom }));
}

async function getOrgLimits() {
  return sfGet('/services/data/v60.0/limits');
}

// ── MCP server factory (one instance per SSE connection) ─────────────────────

function createMcpServer() {
  const server = new Server(
    { name: 'salesforce-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'run_soql',
        description: 'Run a SOQL query against Salesforce and return records. Use this to answer any data question.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'A valid SOQL query string' } },
          required: ['query'],
        },
      },
      {
        name: 'describe_object',
        description: 'Get all field names and types for a Salesforce object. Always call this before writing a query to confirm exact field API names.',
        inputSchema: {
          type: 'object',
          properties: { object_name: { type: 'string', description: 'API name of the object e.g. Restaurant__c' } },
          required: ['object_name'],
        },
      },
      {
        name: 'list_objects',
        description: 'List all queryable SObjects in the Salesforce org.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_org_limits',
        description: 'Get current API usage and limits for the Salesforce org.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      let result;
      if (name === 'run_soql')             result = await runSoql(args.query);
      else if (name === 'describe_object') result = await describeObject(args.object_name);
      else if (name === 'list_objects')    result = await listObjects();
      else if (name === 'get_org_limits')  result = await getOrgLimits();
      else throw new Error(`Unknown tool: ${name}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  return server;
}

// ── HTTP / SSE server ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Active SSE transports keyed by sessionId
const transports = {};

// Optional bearer-token protection — set MCP_API_KEY env var to enable
const MCP_API_KEY = process.env.MCP_API_KEY;
function checkApiKey(req, res, next) {
  if (!MCP_API_KEY) return next();
  const key = req.headers['x-api-key'] ?? req.query.apiKey;
  if (key !== MCP_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/sse', checkApiKey, async (req, res) => {
  const transport = new SSEServerTransport('/message', res);
  transports[transport.sessionId] = transport;
  res.on('close', () => delete transports[transport.sessionId]);
  await createMcpServer().connect(transport);
});

app.post('/message', checkApiKey, async (req, res) => {
  const transport = transports[req.query.sessionId];
  if (!transport) return res.status(404).json({ error: 'Session not found' });
  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Salesforce MCP server listening on port ${PORT}`));
