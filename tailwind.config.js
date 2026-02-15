/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // macOS-inspired neutral palette
                'mac': {
                    'bg-light': '#f5f5f7',
                    'bg-light-secondary': '#ffffff',
                    'bg-dark': '#1d1d1f',
                    'bg-dark-secondary': '#424245',
                    'text-primary-light': '#1d1d1f',
                    'text-secondary-light': '#86868b',
                    'text-primary-dark': '#f5f5f7',
                    'text-secondary-dark': '#a1a1a6',
                    'accent': '#0071e3',
                    'accent-green': '#34c759',
                },
                // Legacy corporate palette (still used for accents)
                'navy': {
                    50: '#e7e9ef',
                    100: '#c3c8d7',
                    200: '#9ba4bc',
                    300: '#7380a1',
                    400: '#55658c',
                    500: '#374a77',
                    600: '#2f406f',
                    700: '#253364',
                    800: '#1c2759',
                    900: '#0f1545',
                },
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'scale-in': 'scaleIn 0.2s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseSubtle: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                }
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
