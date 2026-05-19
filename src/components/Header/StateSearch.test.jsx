import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StateSearch from './StateSearch.jsx';

// StateSearch internally calls useStateManifest(), which fetches the
// manifest JSON on mount. Tests provide the manifest via prop, so we
// stub fetch to avoid network noise and unhandled rejections.
let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockManifest = {
  nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/NC/json/dashboard.json' },
  tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
  va: { fips: '51', name: 'Virginia', status: 'coming_soon' },
  ca: { fips: '06', name: 'California', status: 'coming_soon' },
  dc: { fips: '11', name: 'District of Columbia', status: 'coming_soon' },
  pr: { fips: '72', name: 'Puerto Rico', status: 'coming_soon' },
};

const defaultProps = {
  manifest: mockManifest,
  onSelect: () => {},
};

describe('StateSearch', () => {
  it('renders the input with the expected placeholder and aria-label', () => {
    render(<StateSearch {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search states…');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-label', 'Search for a state');
  });

  it('shows no dropdown when the query is empty', () => {
    render(<StateSearch {...defaultProps} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows Texas as a suggestion when typing "Tex"', async () => {
    const user = userEvent.setup();
    render(<StateSearch {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search states…'), 'Tex');
    expect(screen.getByText('Texas')).toBeInTheDocument();
  });

  it('shows the no-matches UI when no states match the query', async () => {
    const user = userEvent.setup();
    render(<StateSearch {...defaultProps} />);
    // "Xyz" is not a substring of any state name in the manifest.
    await user.type(screen.getByPlaceholderText('Search states…'), 'Xyz');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('No matching states')).toBeInTheDocument();
  });

  it('calls onSelect with the lowercase USPS code when a result is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StateSearch {...defaultProps} onSelect={onSelect} />);
    await user.type(screen.getByPlaceholderText('Search states…'), 'North Caro');
    await user.click(screen.getByText('North Carolina'));
    expect(onSelect).toHaveBeenCalledWith('nc');
  });

  it('keeps coming_soon states selectable and tags them visually', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StateSearch {...defaultProps} onSelect={onSelect} />);
    await user.type(screen.getByPlaceholderText('Search states…'), 'Tex');
    expect(screen.getByText('(no data yet)')).toBeInTheDocument();
    await user.click(screen.getByText('Texas'));
    expect(onSelect).toHaveBeenCalledWith('tx');
  });

  it('clears the query after selection', async () => {
    const user = userEvent.setup();
    render(<StateSearch {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search states…');
    await user.type(input, 'Texas');
    await user.click(screen.getByText('Texas'));
    expect(input).toHaveValue('');
  });

  it('limits the number of visible suggestions to 8', async () => {
    const user = userEvent.setup();
    // 12 distinct entries that all start with "Aa" so they all match the query.
    const manyEntries = Array.from({ length: 12 }, (_, i) => [
      `s${i}`,
      { fips: String(i).padStart(2, '0'), name: `Aaa State ${i}`, status: 'coming_soon' },
    ]);
    const manyManifest = Object.fromEntries(manyEntries);
    render(<StateSearch manifest={manyManifest} onSelect={() => {}} />);
    await user.type(screen.getByPlaceholderText('Search states…'), 'Aaa');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeLessThanOrEqual(8);
  });
});
