import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function StepCard({ step }) {
  const [open, setOpen] = useState(false);
  const hasRecords = step.result?.records;

  return (
    <div className="border border-stone-800 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 transition text-left"
      >
        <span className="text-base">{TOOL_ICONS[step.tool] || '🔧'}</span>
        <span className="text-stone-300 font-medium">{TOOL_LABELS[step.tool] || step.tool}</span>
        {step.tool === 'run_soql' && (
          <span className="text-stone-500 font-mono text-xs truncate max-w-xs">{step.input.query}</span>
        )}
        {step.tool === 'describe_object' && (
          <span className="text-amber-400 font-mono text-xs">{step.input.object_name}</span>
        )}
        {step.error && <span className="ml-auto text-red-400 text-xs">error</span>}
        {hasRecords && (
          <span className="ml-auto text-stone-500 text-xs">{step.result.totalSize} records</span>
        )}
        <span className="ml-auto text-stone-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-stone-800 bg-stone-950 px-4 py-3">
          {step.error ? (
            <p className="text-red-400 text-xs">{step.error}</p>
          ) : hasRecords && step.result.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-500 border-b border-stone-800">
                    {Object.keys(step.result.records[0]).map(col => (
                      <th key={col} className="text-left py-1 pr-4 font-normal">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step.result.records.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-stone-800 last:border-0">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="py-1 pr-4 text-stone-300">
                          {val === null || val === undefined ? '—' : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {step.result.records.length > 5 && (
                    <tr>
                      <td colSpan={99} className="py-1 text-stone-600 italic">
                        +{step.result.records.length - 5} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="text-stone-400 text-xs whitespace-pre-wrap">
              {JSON.stringify(step.result ?? step.input, null, 2).slice(0, 600)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const mdComponents = {
  h1: ({ children }) => <h1 className="text-xl font-bold text-stone-100 mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-stone-100 mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-stone-200 mt-3 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-stone-200 leading-relaxed mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-amber-200">{children}</strong>,
  em: ({ children }) => <em className="italic text-stone-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-stone-200">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-stone-200">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ inline, children }) =>
    inline
      ? <code className="bg-stone-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
      : <code className="block bg-stone-950 border border-stone-800 text-amber-200 px-4 py-3 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto mb-3">{children}</code>,
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-700 pl-4 italic text-stone-400 mb-3">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm border border-stone-800 rounded-lg overflow-hidden">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-stone-800 text-stone-400 text-xs uppercase">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-stone-800 last:border-0">{children}</tr>,
  th: ({ children }) => <th className="text-left px-4 py-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 text-stone-300">{children}</td>,
  hr: () => <hr className="border-stone-800 my-4" />,
};

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
      <h2 className="text-lg font-semibold text-stone-100 mb-4">AI Query Runner</h2>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            onClick={() => setPrompt(ex)}
            className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-full transition"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition"
          placeholder="Ask anything about your Salesforce data…"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
        />
        <button
          onClick={ask}
          disabled={loading || !prompt.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold px-5 py-3 rounded-lg transition min-w-[80px]"
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
        <div className="mb-4 bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-stone-500 uppercase tracking-wider mb-2">
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
        <div className="bg-stone-900 border border-amber-900/60 rounded-xl px-6 py-5">
          <p className="text-xs text-amber-500 uppercase tracking-wider mb-3 font-medium">Answer</p>
          <div className="prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {answer}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
