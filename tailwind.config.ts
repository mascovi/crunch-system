import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        crunch: {
          bg: '#1f140d',
          panel: '#2b1b10',
          'panel-2': '#382418',
          line: '#3d2a12',
          'line-2': '#4e3818',
          ink: '#ece7dc',
          'ink-dim': '#d8c7ae',
          'ink-mute': '#b8946b',
          accent: '#ff6a00',
          'accent-ink': '#ffffff',
        },
      },
      fontFamily: {
        geist: ['Geist', 'system-ui', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
