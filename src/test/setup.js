import '@testing-library/jest-dom';

// jsdom does not implement the browser's object URL helpers. Provide the API
// surface so download tests can spy on it and verify the generated download.
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:jsdom';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

// Configuration is fetched at module initialization in the browser. Vitest's
// jsdom fetch cannot resolve the app's root-relative URLs, so provide the
// same small registry/config contract used by the UI tests.
const stateConfigs = {
  nc: {
    code: 'nc',
    name: 'NC',
    fullName: 'North Carolina',
    dataDir: 'NC',
    fips: '37',
    sourceUrl: 'https://www.ncdhhs.gov/',
    sourceLabel: 'NC DHHS',
  },
};

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.endsWith('data/stateRegistry.json')) {
    return { ok: true, json: async () => ({ nc: 'https://cgbryan1.github.io/measles-NC/' }) };
  }
  if (url.endsWith('data/meta.json')) {
    return { ok: true, json: async () => stateConfigs.nc };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
};
