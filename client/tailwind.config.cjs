/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tag: {
          red: "#cb3127",
          gray: "#727071",
          dark: "#1B2430"
        }
      }
    }
  },
  plugins: []
};
