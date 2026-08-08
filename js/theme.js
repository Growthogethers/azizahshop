// js/theme.js
export class ThemeManager {
    static init() {
        try {
            const theme = localStorage.getItem('theme') || 'light';
            this.setTheme(theme);
            this.addToggleButton();
        } catch (error) {
            console.warn('Theme init error:', error);
        }
    }
    
    static toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
    }
    
    static setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
            toggleBtn.title = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
        }
        
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = theme === 'dark' ? '#1a1a1a' : '#1F4D3D';
        }
    }
    
    static addToggleButton() {
        if (document.getElementById('themeToggle')) return;
        
        const btn = document.createElement('button');
        btn.id = 'themeToggle';
        btn.className = 'theme-toggle';
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
    }
}