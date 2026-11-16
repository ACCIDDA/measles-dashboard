import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DownloadButton from './DownloadButton.jsx';

describe('DownloadButton', () => {
  it.each([
    ['national', { zoomLevel: 'national' }],
    ['state', { zoomLevel: 'state', stateCode: 'ca' }],
    ['county', { zoomLevel: 'county', stateCode: 'ca', countySlug: 'los-angeles' }],
  ])('shows a disabled download button in %s view', (_view, props) => {
    render(<DownloadButton {...props} />);

    const button = screen.getByRole('button', { name: 'Download not available' });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('href');
    expect(button).not.toHaveAttribute('download');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Download not available');
  });

  it('renders nothing when the resolution lacks the data it needs', () => {
    const { container: stateContainer } = render(<DownloadButton zoomLevel="state" />);
    expect(stateContainer.firstChild).toBeNull();

    const { container: countyContainer } = render(
      <DownloadButton zoomLevel="county" stateCode="ca" />
    );
    expect(countyContainer.firstChild).toBeNull();
  });
});
