/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        seismic: {
          50:  '#eff6ff',   100: '#dbeafe',   200: '#bfdbfe',
          300: '#93c5fd',   400: '#60a5fa',   500: '#3b82f6',
          600: '#2563eb',   700: '#1d4ed8',   800: '#1e3a5f',
          900: '#0f172a',   950: '#020617',
        },
        dark: {
          800: '#111827',   900: '#0d1117',   950: '#080c16',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'seismic-pulse': 'seismicPulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        seismicPulse: {
          '0%': { opacity: '0.3', transform: 'scaleX(1)' },
          '50%': { opacity: '0.6', transform: 'scaleX(1.02)' },
          '100%': { opacity: '0.3', transform: 'scaleX(1)' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        }
      }
    },
  },
  plugins: [],
}
