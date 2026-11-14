/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
      keyframes: {
        'tab-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-in': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'swap-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(251,191,36,0.55)' },
          '50%': { boxShadow: '0 0 0 6px rgba(251,191,36,0)' },
        },
      },
      animation: {
        'tab-in': 'tab-in 220ms ease-out',
        'toast-in': 'toast-in 200ms ease-out',
        'sheet-in': 'sheet-in 220ms ease-out',
        'swap-pulse': 'swap-pulse 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
