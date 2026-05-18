import { useState, useEffect } from 'react';
import { DEFAULT_STATE_CODE } from '../config/states.js';

const GEO_COUNTY_KEY_PREFIX = 'geo_county_';

export function useGeolocation(stateCode = DEFAULT_STATE_CODE) {
  const [userCountyName, setUserCountyName] = useState(null);
  const [userCoords, setUserCoords] = useState(null);

  const storageKey = `${GEO_COUNTY_KEY_PREFIX}${(stateCode || DEFAULT_STATE_CODE).toLowerCase()}`;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserCoords({ longitude: pos.coords.longitude, latitude: pos.coords.latitude });
        },
        () => {
          // Fallback to previously detected geolocation county (not clicked county)
          const s = localStorage.getItem(storageKey);
          if (s) setUserCountyName(s);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      const s = localStorage.getItem(storageKey);
      if (s) setUserCountyName(s);
    }
  }, [storageKey]);

  return {
    userCountyName,
    userCoords,
    setGeoCounty: (name) => localStorage.setItem(storageKey, name),
  };
}
