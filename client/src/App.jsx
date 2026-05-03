import { useState, useEffect } from 'react';
import OrgHealth from './components/OrgHealth';
import QueryRunner from './components/QueryRunner';
import SchemaExplorer from './components/SchemaExplorer';

const TABS = ['Org Health', 'AI Query', 'Schema'];

export default function App() {
  const [org, setOrg] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Org Health');

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error, code: data.sf_error, hint: data.hint });
        return;
      }
      setOrg(data);
    } catch (e) {
      setError({ message: e.message });
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch('/api/auth/disconnect', { method: 'POST' });
    setOrg(null);
  }

  useEffect(() => {
    connect();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">SF Dev Cockpit</h1>
          {org && (
            <p className="text-xs text-stone-500 mt-1 truncate max-w-md">
              {org.instance}
            </p>
          )}
        </div>
        {!org ? (
          <div className="flex items-center gap-3">
            {connecting ? (
              <span className="flex items-center gap-2 text-sm text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                Connecting…
              </span>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                Retry Connection
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Connected
            </span>
            <button
              onClick={disconnect}
              className="text-sm text-stone-400 hover:text-stone-100 border border-stone-700 px-3 py-1 rounded-lg transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm space-y-1">
          <p className="font-semibold">
            Connection failed{error.code ? ` — ${error.code}` : ''}
          </p>
          <p>{error.message}</p>
          {error.hint && (
            <p className="text-red-400 mt-1">Fix: {error.hint}</p>
          )}
        </div>
      )}

      {!org ? (
        <div className="text-center text-stone-500 mt-20">
          {connecting ? (
            <p className="text-lg">Connecting to Salesforce…</p>
          ) : (
            <p className="text-lg">Could not connect. Check your credentials and retry.</p>
          )}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-stone-800">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                  tab === t
                    ? 'bg-stone-800 text-stone-100 border border-b-0 border-stone-700'
                    : 'text-stone-500 hover:text-stone-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Org Health' && <OrgHealth />}
          {tab === 'AI Query' && <QueryRunner />}
          {tab === 'Schema' && <SchemaExplorer />}
        </>
      )}
    </div>
  );
}
