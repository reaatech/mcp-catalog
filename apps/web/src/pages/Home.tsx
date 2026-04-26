import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useServers, useHealthSummary } from '../hooks/useServers.js';
import { ServerCard } from '../components/ServerCard.js';

const StatCard: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className={`text-3xl font-bold ${color}`}>{value}</div>
    <div className="text-sm text-gray-600 mt-1">{label}</div>
  </div>
);

export const Home: React.FC = () => {
  const { servers, loading: serversLoading, error: serversError } = useServers({ limit: 5 });
  const { summary, loading: summaryLoading, error: summaryError } = useHealthSummary();

  useEffect(() => { document.title = 'MCP Catalog - Dashboard'; }, []);

  const loading = serversLoading || summaryLoading;
  const error = serversError || summaryError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/servers"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          View All Servers
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Servers" value={summary?.total ?? 0} color="text-blue-600" />
            <StatCard label="Healthy" value={summary?.healthy ?? 0} color="text-green-600" />
            <StatCard label="Unhealthy" value={summary?.unhealthy ?? 0} color="text-red-600" />
            <StatCard label="Unknown" value={summary?.unknown ?? 0} color="text-gray-600" />
          </div>

          {/* Recent Servers */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently Registered Servers</h2>
            {servers.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">No servers registered yet.</p>
                <Link to="/servers/new" className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2 inline-block">
                  Register your first server →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {servers.map(server => (
                  <ServerCard key={server.id} server={server} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
