import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      screens: {
        xs: "400px",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          container: "hsl(var(--primary-container))",
          "on-container": "hsl(var(--on-primary-container))",
        },
        "on-primary": "hsl(var(--primary-foreground))",
        "on-primary-container": "hsl(var(--on-primary-container))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: "hsl(var(--surface))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        outline: "hsl(var(--outline))",
        "outline-variant": "hsl(var(--outline-variant))",
        "on-surface-variant": "hsl(var(--on-surface-variant))",
        "surface-container-lowest": "hsl(var(--surface-container-lowest))",
        "surface-container-high": "hsl(var(--surface-container-high))",
        "inverse-surface": "hsl(var(--inverse-surface))",
        "inverse-on-surface": "hsl(var(--inverse-on-surface))",
        "inverse-primary": "hsl(var(--inverse-primary))",
        "on-secondary-container": "hsl(var(--on-secondary-container))",
        "on-tertiary-container": "hsl(var(--on-tertiary-container))",
        "on-tertiary-fixed-variant": "hsl(var(--on-tertiary-fixed-variant))",
        canvas: "hsl(var(--canvas))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Geist", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        shimmer: "shimmer 1.6s infinite linear",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
