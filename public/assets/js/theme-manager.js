// theme-manager.js
class QolengTheme {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.addThemeToggleListener();
    }

    getStoredTheme() {
        return localStorage.getItem('qoleng-theme');
    }

    setStoredTheme(theme) {
        localStorage.setItem('qoleng-theme', theme);
    }

    applyTheme(theme) {
        const html = document.documentElement;

        if (theme === 'light') {
            html.classList.add('light-theme');
        } else {
            html.classList.remove('light-theme');
        }

        this.currentTheme = theme;
        this.setStoredTheme(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    addThemeToggleListener() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-toggle-theme]')) {
                this.toggleTheme();
            }
        });
    }
}

// Initialize theme
const themeManager = new QolengTheme();

// Export for module systems
export default themeManager;