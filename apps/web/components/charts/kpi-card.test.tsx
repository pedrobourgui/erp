import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { KPICard } from './kpi-card';

// Mock recharts to avoid issues with ResponsiveContainer in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  AreaChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Area: () => React.createElement('div', { 'data-testid': 'area' }),
}));

describe('KPICard', () => {
  it('should display label and value', () => {
    render(<KPICard label="Revenue" value={50000} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('50000')).toBeInTheDocument();
  });

  it('should display formattedValue when provided', () => {
    render(
      <KPICard label="Revenue" value={50000} formattedValue="R$ 50.000,00" />
    );

    expect(screen.getByText('R$ 50.000,00')).toBeInTheDocument();
    // Should use formattedValue instead of raw value
    expect(screen.queryByText('50000')).not.toBeInTheDocument();
  });

  it('should display string value', () => {
    render(<KPICard label="Orders" value="120" />);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('should show positive trend with + sign', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        trend={{ value: 12.5 }}
      />
    );

    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('should show negative trend without + sign', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        trend={{ value: -5.3 }}
      />
    );

    expect(screen.getByText('-5.3%')).toBeInTheDocument();
  });

  it('should show zero trend as positive', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        trend={{ value: 0 }}
      />
    );

    expect(screen.getByText('+0.0%')).toBeInTheDocument();
  });

  it('should display trend label when provided', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        trend={{ value: 12.5, label: 'vs last month' }}
      />
    );

    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('should not render trend section when trend is undefined', () => {
    render(<KPICard label="Revenue" value={50000} />);

    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('should render sparkline when sparklineData has more than 1 point', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        sparklineData={[100, 200, 300, 400]}
      />
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('should not render sparkline when sparklineData has 1 or fewer points', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        sparklineData={[100]}
      />
    );

    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('should not render sparkline when sparklineData is undefined', () => {
    render(<KPICard label="Revenue" value={50000} />);

    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(
      <KPICard
        label="Revenue"
        value={50000}
        icon={React.createElement('span', { 'data-testid': 'custom-icon' }, '$')}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should accept additional className', () => {
    const { container } = render(
      <KPICard label="Revenue" value={50000} className="custom-class" />
    );

    // The Card component is the root element
    const card = container.firstChild;
    expect((card as HTMLElement)?.className).toContain('custom-class');
  });
});
