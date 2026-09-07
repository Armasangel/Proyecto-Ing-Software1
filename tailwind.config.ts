import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Fondo cálido tipo papel de recibo, no blanco frío.
        cream: {
          DEFAULT: "#FBF7EF",
          100: "#FFFDF9",
        },
        // Verde principal — heredado de la marca, menos saturado que un
        // verde "SaaS", más cercano a hoja/verdura fresca.
        market: {
          50: "#EAF3DE",
          100: "#C0DD97",
          400: "#639922",
          DEFAULT: "#4C9A2A",
          600: "#3B6D11",
          800: "#27500A",
        },
        // Mango/marigold — acentos secundarios, CTAs de "agregar".
        mango: {
          50: "#FAEEDA",
          100: "#FAC775",
          DEFAULT: "#E8A33D",
          600: "#854F0B",
        },
        // Achiote/tomate — alertas de stock bajo. Más cálido que un rojo
        // de error genérico.
        achiote: {
          50: "#FCEBEB",
          100: "#F7C1C1",
          DEFAULT: "#E1592A",
          600: "#A32D2D",
        },
        // Texto marrón-carbón cálido en vez de gris azulado (Slate).
        ink: {
          DEFAULT: "#3A332B",
          muted: "#8A8070",
          faint: "#B5AC9A",
        },
        // Sidebar (StaffShell) — se mantiene oscuro pero con tinte cálido,
        // no el slate azulado que tenían antes.
        sidebar: {
          DEFAULT: "#2A2620",
          muted: "#B5AC9A",
          hover: "rgba(76, 154, 42, 0.14)",
          active: "rgba(76, 154, 42, 0.22)",
          border: "rgba(181, 172, 154, 0.16)",
        },
      },
      fontFamily: {
        head: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        control: "12px",
      },
      boxShadow: {
        // Sombra con tinte cálido (marrón, no negro puro) — que la tarjeta
        // se sienta como papel levantado de la mesa.
        warm: "0 6px 20px rgba(80, 60, 20, 0.08)",
        "warm-lg": "0 10px 30px rgba(80, 60, 20, 0.12)",
      },
      keyframes: {
        // La firma del diseño: animación de "sello de hule" para
        // confirmaciones importantes (venta completada, pago registrado).
        stamp: {
          "0%": { transform: "scale(1.6) rotate(-8deg)", opacity: "0" },
          "60%": { transform: "scale(0.92) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "toast-in": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        stamp: "stamp 320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "toast-in": "toast-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
