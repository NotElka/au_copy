import React from 'react';

// Kaspi brand icon — red circle with stylized K
const KaspiLogo = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <rect width="44" height="44" rx="10" fill="#E83232"/>
    {/* Stylized K */}
    <path d="M13 10 L13 34" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M13 22 L28 10" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M13 22 L30 34" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
  </svg>
);

export default KaspiLogo;
