const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI assistant with live access to a Salesforce org via tools.

The org is a food delivery app with custom objects: Restaurant__c, Food_Item__c, Food_Order__c, Delivery_Agent__c.

When the user asks a data question:
1. Use describe_object to confirm exact field API names before writing a query
2. Use run_soql to fetch real data
3. Answer in plain, clear English — include key numbers and names from the results
4. If a query fails, read the error and fix the query

Never guess field names. Always verify with describe_object first.`;

// Spawn a fresh MCP client + server subprocess per request.
// The active SF session is passed to the subprocess via env vars.
async function withMCPClient(sf, fn) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../../mcp-server/index.js')],
    env: {
      ...process.env,
      SF_ACCESS_TOKEN: sf.access_token,
      SF_ACTIVE_INSTANCE_URL: sf.instance_url,
    },
  });

  const mcpClient = new Client(
    { name: 'sf-dev-cockpit-web', version: '1.0.0' },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);

  try {
    return await fn(mcpClient);
  } finally {
    await mcpClient.close();
  }
}

// POST /api/ai/ask — agentic loop via MCP
router.post('/ask', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  try {
    const result = await withMCPClient(req.sf, async (mcpClient) => {
      // Pull tool definitions live from the MCP server
      const { tools: mcpTools } = await mcpClient.listTools();

      // MCP inputSchema → Claude input_schema
      const claudeTools = mcpTools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));

      const messages = [{ role: 'user', content: prompt }];
      const steps = [];
      let finalAnswer = '';

      for (let turn = 0; turn < 10; turn++) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: claudeTools,
          messages,
        });

        messages.push({ role: 'assistant', content: response.content });

        if (response.stop_reason === 'end_turn') {
          finalAnswer = response.content.find(b => b.type === 'text')?.text || '';
          break;
        }

        if (response.stop_reason === 'tool_use') {
          const toolResults = [];

          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;

            const step = { tool: block.name, input: block.input };

            try {
              // Execute tool via MCP protocol
              const mcpResult = await mcpClient.callTool({
                name: block.name,
                arguments: block.input,
              });

              const text = mcpResult.content[0]?.text || '{}';
              step.result = JSON.parse(text);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: text,
              });
            } catch (e) {
              step.error = e.message;
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${e.message}`,
                is_error: true,
              });
            }

            steps.push(step);
          }

          messages.push({ role: 'user', content: toolResults });
        }
      }

      return { answer: finalAnswer, steps };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keep /to-soql for schema explorer auto-query
router.post('/to-soql', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: 'Convert the user question to a SOQL query. Return ONLY the raw SOQL, no explanation, no markdown. Always include LIMIT.',
      messages: [{ role: 'user', content: prompt }],
    });
    res.json({ soql: message.content[0].text.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
