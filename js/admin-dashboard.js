// js/admin-dashboard.js
import { rupiah, escapeHtml, fmtDate, CONFIG } from './config.js';

export class AdminDashboard {
    constructor(app) {
        this.app = app;
    }

    render() {
        const stats = this.app.getStats();
        const recentOrders = this.app.getRecentOrders(5);

        return `
            <div class="admin-page">
                <div class="admin-topbar">
                    <h2>📊 Dashboard</h2>
                    <div class="admin-actions">
                        <span class="last-updated">Updated: ${new Date().toLocaleString('id-ID')}</span>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="stats-grid">
                    ${this.renderStatCard('💰 Total Penjualan', rupiah(stats.totalSales), 'total-sales')}
                    ${this.renderStatCard('📦 Total Pesanan', stats.totalOrders, 'total-orders')}
                    ${this.renderStatCard('⏳ Pesanan Menunggu', stats.pendingOrders, 'pending-orders')}
                    ${this.renderStatCard('🛍️ Total Produk', stats.totalProducts, 'total-products')}
                    ${this.renderStatCard('⚠️ Stok Menipis', stats.lowStock, 'low-stock', stats.lowStock > 0 ? 'warning' : '')}
                    ${this.renderStatCard('🚫 Stok Habis', stats.outStock, 'out-stock', stats.outStock > 0 ? 'danger' : '')}
                </div>

                <!-- Recent Orders -->
                <div class="admin-section">
                    <div class="section-header">
                        <h3>📋 Pesanan Terbaru</h3>
                        <button class="btn sm outline" onclick="window.adminApp.navigateTo('orders')">Lihat Semua →</button>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Pembeli</th>
                                    <th>Barang</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentOrders.length ? recentOrders.map(o => `
                                    <tr>
                                        <td>${fmtDate(o.createdAt)}</td>
                                        <td>${escapeHtml(o.customer?.nama)}</td>
                                        <td>${o.items?.map(it => `${it.qty}x ${escapeHtml(it.name)}`).join(', ') || '-'}</td>
                                        <td class="mono">${rupiah(o.total)}</td>
                                        <td><span class="badge ${CONFIG.STATUS_CLASS[o.status] || 'wait'}">${o.status}</span></td>
                                        <td>
                                            <button class="icon-btn" onclick="window.adminApp.ordersModule.viewDetail('${o.id}')" title="Lihat Detail">🔎</button>
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6" style="text-align:center;color:var(--muted);padding:30px;">
                                            Belum ada pesanan
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="admin-section">
                    <div class="section-header">
                        <h3>⚡ Quick Actions</h3>
                    </div>
                    <div class="quick-actions">
                        <button class="quick-action" onclick="window.adminApp.navigateTo('products')">
                            <span class="icon">➕</span>
                            <span>Tambah Produk</span>
                        </button>
                        <button class="quick-action" onclick="window.adminApp.navigateTo('promos')">
                            <span class="icon">🏷️</span>
                            <span>Buat Promo</span>
                        </button>
                        <button class="quick-action" onclick="window.adminApp.navigateTo('orders')">
                            <span class="icon">📦</span>
                            <span>Kelola Pesanan</span>
                        </button>
                        <button class="quick-action" onclick="window.adminApp.navigateTo('report')">
                            <span class="icon">📈</span>
                            <span>Lihat Laporan</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderStatCard(label, value, id, className = '') {
        return `
            <div class="stat-card ${className}" id="stat-${id}">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${label}</div>
            </div>
        `;
    }
}
