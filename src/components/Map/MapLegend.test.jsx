import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapLegend from './MapLegend.jsx';

describe('MapLegend', () => {
  it('renders coverage view legend', () => {
    render(<MapLegend currentView="coverage" />);
    expect(screen.getByText('Coverage Level')).toBeInTheDocument();
    expect(screen.getByText('High ≥95%')).toBeInTheDocument();
    expect(screen.getByText('Medium 90–95%')).toBeInTheDocument();
    expect(screen.getByText('Low <90%')).toBeInTheDocument();
  });

  it('renders undervax view legend', () => {
    render(<MapLegend currentView="undervax" />);
    expect(screen.getByText('% Schools Below 95%')).toBeInTheDocument();
    expect(screen.getByText('Low risk (<20%)')).toBeInTheDocument();
    expect(screen.getByText('Medium (20–40%)')).toBeInTheDocument();
    expect(screen.getByText('High risk (>40%)')).toBeInTheDocument();
  });

  it('renders source attribution links', () => {
    render(<MapLegend currentView="coverage" />);
    expect(screen.getByText('NC DHHS')).toHaveAttribute('href', expect.stringContaining('ncdhhs.gov'));
    expect(screen.getByText('CDC VaxView')).toHaveAttribute('href', expect.stringContaining('cdc.gov'));
  });
});
