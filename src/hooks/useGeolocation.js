import { useState, useEffect } from 'react';

const GEO_COUNTY_KEY = 'nc_geo_county';

export function useGeolocation() {
  const [userCountyName, setUserCountyName] = useState(null);
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserCoords({ longitude: pos.coords.longitude, latitude: pos.coords.latitude });
        },
        () => {
          // Fallback to previously detected geolocation county (not clicked county)
          const s = localStorage.getItem(GEO_COUNTY_KEY);
          if (s) setUserCountyName(s);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      const s = localStorage.getItem(GEO_COUNTY_KEY);
      if (s) setUserCountyName(s);
    }
  }, []);

  return { userCountyName, userCoords, setGeoCounty: (name) => localStorage.setItem(GEO_COUNTY_KEY, name) };
}
