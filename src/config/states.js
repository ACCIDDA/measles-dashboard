// State metadata used to drive the state-parameterized view.
//
// The dashboard renders one US state at a time. The choice of state is
// driven by a state code (lowercase, e.g. "nc"). All state-specific values
// — display name, data folder, county FIPS prefix, and external attribution
// links — live here so adding a new state requires data + an entry below,
// not code changes elsewhere.
export const STATES = {
  nc: {
    code: 'nc',
    name: 'NC',
    fullName: 'North Carolina',
    // Folder under public/ where dashboard.json + school_coords.json live.
    dataDir: 'NC',
    // 2-digit state FIPS — used to filter the national counties topology
    // down to just this state's counties.
    fips: '37',
    // Attribution link shown in the map legend / footer for this state's
    // public health data source.
    sourceUrl: 'https://www.dph.ncdhhs.gov/programs/epidemiology/immunization/data/kindergarten-dashboard',
    sourceLabel: 'NC DHHS',
  },
};

export const DEFAULT_STATE_CODE = 'nc';

export function getStateConfig(code) {
  const key = (code || DEFAULT_STATE_CODE).toLowerCase();
  return STATES[key] || STATES[DEFAULT_STATE_CODE];
}
