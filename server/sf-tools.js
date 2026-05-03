async function sfGet(url, sf) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${sf.access_token}` } });
  return res.json();
}

async function runSoql(query, sf) {
  const res = await fetch(
    `${sf.instance_url}/services/data/v60.0/query?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${sf.access_token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data[0]?.message || 'SOQL query failed');
  const records = data.records.map(({ attributes, ...rest }) => rest);
  return { totalSize: data.totalSize, records };
}

async function listObjects(sf) {
  const data = await sfGet(`${sf.instance_url}/services/data/v60.0/sobjects`, sf);
  return data.sobjects
    .filter(o => o.queryable)
    .map(o => ({ name: o.name, label: o.label, custom: o.custom }));
}

async function describeObject(objectName, sf) {
  const data = await sfGet(
    `${sf.instance_url}/services/data/v60.0/sobjects/${objectName}/describe`,
    sf
  );
  return {
    name: data.name,
    label: data.label,
    fields: data.fields.map(f => ({ name: f.name, label: f.label, type: f.type })),
  };
}

async function getOrgLimits(sf) {
  return sfGet(`${sf.instance_url}/services/data/v60.0/limits`, sf);
}

const SF_TOOL_DEFINITIONS = [
  {
    name: 'run_soql',
    description: 'Run a SOQL query against Salesforce and return the records. Use this to answer data questions.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A valid SOQL query string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'describe_object',
    description: 'Get all field names and types for a Salesforce object. Use this before writing a query to confirm exact field API names.',
    input_schema: {
      type: 'object',
      properties: {
        object_name: { type: 'string', description: 'The API name of the object e.g. Restaurant__c' },
      },
      required: ['object_name'],
    },
  },
  {
    name: 'list_objects',
    description: 'List all queryable SObjects in the org. Use this if you are unsure which object to query.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_org_limits',
    description: 'Get current API usage and org limits.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

async function executeTool(name, input, sf) {
  if (name === 'run_soql') return runSoql(input.query, sf);
  if (name === 'describe_object') return describeObject(input.object_name, sf);
  if (name === 'list_objects') return listObjects(sf);
  if (name === 'get_org_limits') return getOrgLimits(sf);
  throw new Error(`Unknown tool: ${name}`);
}

module.exports = { SF_TOOL_DEFINITIONS, executeTool };
