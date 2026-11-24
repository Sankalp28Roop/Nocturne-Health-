/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0c0f0e',
        surface: '#111413',
        'surface-dim': '#111413',
        'surface-bright': '#373a38',
        'surface-container-lowest': '#0c0f0e',
        'surface-container-low': '#191c1b',
        'surface-container': '#1d201f',
        'surface-container-high': '#282b29',
        'surface-container-highest': '#323534',
        'on-surface': '#e1e3e1',
        'on-surface-variant': '#bccabb',
        'outline': '#869486',
        'outline-variant': '#3d4a3e',
        'surface-tint': '#4de082',
        primary: {
          DEFAULT: '#6bfb9a',
          container: '#4ade80',
          fixed: '#6dfe9c',
          dark: '#005e2d',
          jet: '#003919'
        },
        secondary: {
          DEFAULT: '#73db9a',
          container: '#00834b',
          light: '#86efac'
        },
        tertiary: '#ffffff',
        danger: '#ffb4ab',
        'danger-container': '#93000a'
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'card-lg': '32px',
        'pill': '9999px',
      },
      boxShadow: {
        'glow-primary': '0 4px 24px rgba(74, 222, 128, 0.25)',
        'glow-subtle': '0 4px 20px rgba(134, 239, 172, 0.12)',
        'glass-rim': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
      }
    },
  },
  plugins: [],
}
