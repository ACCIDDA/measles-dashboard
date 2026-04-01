import { useState, useEffect } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { covTier } from '../config/index.js';

const SCHOOL_RAW = [
  {"n":"Ashley Elementary","c":"Cumberland County","x":-78.9068,"y":35.0387},
  {"n":"Brentwood Elementary","c":"Cumberland County","x":-78.9832,"y":35.0382},
  {"n":"Elizabeth M Cashwell Elementary","c":"Cumberland County","x":-78.9149,"y":35.0065},
  {"n":"Eastover-Central Elementary","c":"Cumberland County","x":-78.7618,"y":35.1228},
  {"n":"Cliffdale Elementary","c":"Cumberland County","x":-78.9947,"y":35.059},
  {"n":"College Lakes Elementary","c":"Cumberland County","x":-78.8994,"y":35.1278},
  {"n":"Cumberland Mills Elementary","c":"Cumberland County","x":-78.9683,"y":35.0023},
  {"n":"Alderman Road Elementary","c":"Cumberland County","x":-78.8603,"y":34.8952},
  {"n":"Ed V Baldwin Elementary","c":"Cumberland County","x":-78.9346,"y":34.9788},
  {"n":"Long Hill Elementary","c":"Cumberland County","x":-78.8655,"y":35.1626},
  {"n":"Mary McArthur Elementary","c":"Cumberland County","x":-78.9412,"y":35.0252},
  {"n":"Montclair Elementary","c":"Cumberland County","x":-78.9613,"y":35.0555},
  {"n":"Morganton Road Elementary","c":"Cumberland County","x":-78.9874,"y":35.0796},
  {"n":"Manchester Elementary","c":"Cumberland County","x":-78.967,"y":35.1705},
  {"n":"Ponderosa Elementary","c":"Cumberland County","x":-78.9874,"y":35.087},
  {"n":"Benjamin J Martin Elementary","c":"Cumberland County","x":-79.0099,"y":35.0931},
  {"n":"Rockfish Elementary","c":"Cumberland County","x":-78.957,"y":34.9715},
  {"n":"Sherwood Park Elementary","c":"Cumberland County","x":-78.9622,"y":35.0185},
  {"n":"Sunnyside Elementary","c":"Cumberland County","x":-78.7969,"y":35.0281},
  {"n":"Warrenwood Elementary","c":"Cumberland County","x":-78.909,"y":35.1206},
  {"n":"William H Owen Elementary","c":"Cumberland County","x":-78.9541,"y":35.042},
  {"n":"Bill Hefner Elementary","c":"Cumberland County","x":-79.045,"y":35.0685},
  {"n":"Armstrong Elementary","c":"Cumberland County","x":-78.7904,"y":35.0915},
  {"n":"Ayden Elementary","c":"Pitt County","x":-77.4322,"y":35.4755},
  {"n":"Belvoir Elementary","c":"Pitt County","x":-77.4175,"y":35.6676},
  {"n":"Bethel Elementary","c":"Pitt County","x":-77.3704,"y":35.8061},
  {"n":"Falkland Elementary","c":"Pitt County","x":-77.4874,"y":35.6697},
  {"n":"H B Sugg Elementary","c":"Pitt County","x":-77.5751,"y":35.5945},
  {"n":"Sam D Bundy Elementary","c":"Pitt County","x":-77.5772,"y":35.5951},
  {"n":"W H Robinson Elementary","c":"Pitt County","x":-77.3992,"y":35.5339},
  {"n":"Eastern Elementary","c":"Pitt County","x":-77.3432,"y":35.5965},
  {"n":"Elmhurst Elementary","c":"Pitt County","x":-77.363,"y":35.5958},
  {"n":"South Greenville Elementary","c":"Pitt County","x":-77.3849,"y":35.5987},
  {"n":"Wahl Coates Elementary","c":"Pitt County","x":-77.3497,"y":35.6062},
  {"n":"Northwest Elementary","c":"Pitt County","x":-77.4779,"y":35.738},
  {"n":"Lakeforest Elementary","c":"Pitt County","x":-77.4213,"y":35.5924},
  {"n":"Alexander Wilson Elementary","c":"Alamance County","x":-79.3467,"y":36.0297},
  {"n":"Altamahaw-Ossipee Elementary","c":"Alamance County","x":-79.5105,"y":36.1796},
  {"n":"B. Everett Jordan Elementary","c":"Alamance County","x":-79.3268,"y":35.9398},
  {"n":"E M Yoder Elementary","c":"Alamance County","x":-79.2744,"y":36.1005},
  {"n":"Edwin M Holt Elementary","c":"Alamance County","x":-79.4889,"y":36.0213},
  {"n":"Elon Elementary","c":"Alamance County","x":-79.4973,"y":36.1181},
  {"n":"Haw River Elementary","c":"Alamance County","x":-79.3579,"y":36.0932},
  {"n":"North Graham Elementary","c":"Alamance County","x":-79.3777,"y":36.0763},
  {"n":"Pleasant Grove Elementary","c":"Alamance County","x":-79.3067,"y":36.2173},
  {"n":"South Graham Elementary","c":"Alamance County","x":-79.3934,"y":36.0523},
  {"n":"Sylvan Elementary","c":"Alamance County","x":-79.4366,"y":35.88},
  {"n":"Eastlawn Elementary","c":"Alamance County","x":-79.4071,"y":36.1018},
  {"n":"Grove Park Elementary","c":"Alamance County","x":-79.4608,"y":36.0801},
  {"n":"Carrboro Elementary","c":"Orange County","x":-79.0786,"y":35.9149},
  {"n":"Ephesus Elementary","c":"Orange County","x":-79.0162,"y":35.9335},
  {"n":"Estes Hills Elementary","c":"Orange County","x":-79.0436,"y":35.9359},
  {"n":"FPG Elementary","c":"Orange County","x":-79.0725,"y":35.8997},
  {"n":"Glenwood Elementary","c":"Orange County","x":-79.0266,"y":35.9063},
  {"n":"McDougle Elementary","c":"Orange County","x":-79.099,"y":35.9297},
  {"n":"Scroggs Elementary","c":"Orange County","x":-79.0685,"y":35.8791},
  {"n":"Rashkis Elementary","c":"Orange County","x":-79.0081,"y":35.9144},
  {"n":"Morris Grove Elementary","c":"Orange County","x":-79.1023,"y":35.9665},
  {"n":"Northside Elementary","c":"Orange County","x":-79.0632,"y":35.9175},
  {"n":"Central Elementary","c":"Orange County","x":-79.1146,"y":36.08},
  {"n":"Efland Cheeks Elementary","c":"Orange County","x":-79.1888,"y":36.0836},
  {"n":"Grady Brown Elementary","c":"Orange County","x":-79.1266,"y":36.0517},
  {"n":"Hillsborough Elementary","c":"Orange County","x":-79.1105,"y":36.0804},
  {"n":"New Hope Elementary","c":"Orange County","x":-79.0751,"y":36.0199},
  {"n":"Burton Elementary","c":"Durham County","x":-78.8877,"y":35.9793},
  {"n":"Club Boulevard Elementary","c":"Durham County","x":-78.8967,"y":36.0193},
  {"n":"Lakewood Elementary","c":"Durham County","x":-78.9355,"y":35.9832},
  {"n":"Bethesda Elementary","c":"Durham County","x":-78.8378,"y":35.9402},
  {"n":"Eno Valley Elementary","c":"Durham County","x":-78.9126,"y":36.085},
  {"n":"Glenn Elementary","c":"Durham County","x":-78.8381,"y":36.0289},
  {"n":"Hillandale Elementary","c":"Durham County","x":-78.9331,"y":36.0526},
  {"n":"Holt Elementary","c":"Durham County","x":-78.9062,"y":36.0563},
  {"n":"Forest View Elementary","c":"Durham County","x":-78.9921,"y":35.989},
  {"n":"George Watts Elementary","c":"Durham County","x":-78.9107,"y":36.0082},
  {"n":"Merrick-Moore Elementary","c":"Durham County","x":-78.852,"y":36.0056},
  {"n":"Oak Grove Elementary","c":"Durham County","x":-78.8189,"y":35.9799},
  {"n":"Pearsontown Elementary","c":"Durham County","x":-78.9086,"y":35.9323},
  {"n":"E K Powe Elementary","c":"Durham County","x":-78.9224,"y":36.013},
  {"n":"R N Harris Elementary","c":"Durham County","x":-78.8838,"y":35.9712},
  {"n":"Bolton Elementary","c":"Forsyth County","x":-80.2911,"y":36.0742},
  {"n":"Brunson Elementary","c":"Forsyth County","x":-80.2647,"y":36.0943},
  {"n":"Cash Elementary","c":"Forsyth County","x":-80.1228,"y":36.1371},
  {"n":"Clemmons Elementary","c":"Forsyth County","x":-80.3764,"y":36.0248},
  {"n":"Forest Park Elementary","c":"Forsyth County","x":-80.2164,"y":36.0718},
  {"n":"Griffith Elementary","c":"Forsyth County","x":-80.2637,"y":36.0408},
  {"n":"Hall-Woodward Elementary","c":"Forsyth County","x":-80.1745,"y":36.0804},
  {"n":"Hanes Magnet School","c":"Forsyth County","x":-80.2061,"y":36.0644},
  {"n":"Jefferson Elementary","c":"Forsyth County","x":-80.3478,"y":36.1259},
  {"n":"Kernersville Elementary","c":"Forsyth County","x":-80.0805,"y":36.1273},
  {"n":"Konnoak Elementary","c":"Forsyth County","x":-80.247,"y":36.0518},
  {"n":"Diggs-Latham Elementary","c":"Forsyth County","x":-80.2563,"y":36.0785},
  {"n":"Lewisville Elementary","c":"Forsyth County","x":-80.4194,"y":36.0947},
  {"n":"Bell Elementary","c":"Buncombe County","x":-82.4926,"y":35.5897},
  {"n":"Candler Elementary","c":"Buncombe County","x":-82.7001,"y":35.5382},
  {"n":"Emma Elementary","c":"Buncombe County","x":-82.5919,"y":35.5982},
  {"n":"Fairview Elementary","c":"Buncombe County","x":-82.411,"y":35.5227},
  {"n":"Glen Arden Elementary","c":"Buncombe County","x":-82.4971,"y":35.4697},
  {"n":"Haw Creek Elementary","c":"Buncombe County","x":-82.5054,"y":35.5948},
  {"n":"Johnston Elementary","c":"Buncombe County","x":-82.62,"y":35.5866},
  {"n":"Leicester Elementary","c":"Buncombe County","x":-82.7071,"y":35.6589},
  {"n":"Oakley Elementary","c":"Buncombe County","x":-82.5125,"y":35.5642},
  {"n":"Williams Elementary","c":"Buncombe County","x":-82.4029,"y":35.6042},
  {"n":"Weaverville Elementary","c":"Buncombe County","x":-82.5628,"y":35.6896},
  {"n":"Davis Drive Elementary","c":"Wake County","x":-78.8505,"y":35.7802},
  {"n":"Adams Elementary","c":"Wake County","x":-78.7622,"y":35.7769},
  {"n":"Apex Elementary","c":"Wake County","x":-78.857,"y":35.721},
  {"n":"Cary Elementary","c":"Wake County","x":-78.7811,"y":35.7819},
  {"n":"Combs Elementary","c":"Wake County","x":-78.7015,"y":35.7745},
  {"n":"Fuquay-Varina Elementary","c":"Wake County","x":-78.7569,"y":35.6031},
  {"n":"Holly Springs Elementary","c":"Wake County","x":-78.8283,"y":35.6561},
  {"n":"Morrisville Elementary","c":"Wake County","x":-78.8465,"y":35.8114},
  {"n":"Rolesville Elementary","c":"Wake County","x":-78.4626,"y":35.9186},
  {"n":"Wake Forest Elementary","c":"Wake County","x":-78.5137,"y":35.9764},
  {"n":"Zebulon Elementary","c":"Wake County","x":-78.3198,"y":35.8396},
  {"n":"Brier Creek Elementary","c":"Wake County","x":-78.8049,"y":35.9015},
  {"n":"University Meadows Elementary","c":"Mecklenburg County","x":-80.7145,"y":35.3155},
  {"n":"Crown Point Elementary","c":"Mecklenburg County","x":-80.715,"y":35.1599},
  {"n":"David Cox Road Elementary","c":"Mecklenburg County","x":-80.8009,"y":35.3368},
  {"n":"Albemarle Road Elementary","c":"Mecklenburg County","x":-80.7295,"y":35.1971},
  {"n":"Allenbrook Elementary","c":"Mecklenburg County","x":-80.915,"y":35.2618},
  {"n":"Beverly Woods Elementary","c":"Mecklenburg County","x":-80.8368,"y":35.1314},
  {"n":"Cotswold Elementary","c":"Mecklenburg County","x":-80.7976,"y":35.1793},
  {"n":"Eastover Elementary","c":"Mecklenburg County","x":-80.8217,"y":35.1966},
  {"n":"Hickory Grove Elementary","c":"Mecklenburg County","x":-80.7175,"y":35.2264},
  {"n":"Matthews Elementary","c":"Mecklenburg County","x":-80.7234,"y":35.1132},
  {"n":"Myers Park Traditional Elem","c":"Mecklenburg County","x":-80.8345,"y":35.1902},
  {"n":"Olde Providence Elementary","c":"Mecklenburg County","x":-80.7988,"y":35.1106},
  {"n":"Park Road Montessori","c":"Mecklenburg County","x":-80.8488,"y":35.1775},
  {"n":"Paw Creek Elementary","c":"Mecklenburg County","x":-80.9452,"y":35.2911},
  {"n":"Pineville Elementary","c":"Mecklenburg County","x":-80.8879,"y":35.0824},
  {"n":"Mallard Creek Elementary","c":"Mecklenburg County","x":-80.7745,"y":35.3354},
  {"n":"Highland Creek Elementary","c":"Mecklenburg County","x":-80.7633,"y":35.3783},
  {"n":"Ballantyne Elementary","c":"Mecklenburg County","x":-80.8561,"y":35.0374},
  {"n":"G W Bulluck Elementary","c":"Edgecombe County","x":-77.7203,"y":35.8832},
  {"n":"Benvenue Elementary","c":"Nash County","x":-77.8385,"y":35.9764},
  {"n":"Nashville Elementary","c":"Nash County","x":-77.9642,"y":35.9705},
  {"n":"Taylorsville Elementary","c":"Alexander County","x":-81.1831,"y":35.9203},
  {"n":"Pinehurst Elementary","c":"Moore County","x":-79.4629,"y":35.1996}
];

// Build a lookup from school name + county to coords from SCHOOL_RAW
const schoolCoordsLookup = {};
SCHOOL_RAW.forEach(s => {
  schoolCoordsLookup[s.n + '|' + s.c] = [s.x, s.y];
});

export function useDashboardData() {
  const [state, setState] = useState({ countyData: null, allSchools: null, ncFeatures: null, neighborStates: null, stateMesh: null, adjacencyMap: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dashRes, usRes] = await Promise.all([
          fetch('/NC/json/dashboard.json'),
          fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
        ]);

        if (!dashRes.ok) throw new Error('Failed to load dashboard data');
        if (!usRes.ok) throw new Error('Failed to load map data');

        const dashboard = await dashRes.json();
        const us = await usRes.json();

        const ncFeatures = topojson.feature(us, us.objects.counties).features.filter(f => String(f.id).startsWith('37'));
        const neighborStates = topojson.feature(us, us.objects.states).features.filter(f => +f.id !== 37);
        const stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

        // Build adjacency map from shared county borders
        const ncIds = new Set(ncFeatures.map(f => f.id));
        const adjacencyMap = {};
        ncFeatures.forEach(f => { adjacencyMap[f.id] = []; });
        topojson.neighbors(us.objects.counties.geometries).forEach((neighbors, i) => {
          const geo = us.objects.counties.geometries[i];
          const id = geo.id != null ? String(geo.id) : String(i);
          if (!ncIds.has(id)) return;
          neighbors.forEach(j => {
            const nGeo = us.objects.counties.geometries[j];
            const nId = nGeo.id != null ? String(nGeo.id) : String(j);
            if (ncIds.has(nId) && !adjacencyMap[id].includes(nId)) {
              adjacencyMap[id].push(nId);
            }
          });
        });

        // Build a lookup from county name (without " County") to its GeoJSON feature
        const featureByName = {};
        ncFeatures.forEach(f => {
          featureByName[f.properties.name] = f;
        });

        // Build countyData as a plain object keyed by "X County"
        const countyData = {};
        dashboard.counties.forEach(c => {
          const key = c.name + ' County';
          countyData[key] = {
            mean: c.coverage,
            herd_immunity: c.herd_immunity,
            fips: null
          };
          // Try to find matching FIPS from feature
          const feature = featureByName[c.name];
          if (feature) {
            countyData[key].fips = feature.id;
          }
        });

        // Build allSchools array
        const allSchools = [];
        dashboard.counties.forEach(c => {
          const countyKey = c.name + ' County';
          const feature = featureByName[c.name];

          c.schools.forEach(school => {
            // Look up coords from SCHOOL_RAW, fallback to county centroid
            const rawKey = school.name + '|' + countyKey;
            let coords = schoolCoordsLookup[rawKey];
            // Leave coords null if not in SCHOOL_RAW; map will use pathGen.centroid()

            // Build grade-level data
            // Estimated[i]=true means model-estimated; false means reported
            const breakdown = school.stats.coverage_breakdown || [];
            const estimatedFlags = school.stats.Estimated || [];

            // estimated array: all coverage_breakdown values as numbers
            const estimated = breakdown.map(v => {
              const n = parseFloat(v);
              return isNaN(n) ? null : n;
            });

            // reported array: same but null where Estimated[i]===true
            const reported = breakdown.map((v, i) => {
              if (estimatedFlags[i] === true) return null;
              const n = parseFloat(v);
              return isNaN(n) ? null : n;
            });

            allSchools.push({
              county: countyKey,
              coords,           // null when not in SCHOOL_RAW
              feature,          // used by map to compute centroid fallback
              coverage: school.stats.Coverage,
              tier: covTier(school.stats.Coverage),
              name: school.name,
              size: school.stats.Size,
              grades: { estimated, reported }
            });
          });
        });

        if (!cancelled) {
          setState({ countyData, allSchools, ncFeatures, neighborStates, stateMesh, adjacencyMap, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false, error: err.message }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
