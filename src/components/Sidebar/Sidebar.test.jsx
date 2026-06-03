import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar.jsx';

const mockSchools = [
  { name: 'High School', coverage: 97, tier: 'H', grades: [97, 96, 98, 97, 96, 95] },
  { name: 'Low School', coverage: 88, tier: 'L', grades: [88, 87, 89, 86, 90, 85] },
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
    // SchoolDetail renders its own 'Avg. Coverage' label, distinct from the
    // identically-worded county-stats label above — assert both are present.
    expect(screen.getAllByText('Avg. Coverage')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Close school detail' })).toBeInTheDocument();
  });

  // ── Per-grade breakdown panel (#50) ──
  it('shows the county per-grade breakdown when the county has grades', () => {
    const countyData = { 'Wake County': { grades: [94, 95, 96, 93, 97, 92] } };
    const { container } = render(<Sidebar {...defaultProps} countyData={countyData} />);
    expect(screen.getByText('Coverage by grade')).toBeInTheDocument();
    expect(container.querySelectorAll('#sb-county-grades .sd-grade-row')).toHaveLength(6);
  });

  it('hides the breakdown for a county with no per-grade data (e.g. NC)', () => {
    const countyData = { 'Wake County': { grades: [null, null, null, null, null, null] } };
    render(<Sidebar {...defaultProps} countyData={countyData} />);
    expect(screen.queryByText('Coverage by grade')).not.toBeInTheDocument();
  });

  describe('state-summary mode (no county focused)', () => {
    const stateSummary = {
      name: 'California', coverage: 97.9, pctBelow95: 17, nSchools: 7877,
      grades: [95.6, 98, 98.4, 98.5, 98.5, 98.4],
    };
    const stateProps = {
      ...defaultProps, county: null, schools: [], stateSummary,
    };

    it('renders the state name, stats, and per-grade breakdown', () => {
      const { container } = render(<Sidebar {...stateProps} />);
      expect(screen.getByText('California')).toBeInTheDocument();
      expect(screen.getByText('97.9%')).toBeInTheDocument();
      expect(screen.getByText('17%')).toBeInTheDocument();
      expect(screen.getByText('7877')).toBeInTheDocument();
      expect(container.querySelectorAll('#sb-state-grades .sd-grade-row')).toHaveLength(6);
    });

    it('does not render the school list and uses the national back label', () => {
      const { container } = render(<Sidebar {...stateProps} />);
      expect(container.querySelector('#sb-school-list')).toBeNull();
      expect(screen.getByRole('button', { name: 'Return to national map' })).toBeInTheDocument();
    });
  });
});
