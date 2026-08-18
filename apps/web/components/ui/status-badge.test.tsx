import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('should render the label for a known status', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('should render correct labels for various known statuses', () => {
    const statuses = [
      { status: 'CONFIRMED', label: 'Confirmado' },
      { status: 'PICKING', label: 'Separando' },
      { status: 'SHIPPED', label: 'Enviado' },
      { status: 'DELIVERED', label: 'Entregue' },
      { status: 'COMPLETED', label: 'Concluído' },
      { status: 'CANCELLED', label: 'Cancelado' },
      { status: 'ACTIVE', label: 'Ativo' },
      { status: 'INACTIVE', label: 'Inativo' },
      { status: 'DRAFT', label: 'Rascunho' },
      { status: 'DISCONTINUED', label: 'Descontinuado' },
    ];

    for (const { status, label } of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('should use the raw status string for unknown statuses', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });

  it('should use custom label when provided', () => {
    render(<StatusBadge status="PENDING" label="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument();
  });

  it('should render with sm size by default', () => {
    const { container } = render(<StatusBadge status="ACTIVE" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-xs');
    expect(badge?.className).toContain('px-2');
  });

  it('should render with md size', () => {
    const { container } = render(<StatusBadge status="ACTIVE" size="md" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-sm');
    expect(badge?.className).toContain('px-3');
  });

  it('should accept additional className', () => {
    const { container } = render(
      <StatusBadge status="ACTIVE" className="extra-class" />
    );
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('extra-class');
  });

  it('should render the status dot indicator', () => {
    const { container } = render(<StatusBadge status="PENDING" />);
    const dot = container.querySelector('span > span');
    expect(dot?.className).toContain('rounded-full');
    expect(dot?.className).toContain('bg-current');
  });
});
