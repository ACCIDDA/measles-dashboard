export const TIER_COLORS = { H: '#0072B2', M: '#E69F00', L: '#D55E00' };
export const TIER_LABELS = { H: 'High', M: 'Medium', L: 'Low' };
export const SHAPES = {
  H: '<circle cx="6" cy="6" r="5"/>',
  M: '<rect x="1" y="1" width="10" height="10" rx="1"/>',
  L: '<polygon points="6,1 11,11 1,11"/>'
};
export const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th'];
export const LEGEND = {
  coverage: { title: 'Coverage Level', h: 'High ≥95%', m: 'Medium 90–95%', l: 'Low <90%' },
  undervax: { title: '% Schools Below 95%', h: 'Low risk (<20%)', m: 'Medium (20–40%)', l: 'High risk (>40%)' }
};
export function covTier(v) { return v >= 95 ? 'H' : v >= 90 ? 'M' : 'L'; }
export function uvTier(p) { return p < 20 ? 'H' : p < 40 ? 'M' : 'L'; }
