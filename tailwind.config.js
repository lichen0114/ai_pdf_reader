/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'provider-local': '#22c55e',
        'provider-cloud': '#3b82f6',
      }
    },
  },
  plugins: [],
}
