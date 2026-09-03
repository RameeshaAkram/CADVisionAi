/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        g: {
          950: '#0D0C0B', 900: '#141312', 850: '#1B1917', 800: '#232120',
          700: '#33302D', 600: '#4A4642', 500: '#6E6862', 400: '#928B84',
          300: '#B5AEA6', 100: '#E4E0D9',
        },
        paper: { DEFAULT: '#EDEAE3', hi: '#FFFFFF', lo: '#D9D5CC', line: '#DAD5CB' },
        cyan: { 400: '#5AD9E8', 500: '#2CC0D4', 600: '#1B96A8', 700: '#14707E', ink: '#06201F' },
        amber: { 400: '#F0B429', 500: '#D2960F', 700: '#9A6B0C' },
        vermilion: { 400: '#F4705E', 500: '#E0492F', 700: '#B03A22' },
      },
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { chip: '2px', input: '3px', btn: '4px', card: '6px', modal: '8px' },
      boxShadow: {
        edge: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        pop: '0 8px 24px -8px rgba(0,0,0,0.6)',
        modal: '0 24px 48px -12px rgba(0,0,0,0.75)',
        ring: '0 0 0 2px #0D0C0B, 0 0 0 4px #5AD9E8',
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.16,1,0.3,1)' },
    },
  },
  plugins: [],
}
