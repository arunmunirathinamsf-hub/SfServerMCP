import { useEffect, useState } from 'react';

function MetricCard({ label, used, max, unit = '' }) {
  const pct = max ? Math.round((used / max) * 100) : null;
  const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
      <p className="text-xs text-stone-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-stone-100">
        {used?.toLocaleString()}{unit}
        {max ? <span className="text-sm text-stone-500 font-normal"> / {max.toLocaleString()}</span> : null}
      </p>
      {pct !== null && (
        <div className="mt-3 h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 h-28 animate-pulse" />;
}

export default function OrgHealth() {
  const [limits, setLimits] = useState(null);
  const [users, setUsers] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/org/limits').then(r => r.json()),
      fetch('/api/org/users').then(r => r.json()),
      fetch('/api/org/apex-jobs').then(r => r.json()),
    ]).then(([l, u, j]) => {
      setLimits(l);
      setUsers(u);
      setJobs(j);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-100 mb-4">Org Health</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {loading ? (
          Array(6).fill(0).map((_, i) => <Skeleton key={i} />)
        ) : (
          <>
            <MetricCard
              label="Daily API Requests"
              used={limits?.DailyApiRequests?.Remaining}
              max={limits?.DailyApiRequests?.Max}
            />
            <MetricCard
              label="Data Storage (MB)"
              used={limits?.DataStorageMB?.Remaining}
              max={limits?.DataStorageMB?.Max}
            />
            <MetricCard
              label="File Storage (MB)"
              used={limits?.FileStorageMB?.Remaining}
              max={limits?.FileStorageMB?.Max}
            />
            <MetricCard
              label="Active Users"
              used={users?.totalSize}
            />
            <MetricCard
              label="Async Apex Jobs"
              used={jobs?.totalSize}
            />
            <MetricCard
              label="Mass Email"
              used={limits?.MassEmail?.Remaining}
              max={limits?.MassEmail?.Max}
            />
          </>
        )}
      </div>

      {/* Recent Apex Jobs */}
      {!loading && jobs?.records?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-300 mb-3">Recent Apex Jobs</h3>
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.records.map(j => (
                  <tr key={j.Id} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-stone-400">{j.Id.slice(0, 15)}…</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        j.Status === 'Completed' ? 'bg-green-900 text-green-300' :
                        j.Status === 'Failed' ? 'bg-red-900 text-red-300' :
                        'bg-yellow-900 text-yellow-300'
                      }`}>{j.Status}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-300">{j.JobType}</td>
                    <td className="px-4 py-3 text-stone-400">{new Date(j.CreatedDate).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
