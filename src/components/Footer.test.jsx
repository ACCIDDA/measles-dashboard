import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer.jsx';

describe('Footer', () => {
  it('renders ACCIDDA attribution', () => {
    render(<Footer />);
    expect(screen.getByText('ACCIDDA')).toBeInTheDocument();
  });

  it('renders source links', () => {
    render(<Footer />);
    const ncLink = screen.getByText('NC DHHS');
    const cdcLink = screen.getByText('CDC VaxView');
    expect(ncLink).toHaveAttribute('href', expect.stringContaining('ncdhhs.gov'));
    expect(ncLink).toHaveAttribute('target', '_blank');
    expect(cdcLink).toHaveAttribute('href', expect.stringContaining('cdc.gov'));
    expect(cdcLink).toHaveAttribute('target', '_blank');
  });
});
