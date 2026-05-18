import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NationalView from './NationalView.jsx';

function mockManifest() {
  return {
    nc: { fips: '37', name: 'North Carolina', status: 'ready', data_url: '/NC/json/dashboard.json' },
    tx: { fips: '48', name: 'Texas', status: 'coming_soon' },
    va: { fips: '51', name: 'Virginia', status: 'coming_soon' },
  };
}

function mockFetchOK(payload = mockManifest()) {
  return vi.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  }));
}

describe('NationalView', () => {
  let originalFetch;
  let navigate;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    navigate = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows the loading state initially', () => {
    globalThis.fetch = mockFetchOK();
    render(<NationalView navigate={navigate} />);
    expect(screen.getByText(/loading state directory/i)).toBeInTheDocument();
  });

  it('renders one button per manifest entry, sorted by name', async () => {
    globalThis.fetch = mockFetchOK();
    render(<NationalView navigate={navigate} />);
    await waitFor(() => expect(screen.getByTestId('national-state-list')).toBeInTheDocument());

    expect(screen.getByTestId('state-btn-nc')).toBeInTheDocument();
    expect(screen.getByTestId('state-btn-tx')).toBeInTheDocument();
    expect(screen.getByTestId('state-btn-va')).toBeInTheDocument();
  });

  it('styles ready states differently from coming_soon states', async () => {
    globalThis.fetch = mockFetchOK();
    render(<NationalView navigate={navigate} />);
    await waitFor(() => expect(screen.getByTestId('state-btn-nc')).toBeInTheDocument());

    const nc = screen.getByTestId('state-btn-nc');
    const tx = screen.getByTestId('state-btn-tx');

    expect(nc).toHaveClass('state-ready');
    expect(nc).not.toHaveClass('state-coming-soon');
    expect(tx).toHaveClass('state-coming-soon');
    expect(tx).not.toHaveClass('state-ready');
    expect(tx).toHaveAttribute('aria-disabled', 'true');
    expect(nc).not.toHaveAttribute('aria-disabled');
  });

  it('clicking a coming_soon state shows the "no data" message and does not navigate', async () => {
    globalThis.fetch = mockFetchOK();
    render(<NationalView navigate={navigate} />);
    await waitFor(() => expect(screen.getByTestId('state-btn-tx')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('state-btn-tx'));

    expect(await screen.findByTestId('no-data-toast')).toHaveTextContent(
      'Data not yet available for Texas.'
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clicking a ready state triggers navigation to /state/<code>', async () => {
    globalThis.fetch = mockFetchOK();
    render(<NationalView navigate={navigate} />);
    await waitFor(() => expect(screen.getByTestId('state-btn-nc')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('state-btn-nc'));

    expect(navigate).toHaveBeenCalledTimes(1);
    const url = navigate.mock.calls[0][0];
    expect(url).toMatch(/state\/nc$/);
    expect(screen.queryByTestId('no-data-toast')).toBeNull();
  });

  it('shows an error message when the manifest fails to load', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    render(<NationalView navigate={navigate} />);
    await waitFor(() => expect(screen.getByText(/error:/i)).toBeInTheDocument());
  });
});
