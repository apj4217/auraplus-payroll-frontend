/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7f1657",
          rose: "#c23b53",
          orange: "#ea7317",
          amber: "#f4a53a",
          dark: "#3a2430",
          dark2: "#4a2c38",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(28, 18, 22, 0.08)",
        lift: "0 22px 60px rgba(127, 22, 87, 0.16)",
      },
    },
  },
  plugins: [],
};
