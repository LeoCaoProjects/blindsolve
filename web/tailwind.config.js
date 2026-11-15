import plugin from 'tailwindcss/plugin.js';

export default {content: [
  './index.html',
  './src/**/*.{html,js,ts,jsx,tsx}'
],
  plugins: [plugin(({ addVariant }) => {
    // Only the Timer/shared shell opt into this variant in the first pass.
    addVariant('vp-md', [
      '@media (min-width: 768px) { html:not([data-viewport-sizing]) & }',
      'html[data-viewport-sizing] &',
    ]);
  })],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        hover: 'var(--hover)',
        selected: 'var(--selected)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        accent: 'var(--accent)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
        timer: 'var(--font-timer)',
      },
      boxShadow: {
        overlay: 'var(--shadow-overlay)',
      },
    },
  },
};
