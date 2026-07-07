/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tag: {
          red: "#D3352B",
          gray: "#6D6E71",
          dark: "#1B2430"
        }
      }
    }
  },
  plugins: []
};
