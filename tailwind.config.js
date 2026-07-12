/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Trading terminal palette
        panel: '#131722',
        'panel-alt': '#1e222d',
        'panel-hover': '#2a2e39',
        border: '#2a2e39',
        muted: '#787b86',
        up: '#26a69a',
        'up-soft': 'rgba(38,166,154,0.15)',
        down: '#ef5350',
        'down-soft': 'rgba(239,83,80,0.15)',
        accent: '#2962ff',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
};
