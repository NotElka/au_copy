/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-light': '#EFF6FF',
        'dark-blue': '#1E3A5F',
        muted: '#334155',
        'border-color': '#E2E8F0',
        'kaspi-red': '#E83232',
        'kaspi-light': '#FFF0F0',
      },
      fontFamily: {
        sans: ['Rubik', 'sans-serif'],
        rubik: ['Rubik', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
