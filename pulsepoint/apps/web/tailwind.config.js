/** PulsePoint dashboard — dark-mode-only brand theme (see docs/brand-ui.md). */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans"', 'system-ui', 'sans-serif']
      },
      colors: {
        // Full brand scales
        'ink-black': {
          50: '#e8eefd', 100: '#d1ddfa', 200: '#a3bbf5', 300: '#759af0', 400: '#4678ec',
          500: '#1856e7', 600: '#1345b9', 700: '#0f348a', 800: '#0a225c', 900: '#05112e', 950: '#030c20'
        },
        'mint-cream': {
          50: '#e5ffef', 100: '#ccffdf', 200: '#99ffbe', 300: '#66ff9e', 400: '#33ff7e',
          500: '#00ff5e', 600: '#00cc4b', 700: '#009938', 800: '#006625', 900: '#003313', 950: '#00240d'
        },
        'cotton-rose': {
          50: '#fde7e9', 100: '#fccfd3', 200: '#f8a0a7', 300: '#f5707b', 400: '#f2404f',
          500: '#ee1123', 600: '#bf0d1c', 700: '#8f0a15', 800: '#5f070e', 900: '#300307', 950: '#210205'
        },
        // Dark-mode semantic tokens (mapped from brand-ui.md)
        background: '#030c20',
        elevated: '#05112e',
        card: '#0a225c',
        'card-foreground': '#e8eefd',
        border: '#0f348a',
        input: '#0f348a',
        foreground: '#e8eefd',
        muted: '#05112e',
        'muted-foreground': '#8ea7df',
        primary: { DEFAULT: '#4678ec', hover: '#1856e7', foreground: '#f4f7ff' },
        ring: '#4678ec',
        success: { DEFAULT: '#33ff7e', foreground: '#00240d' },
        destructive: { DEFAULT: '#f2404f', foreground: '#fde7e9' }
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.15', fontWeight: '700' }],
        h1: ['24px', { lineHeight: '1.25', fontWeight: '600' }],
        h2: ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.55' }],
        'body-lg': ['16px', { lineHeight: '1.5' }],
        label: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '1.4' }],
        code: ['13px', { lineHeight: '1.5' }]
      },
      borderRadius: { lg: '10px', md: '8px', sm: '6px' }
    }
  },
  plugins: []
};
