export default function Footer() {
  return (
    <footer>
      <span className="ft-acc">ACCIDDA</span>
      <span className="ft-sep"></span>
      <span className="ft">
        Atlantic Coast Center for Infectious Disease Dynamics and Analytics &middot; UNC Chapel Hill
      </span>
      <span className="ft" style={{ marginLeft: 'auto' }}>
        Sources:{' '}
        <a
          href="https://www.dph.ncdhhs.gov/programs/epidemiology/immunization/data/kindergarten-dashboard"
          target="_blank"
          rel="noopener noreferrer"
        >
          NC DHHS
        </a>
        {' '}&middot;{' '}
        <a
          href="https://www.cdc.gov/vaccines/data-reporting/index.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          CDC VaxView
        </a>
        {' '}&middot; imuGAP
      </span>
    </footer>
  );
}
