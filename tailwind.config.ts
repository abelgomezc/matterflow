import type { Config } from 'tailwindcss'

// MatterFlow - Paleta oficial. (c) 2026 Abel Gomez
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mf: {
          bg: '#000004',
          particle: '#6C63FF',
          fluid: '#00C8FF',
          sand: '#D4A843',
          cloth: '#8B5CF6',
          plasma: '#C084FC',
          purple: '#6C63FF',
          cyan: '#00D4AA',
          red: '#FF4A4A',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backdropBlur: {
        glass: '14px',
      },
      boxShadow: {
        glow: '0 0 24px rgba(108,99,255,0.45)',
      },
    },
  },
  plugins: [],
} satisfies Config