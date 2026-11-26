/**
 * Icônes SVG légères (style trait, 24x24), sans dépendance externe.
 */
import React from 'react';

const PATHS = {
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  pill: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M8.5 8.5l7 7" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v5M9.5 13.5h5" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M10 12v2a5 5 0 0 0 10 0v-1" />
      <circle cx="20" cy="11" r="2" />
    </>
  ),
  arrow: <path d="M9 6l6 6-6 6" />
};

function Icon({ name, size = 22, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {PATHS[name] || null}
    </svg>
  );
}

export default Icon;
