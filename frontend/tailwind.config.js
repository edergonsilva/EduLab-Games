/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f4f8fb',
        ink: '#202b33',
        muted: '#657580',
        line: '#dbe5ec',
        surface: '#ffffff',
        brand: {
          DEFAULT: '#0284c7',
          dark: '#0369a1',
          soft: '#e0f2fe',
          pale: '#f0f9ff',
        },
        cyan: {
          DEFAULT: '#0891b2',
          dark: '#0e7490',
          soft: '#cffafe',
          pale: '#ecfeff',
        },
        accent: {
          DEFAULT: '#e9954a',
          soft: '#fff2e4',
        },
        danger: '#b33d35',
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'DM Sans', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 12px 32px rgba(32, 43, 51, 0.06)',
        popover: '0 24px 70px rgba(32, 43, 51, 0.2)',
      },
    },
  },
  plugins: [],
}