import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header.jsx';

const defaultProps = {
  currentView: 'coverage',
  onViewChange: () => {},
  ncFeatures: [],
  countyData: {},
  onCountySelect: () => {},
};

describe('Header', () => {
  it('renders title', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('NC Measles (MMR) Coverage')).toBeInTheDocument();
  });

  it('renders ACCIDDA logo', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByAltText('ACCIDDA')).toBeInTheDocument();
  });

  it('shows Coverage button as active by default', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('Coverage')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Below 95%')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onViewChange when clicking Below 95%', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(<Header {...defaultProps} onViewChange={onViewChange} />);
    await user.click(screen.getByText('Below 95%'));
    expect(onViewChange).toHaveBeenCalledWith('undervax');
  });

  it('calls onViewChange when clicking Coverage', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(<Header {...defaultProps} currentView="undervax" onViewChange={onViewChange} />);
    await user.click(screen.getByText('Coverage'));
    expect(onViewChange).toHaveBeenCalledWith('coverage');
  });

  it('renders search inputs', () => {
    render(<Header {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText('Search NC counties…');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});
