// tailwind.config.js
module.exports = {
    content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
    darkMode: 'class', // Use class-based dark mode
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
                primary: 'var(--bg-primary)',
                surface: 'var(--bg-surface)',
            },
            textColor: {
                primary: 'var(--text-primary)',
                secondary: 'var(--text-secondary)',
            },
            borderColor: {
                DEFAULT: 'var(--border-color)',
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
                    '--bg-primary': theme('colors.quantum-black'),
                    '--bg-surface': theme('colors.dark-surface'),
                    '--text-primary': theme('colors.neural-grey'),
                    '--text-secondary': theme('colors.dark-text-secondary'),
                    '--border-color': theme('colors.dark-border'),
                },
                '.light-theme': {
                    '--bg-primary': theme('colors.quantum-white'),
                    '--bg-surface': theme('colors.light-surface'),
                    '--text-primary': theme('colors.neural-charcoal'),
                    '--text-secondary': theme('colors.light-text-secondary'),
                    '--border-color': theme('colors.light-border'),
                },
            });

            addComponents({
                '.q-card': {
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                },
                '.q-alert': {
                    padding: '1rem 1.25rem',
                    borderRadius: '6px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderLeft: '4px solid',
                },
                '.q-alert-success': {
                    backgroundColor: 'rgba(0, 204, 136, 0.1)',
                    borderLeftColor: 'theme(colors.build-green)',
                    color: 'theme(colors.build-green)',
                },
                '.q-alert-info': {
                    backgroundColor: 'rgba(0, 102, 255, 0.1)',
                    borderLeftColor: 'theme(colors.laser-blue)',
                    color: 'theme(colors.laser-blue)',
                },
                '.q-alert-warning': {
                    backgroundColor: 'rgba(255, 179, 0, 0.1)',
                    borderLeftColor: 'theme(colors.warning-amber)',
                    color: 'theme(colors.warning-amber)',
                },
                '.q-alert-data': {
                    backgroundColor: 'rgba(138, 43, 226, 0.1)',
                    borderLeftColor: 'theme(colors.query-purple)',
                    color: 'theme(colors.query-purple)',
                },
                '.q-btn': {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.875rem 1.75rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textDecoration: 'none',
                },
                '.q-btn-primary': {
                    backgroundColor: 'theme(colors.laser-blue)',
                    color: 'white',
                },
                '.q-btn-primary:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(0, 102, 255, 0.3)',
                },
                '.q-btn-secondary': {
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                },
                '.q-btn-secondary:hover': {
                    backgroundColor: 'var(--border-color)',
                    transform: 'translateY(-2px)',
                },
            });
        },
    ],
}