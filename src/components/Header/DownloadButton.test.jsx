import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DownloadButton from './DownloadButton.jsx';

// In tests import.meta.env.BASE_URL is unset, so withBase() prefixes '/'.
const href = () => screen.getByRole('link').getAttribute('href');
const dl = () => screen.getByRole('link').getAttribute('download');

describe('DownloadButton (#21)', () => {
  it('national view links to the all-states zip bundle', () => {
    render(<DownloadButton zoomLevel="national" />);
    expect(href()).toBe('/data/all-states.zip');
    expect(dl()).toBe('all-states.zip');
  });

  it('state view links to that state\'s counties zip bundle', () => {
    render(<DownloadButton zoomLevel="state" stateCode="ca" />);
    expect(href()).toBe('/data/states/ca-counties.zip');
    expect(dl()).toBe('ca-counties.zip');
  });

  it('county view links to that county\'s school-breakdown CSV', () => {
    render(<DownloadButton zoomLevel="county" stateCode="ca" countySlug="los-angeles" />);
    expect(href()).toBe('/data/states/ca/counties/los-angeles.csv');
    expect(dl()).toBe('ca-los-angeles-schools.csv');
  });

  it('renders nothing when the resolution lacks the data it needs', () => {
    // state view with no state code, county view missing the county slug
    const { container: c1 } = render(<DownloadButton zoomLevel="state" />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<DownloadButton zoomLevel="county" stateCode="ca" />);
    expect(c2.firstChild).toBeNull();
  });
});
