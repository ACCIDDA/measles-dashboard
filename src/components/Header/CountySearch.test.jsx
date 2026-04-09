import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CountySearch from './CountySearch.jsx';

const mockFeatures = [
  { id: '37001', properties: { name: 'Alamance' } },
  { id: '37025', properties: { name: 'Cabarrus' } },
  { id: '37063', properties: { name: 'Durham' } },
  { id: '37183', properties: { name: 'Wake' } },
];

const mockCountyData = {
  'Alamance County': { mean: 96.7 },
  'Cabarrus County': { mean: 91.2 },
  'Durham County': { mean: 88.3 },
  'Wake County': { mean: 94.0 },
};

const defaultProps = {
  ncFeatures: mockFeatures,
  countyData: mockCountyData,
  onSelect: () => {},
  inputId: 'test-search',
  dropdownId: 'test-dropdown',
  placeholder: 'Search NC counties…',
};

describe('CountySearch', () => {
  it('renders search input with placeholder', () => {
    render(<CountySearch {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search NC counties…')).toBeInTheDocument();
  });

  it('shows no dropdown when query is empty', () => {
    render(<CountySearch {...defaultProps} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters counties by query', async () => {
    const user = userEvent.setup();
    render(<CountySearch {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search NC counties…'), 'Dur');
    expect(screen.getByText('Durham County')).toBeInTheDocument();
    expect(screen.queryByText('Wake County')).not.toBeInTheDocument();
  });

  it('shows coverage percentage in dropdown', async () => {
    const user = userEvent.setup();
    render(<CountySearch {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search NC counties…'), 'Dur');
    expect(screen.getByText('88.3%')).toBeInTheDocument();
  });

  it('calls onSelect when item clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CountySearch {...defaultProps} onSelect={onSelect} />);
    await user.type(screen.getByPlaceholderText('Search NC counties…'), 'Dur');
    await user.click(screen.getByText('Durham County'));
    expect(onSelect).toHaveBeenCalledWith(mockFeatures[2]);
  });

  it('clears query after selection', async () => {
    const user = userEvent.setup();
    render(<CountySearch {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search NC counties…');
    await user.type(input, 'Dur');
    await user.click(screen.getByText('Durham County'));
    expect(input).toHaveValue('');
  });

  it('limits results to 8', async () => {
    const user = userEvent.setup();
    const manyFeatures = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      properties: { name: `County${i}` },
    }));
    const manyData = Object.fromEntries(
      manyFeatures.map(f => [`${f.properties.name} County`, { mean: 90 }])
    );
    render(<CountySearch {...defaultProps} ncFeatures={manyFeatures} countyData={manyData} />);
    await user.type(screen.getByPlaceholderText('Search NC counties…'), 'County');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeLessThanOrEqual(8);
  });
});
