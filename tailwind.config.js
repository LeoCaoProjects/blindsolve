export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
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
