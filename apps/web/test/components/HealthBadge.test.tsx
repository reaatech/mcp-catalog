import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBadge } from '../../src/components/HealthBadge.js';

describe('HealthBadge', () => {
  it('renders healthy status', () => {
    render(<HealthBadge status="healthy" />);
    const el = screen.getByText('Healthy');
    expect(el).toBeDefined();
    expect(el.className).toContain('green');
  });

  it('renders unhealthy status', () => {
    render(<HealthBadge status="unhealthy" />);
    const el = screen.getByText('Unhealthy');
    expect(el).toBeDefined();
    expect(el.className).toContain('red');
  });

  it('renders unknown status', () => {
    render(<HealthBadge status="unknown" />);
    const el = screen.getByText('Unknown');
    expect(el).toBeDefined();
    expect(el.className).toContain('gray');
  });
});
