import { useEffect, useState } from 'react';

export default function SchemaExplorer() {
  const [objects, setObjects] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/schema/objects')
      .then(r => r.json())
      .then(d => {
        setObjects(d.objects || []);
        setLoading(false);
      });
  }, []);

  async function selectObject(obj) {
    setSelected(obj);
    setLoadingFields(true);
    const res = await fetch(`/api/schema/objects/${obj.name}`);
    const data = await res.json();
    setFields(data.fields || []);
    setLoadingFields(false);
  }

  const filtered = objects.filter(o =>
    o.name.toLowerCase().includes(filter.toLowerCase()) ||
    o.label.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Object list */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-stone-800">
          <input
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition"
            placeholder="Search objects…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center text-stone-500 text-sm mt-8">Loading…</p>
          ) : (
            filtered.map(obj => (
              <button
                key={obj.name}
                onClick={() => selectObject(obj)}
                className={`w-full text-left px-4 py-3 border-b border-stone-800 last:border-0 hover:bg-stone-800 transition ${
                  selected?.name === obj.name ? 'bg-amber-900/30 border-l-2 border-l-amber-500' : ''
                }`}
              >
                <p className={`text-sm font-medium ${obj.custom ? 'text-amber-300' : 'text-stone-200'}`}>
                  {obj.label}
                </p>
                <p className="text-xs text-stone-500 font-mono">{obj.name}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Field detail */}
      <div className="flex-1 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
            Select an object to see its fields
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-stone-800">
              <h3 className="text-stone-100 font-semibold">{selected.label}</h3>
              <p className="text-xs text-stone-400 font-mono">{selected.name}</p>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingFields ? (
                <p className="text-center text-stone-500 text-sm mt-8">Loading fields…</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-stone-900">
                    <tr className="border-b border-stone-800 text-stone-500 text-xs uppercase">
                      <th className="text-left px-5 py-3">Field</th>
                      <th className="text-left px-5 py-3">Label</th>
                      <th className="text-left px-5 py-3">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(f => (
                      <tr key={f.name} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/50">
                        <td className="px-5 py-3 font-mono text-xs text-amber-300">{f.name}</td>
                        <td className="px-5 py-3 text-stone-200">{f.label}</td>
                        <td className="px-5 py-3 text-stone-400">{f.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
