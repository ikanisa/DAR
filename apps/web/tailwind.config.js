/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                midnight: "#1A1A2E",
                glass: {
                    bg: "rgba(0,0,0,0.40)",
                    border: "rgba(255,255,255,0.12)",
                },
                clay: {
                    card: "#16213E",
                    action: "#FF6B6B"
                },
                text: {
                    primary: "#F8F8F8",
                    muted: "rgba(248,248,248,0.72)",
                    secondary: "rgba(248,248,248,0.60)"
                },
                status: {
                    pending: "#FFCC00",
                    ready: "#00E676"
                }
            },
            borderRadius: {
                'clay': '28px',
                '3xl': '28px',
            },
            boxShadow: {
                // Clay shadows
                'clay': "0 18px 40px rgba(0,0,0,0.55)",
                'clay-drop': "0 18px 40px rgba(0,0,0,0.55)",
                'clay-inset': "inset 10px 10px 18px rgba(255,255,255,0.06), inset -12px -12px 18px rgba(0,0,0,0.35)",
                'clay-full': "0 18px 40px rgba(0,0,0,0.55), inset 10px 10px 18px rgba(255,255,255,0.06), inset -12px -12px 18px rgba(0,0,0,0.35)",
                // Glass shadows
                'glass': "0 14px 40px rgba(0,0,0,0.45)",
                // Focus ring
                'focus-ring': "0 0 0 3px rgba(255,107,107,0.5)",
            },
            backdropBlur: {
                'glass': '18px',
            },
            spacing: {
                'bento-gap': '14px',
            },
            minHeight: {
                'card': '120px',
            },
            transitionTimingFunction: {
                'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
            },
            transitionDuration: {
                'fast': '150ms',
                'normal': '200ms',
                'slow': '300ms',
            },
            animation: {
                'fade-in': 'fadeIn 0.2s ease-out',
                'slide-up': 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'squish': 'squish 0.15s ease-out',
                'bounce-gentle': 'bounceGentle 0.6s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(100%)' },
                    '100%': { transform: 'translateY(0)' },
                },
                squish: {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(0.96)' },
                    '100%': { transform: 'scale(1)' },
                },
                bounceGentle: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-4px)' },
                },
            },
        },
    },
    plugins: [],
}
