/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain:    '#FFFFFF', // Clean white background per confirmed theme
        cardBg:    '#FFFFFF', // Crisp white card
        'brand-blue': {
          DEFAULT: '#7B1E2B', // Header & Primary maroon
          nav:     '#7B1E2B',
          primary: '#7B1E2B',
          hover:   '#631722', // Deeper maroon
          light:   '#FDF8F8',
          surface: '#F9F1F2',
        },
        'brand-gold': {
          DEFAULT: '#C9A24B', // Button & Accent gold
          rich:    '#C9A24B',
          hover:   '#B8913E',
          deep:    '#A68233', // Deep Metallic Gold (Text & Borders)
          glow:    '#FFF9ED', // Soft Gold Highlight / Glow
        },
        brand: {
          primary:    '#7B1E2B',
          accent:     '#C9A24B',
          maroon:     '#7B1E2B',
          blue:       '#7B1E2B',
          blueHover:  '#631722',
          blueLight:  '#FDF8F8',
          gold:       '#C9A24B',
          goldHover:  '#B8913E',
          goldDeep:   '#A68233',
          goldLight:  '#FFF9ED',
          goldBorder: '#C9A24B',
          black:      '#222222', // Main text
          dark:       '#111111',
        },
        gold: {
          DEFAULT: '#C9A24B',
          dark:    '#A68233',
          light:   '#FFF9ED',
          border:  '#E5CD94',
        },
        maroon: {
          DEFAULT: '#7B1E2B',
          dark:    '#631722',
          light:   '#FDF8F8',
          hover:   '#631722',
        },
        textMain:  '#222222', // Confirmed Main text
        textMuted: '#666666', // Slate/neutral 600
        borderLight: '#F3F4F6', // Card borders
      },
      fontFamily: {
        sans:      ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'system-ui', '-apple-system', 'sans-serif'],
        dmsans:    ['"DM Sans"', 'sans-serif'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
        outfit:    ['"Outfit"', 'sans-serif'],
        brand:     ['"Cinzel"', '"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'serif'],
        headline:  ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'sans-serif'],
      },
      boxShadow: {
        soft:   '0 1px 3px rgba(0,0,0,0.05)',
        gold:   '0 4px 20px -2px rgba(212, 175, 55, 0.25)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '10px',
        'input': '10px',
        'table': '12px',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'floatDelay': 'float 4s ease-in-out 1.5s infinite',
        'slideUp': 'slideUp 0.6s ease forwards',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
