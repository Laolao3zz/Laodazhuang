/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}', '!./node_modules/**', '!./dist/**'],
  darkMode: 'media',
  theme: {
    extend: {},
  },
  plugins: [],
};
