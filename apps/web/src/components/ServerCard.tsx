import React from 'react';
import { Link } from 'react-router-dom';
import { HealthBadge } from './HealthBadge.js';
import type { Server } from '../types/server.js';

interface ServerCardProps {
  server: Server;
}

export const ServerCard: React.FC<ServerCardProps> = ({ server }) => {
  const hostname = (() => {
    try {
      const u = new URL(server.url);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname;
    } catch {}
    return '';
  })();

  const isSafeUrl = hostname !== '';

  const formattedDate = new Date(server.registeredAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link
              to={`/servers/${server.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {server.name}
            </Link>
            {server.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{server.description}</p>
            )}
          </div>
          <HealthBadge status={server.status} className="ml-2 flex-shrink-0" />
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3">
          {isSafeUrl ? (
            <a
              href={server.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {hostname}
            </a>
          ) : (
            <span className="text-sm text-gray-400">{server.url}</span>
          )}
        </div>

        {server.capabilities && server.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {server.capabilities.slice(0, 3).map(cap => (
              <span key={cap.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {cap.name}
              </span>
            ))}
            {server.capabilities.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                +{server.capabilities.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Registered {formattedDate}</span>
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
        <Link
          to={`/servers/${server.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
};
