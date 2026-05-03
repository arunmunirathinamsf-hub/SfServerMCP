import { useState } from 'react';
import OrgHealth from './components/OrgHealth';
import QueryRunner from './components/QueryRunner';
import SchemaExplorer from './components/SchemaExplorer';

const TABS = ['Org Health', 'AI Query', 'Schema'];

export default function App() {
  const [org, setOrg] = useState(null);
  const [connecting, setConnecting] = useState(false);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">SF Dev Cockpit</h1>
          {org && (
            <p className="text-xs text-gray-400 mt-1 truncate max-w-md">
              {org.instance}
            </p>
          )}
        </div>
        {!org ? (
          <button
            onClick={connect}
            disabled={connecting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition"
          >
            {connecting ? 'Connecting…' : 'Connect to Salesforce'}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Connected
            </span>
            <button
              onClick={disconnect}
              className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded-lg transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-950 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm space-y-1">
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
        <div className="text-center text-gray-500 mt-20">
          <p className="text-lg">Connect to your Salesforce org to get started.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-800">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                  tab === t
                    ? 'bg-gray-800 text-white border border-b-0 border-gray-700'
                    : 'text-gray-400 hover:text-white'
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
