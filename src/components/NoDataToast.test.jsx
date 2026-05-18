import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import NoDataToast from './NoDataToast.jsx';

describe('NoDataToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when stateName is falsy', () => {
    const { container } = render(<NoDataToast stateName={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the no-data message for the given state', () => {
    render(<NoDataToast stateName="Texas" onDismiss={() => {}} />);
    expect(screen.getByTestId('no-data-toast')).toBeInTheDocument();
    expect(screen.getByTestId('no-data-toast')).toHaveTextContent('Data not yet available for Texas.');
  });

  it('uses aria-live for screen reader announcements', () => {
    render(<NoDataToast stateName="Virginia" onDismiss={() => {}} />);
    const toast = screen.getByTestId('no-data-toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('auto-dismisses after the default duration', () => {
    const onDismiss = vi.fn();
    render(<NoDataToast stateName="Texas" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(4000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('respects a custom durationMs', () => {
    const onDismiss = vi.fn();
    render(<NoDataToast stateName="Texas" onDismiss={onDismiss} durationMs={1000} />);

    act(() => { vi.advanceTimersByTime(500); });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(500); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<NoDataToast stateName="Texas" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
