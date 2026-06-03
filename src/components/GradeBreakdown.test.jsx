import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GradeBreakdown from './GradeBreakdown.jsx';

describe('GradeBreakdown (#50)', () => {
  it('renders all 6 grade rows with percentages', () => {
    const { container } = render(<GradeBreakdown values={[95, 96, 97, 94, 98, 93]} />);
    expect(container.querySelectorAll('.sd-grade-row')).toHaveLength(6);
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('93.0%')).toBeInTheDocument();
  });

  it('shows N/A for null grades but still renders the row', () => {
    const { container } = render(<GradeBreakdown values={[null, 95, 96, 97, 98, 93]} />);
    expect(container.querySelectorAll('.sd-grade-row')).toHaveLength(6);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders nothing when every value is null (e.g. NC counties)', () => {
    const { container } = render(<GradeBreakdown values={[null, null, null, null, null, null]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when values is missing', () => {
    const { container } = render(<GradeBreakdown values={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
