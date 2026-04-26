import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import type { Server, PaginatedResponse, HealthSummary } from '../types/server.js';

export function useServers(options: { status?: string; search?: string; limit?: number; offset?: number } = {}) {
  const { status, search, limit = 20, offset = 0 } = options;
  const [servers, setServers] = useState<Server[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Server>['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.listServers({ status, search, limit, offset });
      setServers(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  }, [status, search, limit, offset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchServers();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchServers, search]);

  return { servers, pagination, loading, error, refresh: fetchServers };
}

export function useServer(id: string) {
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getServer(id)
      .then(data => { if (!cancelled) setServer(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch server'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { server, loading, error };
}

export function useHealthSummary() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getHealthSummary()
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch health summary'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { summary, loading, error };
}
