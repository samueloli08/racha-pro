/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'tab-in': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'card-rise': {
          '0%': { opacity: '0', transform: 'translateY(22px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'score-pop': {
          '0%': { transform: 'scale(0.72) translateY(8px)', opacity: '0.4' },
          '55%': { transform: 'scale(1.16) translateY(-3px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(18px) scale(0.92)' },
          '65%': { opacity: '1', transform: 'translateY(-3px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sheet-in': {
          '0%': { opacity: '0', transform: 'translateY(28px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'swap-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(217,119,6,0.45)' },
          '50%': { boxShadow: '0 0 0 8px rgba(217,119,6,0)' },
        },
        'sonar': {
          '0%': { transform: 'scale(1)', opacity: '0.75' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
      },
      animation: {
        'tab-in': 'tab-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'card-rise': 'card-rise 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'score-pop': 'score-pop 460ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'toast-in': 'toast-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'sheet-in': 'sheet-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'swap-pulse': 'swap-pulse 1.2s ease-in-out infinite',
        'sonar': 'sonar 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
