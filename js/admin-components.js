// js/admin-components.js
import { escapeHtml } from './config.js';

export function renderAdminLayout(app, content) {
    const navItems = getNavItems(app);
    const user = app.user || {};
    
    return `
        <div class="admin-shell">
            <aside class="admin-sidebar">
                <div class="sidebar-brand">
                    ${app.settings?.shopName ? escapeHtml(app.settings.shopName) : 'Toko'}
                </div>
                <nav class="sidebar-nav">
                    ${navItems.map(item => `
                        <a class="nav-item ${app.currentView === item.id ? 'active' : ''}" 
                           onclick="window.adminApp.navigateTo('${item.id}')">
                            <span class="nav-icon">${item.icon}</span>
                            <span class="nav-label">${item.label}</span>
                            ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                        </a>
                    `).join('')}
                </nav>
                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <span class="user-avatar">👤</span>
                        <span class="user-email">${escapeHtml(user.email || 'Admin')}</span>
                    </div>
                    <a class="nav-item" onclick="window.open('index.html', '_blank')">
                        <span class="nav-icon">🏪</span>
                        <span class="nav-label">Lihat Toko</span>
                    </a>
                    <a class="nav-item" onclick="window.adminApp.logout()">
                        <span class="nav-icon">🚪</span>
                        <span class="nav-label">Keluar</span>
                    </a>
                </div>
            </aside>
            <main class="admin-main">
                ${content}
            </main>
        </div>
    `;
}

function getNavItems(app) {
    const pendingOrders = app.orders?.filter(o => o.status === 'Menunggu Konfirmasi' || o.status === 'Menunggu Pembayaran').length || 0;
    
    return [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'products', icon: '🛍️', label: 'Produk' },
        { id: 'orders', icon: '📦', label: 'Pesanan', badge: pendingOrders > 0 ? pendingOrders : null },
        { id: 'promos', icon: '🏷️', label: 'Promo' },
        { id: 'report', icon: '📈', label: 'Laporan' },
        { id: 'settings', icon: '⚙️', label: 'Pengaturan' }
    ];
}

export function renderLoginForm(app) {
    return `
        <div class="login-screen">
            <div class="login-box">
                <div class="login-header">
                    <div class="login-icon">🔐</div>
                    <h2>Admin Panel</h2>
                    <p>${escapeHtml(app.settings?.shopName || 'Toko Online')}</p>
                </div>
                <form id="adminLoginForm">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" required 
                               placeholder="admin@toko.com" 
                               autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" required 
                               placeholder="Password" 
                               autocomplete="current-password">
                    </div>
                    <button type="submit" class="btn btn-primary">Masuk</button>
                    <button type="button" class="btn outline" 
                            onclick="window.open('index.html', '_blank')">
                        Kembali ke Toko
                    </button>
                </form>
                <div class="login-footer">
                    <small>🔒 Session akan berakhir setelah 7 hari</small>
                </div>
            </div>
        </div>
    `;
}

export function renderModal(title, content, onClose) {
    return `
        <div class="modal-overlay" onclick="if(event.target === this) ${onClose}()">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="${onClose}()">✕</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        </div>
    `;
}

export function renderLoadingSpinner(text = 'Loading...') {
    return `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>${text}</p>
        </div>
    `;
}

export function renderEmptyState(icon, title, description, action = null) {
    return `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h3>${title}</h3>
            <p>${description}</p>
            ${action ? `<button class="btn" onclick="${action.onClick}">${action.label}</button>` : ''}
        </div>
    `;
}

export function renderPagination(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';
    
    let html = '<div class="pagination">';
    
    // Previous
    html += `<button class="page-btn" ${currentPage > 1 ? `onclick="${onPageChange}(${currentPage - 1})"` : 'disabled'}>
        ‹
    </button>`;
    
    // Page numbers
    const pages = getPageRange(currentPage, totalPages);
    pages.forEach(page => {
        if (page === '...') {
            html += `<span class="page-dots">…</span>`;
        } else {
            html += `<button class="page-btn ${page === currentPage ? 'active' : ''}" 
                            onclick="${onPageChange}(${page})">
                ${page}
            </button>`;
        }
    });
    
    // Next
    html += `<button class="page-btn" ${currentPage < totalPages ? `onclick="${onPageChange}(${currentPage + 1})"` : 'disabled'}>
        ›
    </button>`;
    
    html += '</div>';
    return html;
}

function getPageRange(current, total) {
    const pages = [];
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }

    range.forEach(i => {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    });

    return rangeWithDots;
}