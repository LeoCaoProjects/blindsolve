import React, { useState } from 'react';

/** Official WCA logo (no text), served by the WCA. */
const WCA_LOGO = 'https://www.worldcubeassociation.org/files/WCAlogo_notext.svg';

/**
 * WCA identity mark. Uses the WCA's own logo file; if it can't load, a close drawing of the
 * same mark (coloured cube-face globe) stands in so the button never shows a broken image.
 */
export function WcaMark({ size = 16 }: {size?: number;}) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return <img src={WCA_LOGO} width={size} height={size} alt="" aria-hidden className="shrink-0" onError={() => setFailed(true)} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="15" fill="#fff" />
      <path d="M16 1a15 15 0 0 0-13 7.5L16 16z" fill="#029347" />
      <path d="M29 8.5A15 15 0 0 0 16 1v15z" fill="#fc0" />
      <path d="M31 16a15 15 0 0 0-2-7.5L16 16z" fill="#e90d0d" />
      <path d="M29 23.5A15 15 0 0 0 31 16H16z" fill="#304a96" />
      <path d="M16 31a15 15 0 0 0 13-7.5L16 16z" fill="#f60" />
      <path d="M3 23.5A15 15 0 0 0 16 31V16z" fill="#029347" />
      <path d="M1 16a15 15 0 0 0 2 7.5L16 16z" fill="#304a96" />
      <path d="M3 8.5A15 15 0 0 0 1 16h15z" fill="#e90d0d" />
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
    </svg>);

}

export function GoogleMark({ size = 16 }: {size?: number;}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>);

}