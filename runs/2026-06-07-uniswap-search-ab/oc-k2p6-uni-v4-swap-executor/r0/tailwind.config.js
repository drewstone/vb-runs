/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        defi: {
          bg: '#0B0E14',
          card: '#131821',
          border: '#1E293B',
          accent: '#3B82F6',
          accentHover: '#2563EB',
          success: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B',
          text: '#F8FAFC',
          textSecondary: '#94A3B8',
          textMuted: '#64748B'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      }
    },
  },
  plugins: [],
}
