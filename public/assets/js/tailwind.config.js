// tailwind.config.js
module.exports = {
    content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Core Qoleng Colors
                'quantum-black': '#0A0A0F',
                'laser-blue': '#0066FF',
                'neural-grey': '#E0E5EC',
                'build-green': '#00CC88',
                'query-purple': '#8A2BE2',
                'warning-amber': '#FFB300',

                // Dark Theme Extensions
                'dark-surface': '#151520',
                'dark-border': '#2A2A3A',
                'dark-text-secondary': '#A0A5B5',

                // Light Theme Colors
                'quantum-white': '#FBFBFF',
                'neural-charcoal': '#2A2A3A',
                'light-surface': '#FFFFFF',
                'light-border': '#E0E5EC',
                'light-text-secondary': '#5A6578',
            },
            backgroundColor: {
                'primary': 'rgb(var(--bg-primary) / <alpha-value>)',
                'surface': 'rgb(var(--bg-surface) / <alpha-value>)',
            },
            textColor: {
                'primary': 'rgb(var(--text-primary) / <alpha-value>)',
                'secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
            },
            borderColor: {
                DEFAULT: 'rgb(var(--border-color) / <alpha-value>)',
            },
            fontFamily: {
                'sans': ['SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'monospace'],
            },
            boxShadow: {
                'q-primary': '0 8px 20px rgba(0, 102, 255, 0.3)',
                'q-card': '0 8px 20px rgba(0, 0, 0, 0.1)',
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
            }
        },
    },
    plugins: [
        function ({ addBase, addComponents, theme }) {
            addBase({
                ':root': {
                    '--bg-primary': '10 10 15',
                    '--bg-surface': '21 21 32',
                    '--text-primary': '224 229 236',
                    '--text-secondary': '160 165 181',
                    '--border-color': '42 42 58',
                },
                '.light-theme': {
                    '--bg-primary': '251 251 255',
                    '--bg-surface': '255 255 255',
                    '--text-primary': '42 42 58',
                    '--text-secondary': '90 101 120',
                    '--border-color': '224 229 236',
                },
            });

            addComponents({
                '.q-card': {
                    '@apply bg-surface border border-border rounded-lg p-6': {},
                },
                '.q-alert': {
                    '@apply p-4 px-5 rounded-lg mb-5 flex items-center gap-3 border-l-4': {},
                },
                '.q-alert-success': {
                    backgroundColor: 'rgba(0, 204, 136, 0.1)',
                    borderLeftColor: '#00CC88',
                    color: '#00CC88',
                },
                '.q-alert-info': {
                    backgroundColor: 'rgba(0, 102, 255, 0.1)',
                    borderLeftColor: '#0066FF',
                    color: '#0066FF',
                },
                '.q-alert-warning': {
                    backgroundColor: 'rgba(255, 179, 0, 0.1)',
                    borderLeftColor: '#FFB300',
                    color: '#FFB300',
                },
                '.q-alert-data': {
                    backgroundColor: 'rgba(138, 43, 226, 0.1)',
                    borderLeftColor: '#8A2BE2',
                    color: '#8A2BE2',
                },
                '.q-btn': {
                    '@apply inline-flex items-center gap-2.5 py-3.5 px-7 border-none rounded-lg text-base font-semibold cursor-pointer transition-all duration-300 ease-in-out no-underline': {},
                },
                '.q-btn-primary': {
                    '@apply bg-laser-blue text-white hover:translate-y-[-2px] hover:shadow-q-primary': {},
                },
                '.q-btn-secondary': {
                    '@apply bg-transparent text-primary border border-border hover:bg-border hover:translate-y-[-2px]': {},
                },
                '.q-btn-success': {
                    '@apply bg-build-green text-white hover:translate-y-[-2px]': {},
                },
                '.q-btn-data': {
                    '@apply bg-query-purple text-white hover:translate-y-[-2px]': {},
                },
                '.q-btn-warning': {
                    '@apply bg-warning-amber text-white hover:translate-y-[-2px]': {},
                },
            });
        },
    ],
}