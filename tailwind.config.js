/** @type {import('tailwindcss').Config} */
const token = name => `rgb(var(--${name}) / <alpha-value>)`
// Glass tokens carry their own base alpha (index.css), multiplied by any opacity modifier (bg-surface/50).
const glass = (name, alpha) => `rgb(var(--${name}) / calc(<alpha-value> * var(--${alpha})))`

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        panel: token('panel'),
        surface: glass('surface', 'surface-a'),
        'surface-2': glass('surface-2', 'surface-2-a'),
        line: glass('line', 'line-a'),
        text: token('text'),
        muted: token('muted'),
        accent: token('accent'),
        'accent-2': token('accent-2'),
        good: token('good'),
        bad: token('bad'),
        warn: token('warn'),
      },
      fontFamily: {
        sans: ['"SF Pro Text"', '"SF Pro Display"', '"SF Pro"', '-apple-system', 'BlinkMacSystemFont', 'Inter', '"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { lg: '10px', xl: '16px', '2xl': '22px' },
      // Tailwind 3.3 stops at 10/20/25/30...; these also enable modifiers like bg-good/15.
      opacity: { 8: '0.08', 12: '0.12', 15: '0.15', 35: '0.35', 45: '0.45', 55: '0.55', 65: '0.65', 85: '0.85' },
    },
  },
  plugins: [],
}
