import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header.jsx';

const defaultProps = {
  currentView: 'coverage',
  onViewChange: () => {},
  stateFeatures: [],
  countyData: {},
  onCountySelect: () => {},
};

// StateSearch (rendered on the national view) reads the state manifest via
// useStateManifest(), which calls fetch on mount. We stub fetch so the
// test environment doesn't issue real network requests.
let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn((url) => {
    if (typeof url === 'string' && url.endsWith('data/states.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          nc: { fips: '37', name: 'North Carolina', status: 'ready' },
          tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Header', () => {
  it('renders title', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('Measles Vaccination (MMR) Coverage')).toBeInTheDocument();
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

  it('hides the county search on the national view', () => {
    render(<Header {...defaultProps} view="national" />);
    expect(screen.queryByPlaceholderText('Search NC counties…')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search NC counties')).not.toBeInTheDocument();
    expect(document.getElementById('hd-search-btn')).toBeNull();
  });

  it('renders StateSearch on the national view (not CountySearch)', () => {
    render(<Header {...defaultProps} view="national" />);
    expect(screen.getByPlaceholderText('Search states…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search NC counties/)).not.toBeInTheDocument();
  });

  it('does not render StateSearch on the state view', () => {
    render(<Header {...defaultProps} view="state" />);
    expect(screen.queryByPlaceholderText('Search states…')).not.toBeInTheDocument();
    // CountySearch is still rendered (one or more inputs).
    expect(screen.getAllByPlaceholderText('Search NC counties…').length).toBeGreaterThanOrEqual(1);
  });

  it('hides the view toggle on the national view', () => {
    render(<Header {...defaultProps} view="national" />);
    expect(screen.queryByText('Coverage')).not.toBeInTheDocument();
    expect(screen.queryByText('Below 95%')).not.toBeInTheDocument();
  });

  it('shows national landing copy on the national view', () => {
    render(<Header {...defaultProps} view="national" />);
    expect(screen.getByText('Click a state to explore')).toBeInTheDocument();
  });

  it('shows state landing copy on the state view', () => {
    render(<Header {...defaultProps} view="state" />);
    expect(screen.getByText(/Click a county to explore/)).toBeInTheDocument();
  });
});
