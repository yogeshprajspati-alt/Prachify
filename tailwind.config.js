/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#121212',
        surface: '#181818',
        elevated: '#282828',
        border: '#3E3E3E',
        'spotify-green': '#1DB954',
        pink: {
          DEFAULT: '#FF7EB6',
          dim: '#CC5F90',
        },
        purple: {
          DEFAULT: '#9D7CFF',
          dim: '#7A5FCC',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
          muted: '#727272',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-pink-purple': 'linear-gradient(135deg, #FF7EB6 0%, #9D7CFF 100%)',
        'gradient-surface': 'linear-gradient(180deg, #282828 0%, #121212 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(29,185,84,0.3)',
        card: '0 4px 24px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
