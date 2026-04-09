import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchoolDetail from './SchoolDetail.jsx';

const mockSchool = {
  name: 'Test Elementary',
  coverage: 96.5,
  tier: 'H',
  size: 300,
  grades: {
    estimated: [96, 95, 97, 94, 98, 93],
    reported: [null, 95, 97, 94, 98, 93],
  },
};

describe('SchoolDetail', () => {
  it('returns null when school is null', () => {
    const { container } = render(<SchoolDetail school={null} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders school name', () => {
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    expect(screen.getByText('Test Elementary')).toBeInTheDocument();
  });

  it('shows Estimated tab active by default', () => {
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Estimated' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Reported tab on click', async () => {
    const user = userEvent.setup();
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Reported' }));
    expect(screen.getByRole('tab', { name: 'Reported' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Estimated' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders all 6 grade rows', () => {
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
  });

  it('shows N/A for null grade values in reported mode', async () => {
    const user = userEvent.setup();
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Reported' }));
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('displays overall coverage percentage', () => {
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    expect(screen.getByText('Overall Coverage')).toBeInTheDocument();
  });

  it('displays tier badge', () => {
    render(<SchoolDetail school={mockSchool} onClose={() => {}} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SchoolDetail school={mockSchool} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close school detail' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
