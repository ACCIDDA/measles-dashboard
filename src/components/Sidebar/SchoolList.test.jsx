import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchoolList from './SchoolList.jsx';

const mockSchools = [
  { name: 'Alpha Elementary', coverage: 96.5, tier: 'H' },
  { name: 'Beta Middle', coverage: 91.2, tier: 'M' },
  { name: 'Gamma Academy', coverage: 85.0, tier: 'L' },
];

describe('SchoolList', () => {
  it('renders all schools when no search query', () => {
    render(<SchoolList schools={mockSchools} selectedSchool={null} onSchoolSelect={() => {}} />);
    expect(screen.getByText('Alpha Elementary')).toBeInTheDocument();
    expect(screen.getByText('Beta Middle')).toBeInTheDocument();
    expect(screen.getByText('Gamma Academy')).toBeInTheDocument();
  });

  it('shows school count label', () => {
    render(<SchoolList schools={mockSchools} selectedSchool={null} onSchoolSelect={() => {}} />);
    expect(screen.getByText('3 schools (A–Z)')).toBeInTheDocument();
  });

  it('filters schools by search input', async () => {
    const user = userEvent.setup();
    render(<SchoolList schools={mockSchools} selectedSchool={null} onSchoolSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText('Search schools…'), 'Alpha');
    expect(screen.getByText('Alpha Elementary')).toBeInTheDocument();
    expect(screen.queryByText('Beta Middle')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('shows no results message', async () => {
    const user = userEvent.setup();
    render(<SchoolList schools={mockSchools} selectedSchool={null} onSchoolSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText('Search schools…'), 'zzzzz');
    expect(screen.getByText('No schools match')).toBeInTheDocument();
  });

  it('marks active school', () => {
    render(<SchoolList schools={mockSchools} selectedSchool={mockSchools[0]} onSchoolSelect={() => {}} />);
    const option = screen.getByRole('option', { name: /Alpha Elementary/i });
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onSchoolSelect on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SchoolList schools={mockSchools} selectedSchool={null} onSchoolSelect={onSelect} />);
    await user.click(screen.getByText('Alpha Elementary'));
    expect(onSelect).toHaveBeenCalledWith(mockSchools[0]);
  });

  it('toggles off when clicking active school', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SchoolList schools={mockSchools} selectedSchool={mockSchools[0]} onSchoolSelect={onSelect} />);
    await user.click(screen.getByText('Alpha Elementary'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
