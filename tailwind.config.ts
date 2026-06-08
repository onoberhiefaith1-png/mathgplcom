import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
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
        sky: {
          top: "hsl(var(--sky-top))",
          mid: "hsl(var(--sky-mid))",
          warm: "hsl(var(--sky-warm))",
        },
        academy: {
          glow: "hsl(var(--academy-glow))",
          blue: "hsl(var(--academy-blue-glow))",
          floor: "hsl(var(--floor))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "tile-pop": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "wallet-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.25)", color: "hsl(var(--primary))" },
        },
        "bomb-pulse": {
          "0%, 100%": { transform: "scale(1) rotate(-3deg)", filter: "drop-shadow(0 0 0 hsl(var(--destructive)))" },
          "50%": { transform: "scale(1.12) rotate(3deg)", filter: "drop-shadow(0 0 6px hsl(var(--destructive)))" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" },
        },
        "gate-open-left": {
          "0%": { transform: "perspective(900px) rotateY(0deg)" },
          "100%": { transform: "perspective(900px) rotateY(-105deg)" },
        },
        "gate-open-right": {
          "0%": { transform: "perspective(900px) rotateY(0deg)" },
          "100%": { transform: "perspective(900px) rotateY(105deg)" },
        },
        "treasure-glow": {
          "0%, 100%": { boxShadow: "0 0 0 hsl(var(--primary)/0)" },
          "50%": { boxShadow: "0 0 60px hsl(48 100% 60% / 0.7)" },
        },
        "flow-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "30%": { opacity: "0.5" },
          "70%": { opacity: "0.5" },
          "100%": { transform: "translateY(2000%)", opacity: "0" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "collapse-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.5)", opacity: "0" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "tile-pop": "tile-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "wallet-pulse": "wallet-pulse 0.4s ease-out",
        "bomb-pulse": "bomb-pulse 1.2s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out",
        "gate-open-left": "gate-open-left 0.7s cubic-bezier(0.6,0,0.4,1) forwards",
        "gate-open-right": "gate-open-right 0.7s cubic-bezier(0.6,0,0.4,1) forwards",
        "treasure-glow": "treasure-glow 1s ease-in-out",
        "flow-down": "flow-down 7s linear infinite",
        "pop-in": "pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "collapse-out": "collapse-out 0.35s ease-in forwards",
        "soft-pulse": "soft-pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
