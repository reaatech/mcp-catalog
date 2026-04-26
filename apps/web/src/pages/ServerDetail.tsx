import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useServer } from '../hooks/useServers.js';
import { HealthBadge } from '../components/HealthBadge.js';

export const ServerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { server, loading, error } = useServer(id || '');

  if (!id) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Invalid server ID
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading server details...</div>
      </div>
    );
  }

  useEffect(() => {
    if (server) document.title = `MCP Catalog - ${server.name}`;
    else document.title = 'MCP Catalog - Server';
  }, [server]);

  if (error || !server) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error || 'Server not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/servers" className="hover:text-blue-600">Servers</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{server.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{server.name}</h1>
            {server.description && (
              <p className="mt-2 text-gray-600">{server.description}</p>
            )}
          </div>
          <HealthBadge status={server.status} />
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-500">URL</span>
            {/^https?:\/\//i.test(server.url) ? (
              <a
                href={server.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-blue-600 hover:text-blue-800"
              >
                {server.url}
              </a>
            ) : (
              <p className="mt-1 text-gray-900">{server.url}</p>
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Health Check Interval</span>
            <p className="mt-1 text-gray-900">{server.healthCheckInterval} seconds</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Registered</span>
            <p className="mt-1 text-gray-900">
              {new Date(server.registeredAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Last Health Check</span>
            <p className="mt-1 text-gray-900">
              {server.lastHealthCheck
                ? new Date(server.lastHealthCheck).toLocaleString()
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {server.capabilities && server.capabilities.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Capabilities ({server.capabilities.length})
          </h2>
          <div className="space-y-4">
            {server.capabilities.map(cap => (
              <div key={cap.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{cap.name}</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {cap.category}
                  </span>
                </div>
                {cap.description && (
                  <p className="mt-1 text-sm text-gray-600">{cap.description}</p>
                )}
                {cap.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cap.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {server.metadata && Object.keys(server.metadata).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
          <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 overflow-auto">
            {JSON.stringify(server.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
