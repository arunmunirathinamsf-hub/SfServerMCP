# SF Dev Cockpit — Project Documentation

## Overview

SF Dev Cockpit is a personal Salesforce developer tool with three features:
- **Org Health** — view API usage and org limits
- **AI Query** — ask plain English questions about your Salesforce data, answered by Claude AI
- **Schema Explorer** — browse Salesforce object fields and auto-generate SOQL

---

## Architecture

```
User's Browser
      │
      │ HTTPS
      ▼
┌─────────────┐
│   Vercel    │  React UI + Express API (/api/*)
└─────────────┘
      │
      │ AI Query request
      ▼
┌─────────────┐     SSE connection      ┌─────────────┐
│  Express    │ ──────────────────────► │   Fly.io    │
│  (Vercel)   │ ◄────────────────────── │ MCP Server  │
└─────────────┘    tool results         └─────────────┘
                                               │
                                               │ REST API
                                               ▼
                                        ┌─────────────┐
                                        │  Salesforce │
                                        └─────────────┘
```

### Services

| Service | Host | Cost | Purpose |
|---|---|---|---|
| React Client | Vercel | Free | Frontend UI |
| Express API | Vercel | Free | Backend API, Claude integration |
| MCP Server | Fly.io | Free | Salesforce tool execution over SSE |

---

## Project Structure

```
sf-dev-cockpit/
├── client/                   # React frontend (Vite + TailwindCSS)
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── OrgHealth.jsx
│   │       ├── QueryRunner.jsx
│   │       └── SchemaExplorer.jsx
│   ├── vite.config.js
│   └── package.json
│
├── server/                   # Express backend (Node.js, CommonJS)
│   ├── index.js              # App entry point
│   ├── routes/
│   │   ├── auth.js           # Salesforce OAuth login/logout
│   │   ├── ai.js             # Claude + MCP AI query
│   │   ├── org.js            # Org info
│   │   ├── query.js          # SOQL execution
│   │   └── schema.js         # Object schema
│   ├── middleware/
│   │   └── sfToken.js        # SF session guard
│   ├── .env                  # Local secrets (never commit)
│   └── package.json
│
├── mcp-server/               # MCP server (Node.js, ESM)
│   ├── index.js              # SSE HTTP server with 4 SF tools
│   ├── Dockerfile
│   ├── fly.toml              # Fly.io deployment config
│   ├── .env.example
│   └── package.json
│
├── vercel.json               # Vercel deployment config
├── render.yaml               # Render deployment config (alternative)
└── .gitignore
```

---

## MCP Tools

The MCP server exposes 4 tools that Claude can call:

| Tool | Description |
|---|---|
| `run_soql` | Execute a SOQL query and return records |
| `describe_object` | Get all field names and types for a Salesforce object |
| `list_objects` | List all queryable SObjects in the org |
| `get_org_limits` | Get current API usage and limits |

---

## Environment Variables

### server/.env (Vercel environment variables)

| Variable | Description |
|---|---|
| `SF_INSTANCE_URL` | `https://login.salesforce.com` |
| `SF_CLIENT_ID` | Salesforce Connected App consumer key |
| `SF_CLIENT_SECRET` | Salesforce Connected App consumer secret |
| `SF_USERNAME` | Salesforce login email |
| `SF_PASSWORD` | Salesforce password + security token (concatenated) |
| `SF_SECURITY_TOKEN` | Salesforce security token |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `MCP_SERVER_URL` | `https://sf-cockpit-mcp.fly.dev/sse` |
| `MCP_API_KEY` | Secret key to protect the MCP server endpoint |

### mcp-server/.env (Fly.io secrets)

| Variable | Description |
|---|---|
| `SF_INSTANCE_URL` | `https://login.salesforce.com` |
| `SF_CLIENT_ID` | Salesforce Connected App consumer key |
| `SF_CLIENT_SECRET` | Salesforce Connected App consumer secret |
| `SF_USERNAME` | Salesforce login email |
| `SF_PASSWORD` | Salesforce password + security token (concatenated) |
| `MCP_API_KEY` | Must match the value set in Vercel |
| `PORT` | `8080` (set automatically by Fly.io) |

---

## Local Development

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
cd ../mcp-server && npm install
```

### 2. Set up server/.env

```env
SF_INSTANCE_URL=https://login.salesforce.com
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_USERNAME=your_email@example.com
SF_PASSWORD=yourpassword+securitytoken
ANTHROPIC_API_KEY=your_anthropic_key
MCP_SERVER_URL=http://localhost:8080/sse
MCP_API_KEY=any_local_key
```

### 3. Set up mcp-server/.env

```env
SF_INSTANCE_URL=https://login.salesforce.com
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_USERNAME=your_email@example.com
SF_PASSWORD=yourpassword+securitytoken
MCP_API_KEY=any_local_key
PORT=8080
```

### 4. Run all three services

Terminal 1 — MCP server:
```bash
cd mcp-server && node index.js
```

Terminal 2 — Express server:
```bash
cd server && node index.js
```

Terminal 3 — React client:
```bash
cd client && npm run dev
```

Open `http://localhost:5173`

---

## Deployment

### Fly.io (MCP Server)

**First-time setup:**
```bash
cd mcp-server
flyctl apps create --name sf-cockpit-mcp
flyctl secrets set SF_INSTANCE_URL=https://login.salesforce.com
flyctl secrets set SF_CLIENT_ID=xxx
flyctl secrets set SF_CLIENT_SECRET=xxx
flyctl secrets set SF_USERNAME=you@example.com
flyctl secrets set SF_PASSWORD=yourpassword+securitytoken
flyctl secrets set MCP_API_KEY=your_secret_key
flyctl deploy
flyctl scale count 1
```

**Subsequent deploys:**
```bash
cd mcp-server && flyctl deploy
```

**Useful commands:**
```bash
flyctl status --app sf-cockpit-mcp     # check running machines
flyctl logs --app sf-cockpit-mcp       # view logs
flyctl scale count 1 --app sf-cockpit-mcp  # ensure single machine
```

> **Important:** Always keep the machine count at 1. The MCP server stores SSE sessions in memory — multiple machines will cause "Session not found" errors.

---

### Vercel (React Client + Express API)

**First-time setup:**
1. Push repo to GitHub
2. Go to vercel.com → New Project → import from GitHub
3. Add all environment variables from the table above
4. Deploy

**Subsequent deploys:**
```bash
git add .
git commit -m "your message"
git push   # Vercel auto-deploys on push
```

---

## Claude Desktop Integration

To use the hosted MCP server with Claude Desktop, add this to:
`C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["mcp-remote", "https://sf-cockpit-mcp.fly.dev/sse?apiKey=YOUR_MCP_API_KEY"]
    }
  }
}
```

Replace `YOUR_MCP_API_KEY` with the key you set in Fly.io secrets. Restart Claude Desktop after saving.

---

## How AI Query Works (Step by Step)

1. User types a question in the AI Query tab
2. Browser sends the question to `POST /api/ai/ask` on Vercel
3. Express opens an SSE connection to the Fly.io MCP server
4. Express calls Claude API with the question and the 4 Salesforce tools
5. Claude decides which tools to call (e.g. `describe_object`, then `run_soql`)
6. Express calls each tool via the MCP SSE connection
7. Fly.io MCP server executes the tool against Salesforce REST API
8. Results flow back: Salesforce → MCP → Express → Claude
9. Claude writes a plain English answer based on the real data
10. Answer is returned to the browser

---

## GitHub Repository

```
https://github.com/arunmunirathinamsf-hub/SfServerMCP
```
