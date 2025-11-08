/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme base colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // INAV-inspired colors
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Status colors
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        error: 'hsl(var(--error))',
        info: 'hsl(var(--info))',

        // Health status colors
        health: {
          ok: '#22c55e',      // green-500
          warn: '#f59e0b',    // amber-500
          error: '#ef4444',   // red-500
          off: '#6b7280',     // gray-500
          init: '#3b82f6',    // blue-500
          sim: '#a855f7',     // purple-500
        },

        // Glow colors
        glow: {
          blue: '#3b82f6',
          green: '#22c55e',
          cyan: '#06b6d4',
          purple: '#a855f7',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 5px currentColor',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 15px currentColor',
          },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 10px currentColor',
        'glow-lg': '0 0 20px currentColor',
      },
    },
  },
  plugins: [],
}