import { useState } from 'react';

const EXAMPLES = [
  'Which restaurant has the most delivered orders?',
  'List restaurants with rating above 4',
  'Find all veg food items under 150 rupees',
  'Which delivery agents are on delivery right now?',
  'Show me all cancelled orders from last month',
  'What is the average order value per restaurant?',
  'Show me orders paid by UPI',
  'Which restaurants are temporarily closed?',
];

const TOOL_LABELS = {
  run_soql: 'Ran SOQL',
  describe_object: 'Checked schema',
  list_objects: 'Listed objects',
  get_org_limits: 'Checked org limits',
};

const TOOL_ICONS = {
  run_soql: '⚡',
  describe_object: '🔍',
  list_objects: '📋',
  get_org_limits: '📊',
};

function StepCard({ step, index }) {
  const [open, setOpen] = useState(false);
  const hasRecords = step.result?.records;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 transition text-left"
      >
        <span className="text-base">{TOOL_ICONS[step.tool] || '🔧'}</span>
        <span className="text-gray-300 font-medium">{TOOL_LABELS[step.tool] || step.tool}</span>
        {step.tool === 'run_soql' && (
          <span className="text-gray-500 font-mono text-xs truncate max-w-xs">{step.input.query}</span>
        )}
        {step.tool === 'describe_object' && (
          <span className="text-blue-400 font-mono text-xs">{step.input.object_name}</span>
        )}
        {step.error && <span className="ml-auto text-red-400 text-xs">error</span>}
        {hasRecords && (
          <span className="ml-auto text-gray-500 text-xs">{step.result.totalSize} records</span>
        )}
        <span className="ml-auto text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 bg-gray-950 px-4 py-3">
          {step.error ? (
            <p className="text-red-400 text-xs">{step.error}</p>
          ) : hasRecords && step.result.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    {Object.keys(step.result.records[0]).map(col => (
                      <th key={col} className="text-left py-1 pr-4 font-normal">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step.result.records.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-gray-800 last:border-0">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="py-1 pr-4 text-gray-300">
                          {val === null || val === undefined ? '—' : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {step.result.records.length > 5 && (
                    <tr>
                      <td colSpan={99} className="py-1 text-gray-600 italic">
                        +{step.result.records.length - 5} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="text-gray-400 text-xs whitespace-pre-wrap">
              {JSON.stringify(step.result ?? step.input, null, 2).slice(0, 600)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function QueryRunner() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState('');

  async function ask() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setAnswer('');
    setSteps([]);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnswer(data.answer);
      setSteps(data.steps || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">AI Query Runner</h2>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            onClick={() => setPrompt(ex)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
          placeholder="Ask anything about your Salesforce data…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
        />
        <button
          onClick={ask}
          disabled={loading || !prompt.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-5 py-3 rounded-lg transition min-w-[80px]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Thinking
            </span>
          ) : 'Ask →'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-950 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Claude took {steps.length} step{steps.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="bg-gray-900 border border-blue-800 rounded-xl px-5 py-4">
          <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">Answer</p>
          <p className="text-white leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}
    </div>
  );
}
