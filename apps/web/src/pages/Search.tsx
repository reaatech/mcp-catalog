import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ServerCard } from '../components/ServerCard.js';
import type { Server, Capability } from '../types/server.js';

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<{ servers: Server[]; capabilities: Capability[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (q: string) => {
    if (!q.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.search({ q });
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { document.title = 'MCP Catalog - Search'; }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Search</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search servers, capabilities, tools..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-8">
          {/* Servers */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Servers ({results.servers.length})
            </h2>
            {results.servers.length === 0 ? (
              <p className="text-gray-500">No servers found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.servers.map(server => (
                  <ServerCard key={server.id} server={server} />
                ))}
              </div>
            )}
          </div>

          {/* Capabilities */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Capabilities ({results.capabilities.length})
            </h2>
            {results.capabilities.length === 0 ? (
              <p className="text-gray-500">No capabilities found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.capabilities.map(cap => (
                  <div key={cap.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};
