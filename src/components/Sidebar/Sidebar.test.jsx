import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar.jsx';

const mockSchools = [
  { name: 'High School', coverage: 97, tier: 'H', grades: { estimated: [97, 96, 98, 97, 96, 95], reported: [97, 96, 98, 97, 96, 95] } },
  { name: 'Low School', coverage: 88, tier: 'L', grades: { estimated: [88, 87, 89, 86, 90, 85], reported: [88, 87, 89, 86, 90, 85] } },
];

const defaultProps = {
  county: 'Wake County',
  countyData: {},
  schools: mockSchools,
  selectedSchool: null,
  onSchoolSelect: () => {},
  onBack: () => {},
  onCloseSchool: () => {},
  isOpen: true,
};

describe('Sidebar', () => {
  it('has open class when isOpen is true', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    expect(container.querySelector('#sidebar')).toHaveClass('open');
  });

  it('does not have open class when isOpen is false', () => {
    const { container } = render(<Sidebar {...defaultProps} isOpen={false} />);
    expect(container.querySelector('#sidebar')).not.toHaveClass('open');
  });

  it('shows county name', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Wake County')).toBeInTheDocument();
  });

  it('displays avg coverage', () => {
    render(<Sidebar {...defaultProps} />);
    // (97 + 88) / 2 = 92.5
    expect(screen.getByText('92.5%')).toBeInTheDocument();
  });

  it('displays below 95% percentage', () => {
    render(<Sidebar {...defaultProps} />);
    // 1 of 2 schools below 95 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('displays school count', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows em-dash when no schools', () => {
    render(<Sidebar {...defaultProps} schools={[]} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(3);
  });

  it('calls onBack when back button clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Sidebar {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Return to all counties' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders SchoolDetail when selectedSchool is set', () => {
    render(<Sidebar {...defaultProps} selectedSchool={mockSchools[0]} />);
    expect(screen.getByText('Overall Coverage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close school detail' })).toBeInTheDocument();
  });
});
