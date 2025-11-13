/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans'", "'Noto Sans Devanagari'", 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'],
        techno: ["'Orbitron'", 'ui-sans-serif', 'system-ui']
      },
      colors: {
        'light-pink': '#fdf2f8',
        'light-pink-50': '#fef7f0',
        'light-pink-100': '#fce7f3',
        // Brand palette
        'brand-primary': {
          500: '#6C63FF',
          600: '#5A52E6',
        },
        'brand-accent': {
          500: '#00E1FF',
          600: '#04C7E0',
        },
        'brand-warm': {
          500: '#FFB703',
          600: '#F59E0B',
        },
        // Surfaces
        'surface': {
          900: '#0B1220',
          800: '#111827',
          700: '#1F2937',
        },
      },
      boxShadow: {
        'brand': '0 25px 50px -12px rgba(99,102,241,0.35)',
        'accent': '0 20px 40px -12px rgba(0,225,255,0.25)'
      },
      borderRadius: {
        'card': '1rem',
        'control': '0.75rem'
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1.5rem',
          md: '2rem'
        }
      }
    },
  },
  plugins: [],
}