import React from 'react';

interface HealthBadgeProps {
  status: 'healthy' | 'unhealthy' | 'unknown';
  showLabel?: boolean;
  className?: string;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ status, showLabel = true, className = '' }) => {
  const config = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Healthy' },
    unhealthy: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Unhealthy' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500', label: 'Unknown' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {showLabel && config.label}
    </span>
  );
};
