/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // FXReplay Pro dark palette
        panel: '#0f1118',
        'panel-alt': '#161a25',
        'panel-hover': '#1e2230',
        border: '#1e2230',
        muted: '#6b6f7b',
        up: '#22c55e',
        'up-soft': 'rgba(34,197,94,0.12)',
        down: '#ef4444',
        'down-soft': 'rgba(239,68,68,0.12)',
        accent: '#2962ff',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
};
