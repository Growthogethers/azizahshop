// js/admin-orders.js - FULL
// ============================================
// ADMIN ORDERS MODULE - Refactored with fixes
// ============================================

import { Notification } from './notification.js';
import { rupiah, escapeHtml, fmtDate, CONFIG } from './config.js';
import { updateOrder } from './db.js';
import { Analytics } from './analytics.js';
import { ErrorTracker } from './error-tracking.js';

export class AdminOrders {
    constructor(app) {
        this.app = app;
        this.viewingOrderId = null;
        this.filterStatus = 'all';
        this.searchQuery = '';
        this.isUpdating = false;
    }

    // ==========================================
    // RENDER
    // ==========================================
    render() {
        const filteredOrders = this.getFilteredOrders();
        
        return `
            <div class="admin-page">
                <div class="admin-topbar">
                    <h2>📦 Manajemen Pesanan</h2>
                    <div class="order-stats">
                        <span class="stat-badge">Total: ${this.app.orders?.length || 0}</span>
                        <span class="stat-badge pending">Menunggu: ${this.getPendingCount()}</span>
                        <span class="stat-badge processing">Diproses: ${this.getProcessingCount()}</span>
                        <button class="btn sm outline" onclick="window.adminApp.forceRefreshData()" title="Refresh Data">
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                <!-- Filters -->
                <div class="admin-filters">
                    <div class="search-box">
                        <input type="text" 
                               placeholder="🔍 Cari pesanan..." 
                               value="${escapeHtml(this.searchQuery)}"
                               oninput="window.adminApp.ordersModule.searchOrders(this.value)">
                    </div>
                    <div class="filter-controls">
                        <select onchange="window.adminApp.ordersModule.filterByStatus(this.value)">
                            <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>Semua Status</option>
                            ${CONFIG.STATUS_LIST.map(s => `
                                <option value="${s}" ${this.filterStatus === s ? 'selected' : ''}>${s}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <!-- Orders Table -->
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Pembeli</th>
                                <th>Barang</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Promo</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredOrders.length ? filteredOrders.map(o => `
                                <tr>
                                    <td>${this.formatDate(o.createdAt)}</td>
                                    <td>
                                        <strong>${escapeHtml(o.customer?.nama)}</strong>
                                        <br>
                                        <small style="color:var(--muted);">${escapeHtml(o.customer?.opsi)}</small>
                                    </td>
                                    <td>
                                        ${o.items?.map(it => `${it.qty}x ${escapeHtml(it.name)}`).join(', ')}
                                    </td>
                                    <td class="mono">${rupiah(o.total)}</td>
                                    <td>
                                        <select class="status-select" 
                                                onchange="window.adminApp.ordersModule.updateStatus('${o.id}', this.value)"
                                                data-order-id="${o.id}">
                                            ${CONFIG.STATUS_LIST.map(s => `
                                                <option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>
                                            `).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        ${o.promoCode ? `<span class="badge promo">${escapeHtml(o.promoCode)}</span>` : '-'}
                                    </td>
                                    <td>
                                        <button class="icon-btn" onclick="window.adminApp.ordersModule.viewDetail('${o.id}')" title="Detail">🔎</button>
                                        <button class="icon-btn" onclick="window.adminApp.ordersModule.printInvoice('${o.id}')" title="Print">🖨️</button>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="7" style="text-align:center;color:var(--muted);padding:40px;">
                                        <div style="font-size:40px;margin-bottom:10px;">📭</div>
                                        Tidak ada pesanan
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div id="ordersPagination"></div>
            </div>

            <!-- Detail Modal -->
            ${this.viewingOrderId ? this.renderDetailModal() : ''}
        `;
    }

    // ==========================================
    // GET FILTERED ORDERS - PERBAIKAN
    // ==========================================
    getFilteredOrders() {
        // Pastikan orders ada dan array
        if (!this.app.orders || !Array.isArray(this.app.orders)) {
            console.warn('⚠️ Orders is not an array or empty');
            return [];
        }
        
        let orders = [...this.app.orders];
        console.log(`📦 Filtering ${orders.length} orders...`);
        
        // Filter by status
        if (this.filterStatus !== 'all') {
            orders = orders.filter(o => o.status === this.filterStatus);
        }
        
        // Filter by search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            orders = orders.filter(o => 
                o.customer?.nama?.toLowerCase().includes(q) ||
                o.id?.toLowerCase().includes(q) ||
                o.items?.some(i => i.name.toLowerCase().includes(q))
            );
        }
        
        // Sort by date (newest first)
        return orders.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return dateB - dateA;
        });
    }

    formatDate(date) {
        return fmtDate(date);
    }

    // ==========================================
    // RENDER DETAIL MODAL
    // ==========================================
    renderDetailModal() {
        const order = this.app.orders?.find(o => o.id === this.viewingOrderId);
        if (!order) return '';

        return `
            <div class="overlay" onclick="if(event.target.classList.contains('overlay')) window.adminApp.ordersModule.closeDetail()">
                <div class="modal modal-lg" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>📋 Detail Pesanan #${order.id.slice(0, 8)}</h3>
                        <button class="modal-close-btn" onclick="window.adminApp.ordersModule.closeDetail()">✕</button>
                    </div>
                    <div class="modal-body">
                        <!-- Customer Info -->
                        <div class="detail-section">
                            <h4>👤 Informasi Pemesan</h4>
                            <div class="detail-grid">
                                <div>
                                    <label>Nama</label>
                                    <p><strong>${escapeHtml(order.customer?.nama)}</strong></p>
                                </div>
                                <div>
                                    <label>Kurir</label>
                                    <p>${escapeHtml(order.customer?.opsi)}</p>
                                </div>
                                <div style="grid-column: 1 / -1;">
                                    <label>Alamat</label>
                                    <p>${escapeHtml(order.customer?.alamat)}</p>
                                </div>
                                ${order.customer?.keterangan ? `
                                    <div style="grid-column: 1 / -1;">
                                        <label>Catatan</label>
                                        <p>${escapeHtml(order.customer.keterangan)}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Order Items -->
                        <div class="detail-section">
                            <h4>🛒 Item Pesanan</h4>
                            <div class="detail-items">
                                ${order.items?.map(item => `
                                    <div class="detail-item">
                                        <span>${escapeHtml(item.name)}</span>
                                        <span>×${item.qty}</span>
                                        <span class="mono">${rupiah(item.subtotal)}</span>
                                    </div>
                                `).join('')}
                                ${typeof order.shippingFee === 'number' ? `
                                    <div class="detail-promo">
                                        <span>🚚 Ongkos Kirim</span>
                                        <span class="mono">${order.freeShipping ? 'GRATIS' : rupiah(order.shippingFee)}</span>
                                    </div>
                                ` : ''}
                                ${order.promoCode ? `
                                    <div class="detail-promo">
                                        <span>Promo: ${escapeHtml(order.promoCode)}</span>
                                        <span class="mono">-${rupiah(order.promoDiscount || 0)}</span>
                                    </div>
                                ` : ''}
                                <div class="detail-total">
                                    <span>Total</span>
                                    <span class="mono">${rupiah(order.total)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Status Update -->
                        <div class="detail-section">
                            <h4>📊 Status Pesanan</h4>
                            <div class="status-update">
                                <select id="detailStatusSelect" 
                                        onchange="window.adminApp.ordersModule.updateStatus('${order.id}', this.value)"
                                        data-order-id="${order.id}">
                                    ${CONFIG.STATUS_LIST.map(s => `
                                        <option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>
                                    `).join('')}
                                </select>
                                <span class="status-date">Diperbarui: ${this.formatDate(order.updatedAt)}</span>
                            </div>
                        </div>

                        <!-- History (jika ada) -->
                        ${order._history ? `
                            <div class="detail-section">
                                <h4>📜 Riwayat Status</h4>
                                <div class="history-list">
                                    ${order._history.map(h => `
                                        <div class="history-item">
                                            <span class="history-status">${h.status}</span>
                                            <span class="history-date">${this.formatDate(h.timestamp)}</span>
                                            ${h.note ? `<span class="history-note">${escapeHtml(h.note)}</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Actions -->
                        <div class="detail-actions">
                            <button class="btn outline" onclick="window.adminApp.ordersModule.printInvoice('${order.id}')">
                                🖨️ Cetak Invoice
                            </button>
                            <button class="btn outline" onclick="window.adminApp.ordersModule.closeDetail()">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // UPDATE STATUS - PERBAIKAN
    // ==========================================
    async updateStatus(orderId, status) {
        // Prevent multiple updates
        if (this.isUpdating) {
            Notification.warning('Sedang memproses update...');
            return;
        }
        
        this.isUpdating = true;
        
        try {
            console.log(`🔄 Updating order ${orderId} to status: ${status}`);
            
            // Visual feedback
            const statusSelects = document.querySelectorAll(`select[data-order-id="${orderId}"]`);
            statusSelects.forEach(select => {
                select.disabled = true;
                select.classList.add('loading');
            });
            
            // Simpan status lama untuk rollback jika gagal
            const oldOrder = this.app.orders.find(o => o.id === orderId);
            const oldStatus = oldOrder?.status;
            
            // Optimistic update - update UI first
            if (oldOrder) {
                oldOrder._oldStatus = oldStatus;
                oldOrder.status = status;
                oldOrder.updatedAt = new Date().toISOString();
                this.app.render();
            }
            
            // Update di Firestore dengan retry
            let retries = 0;
            let success = false;
            
            while (retries < 3 && !success) {
                try {
                    await updateOrder(orderId, { status });
                    success = true;
                    console.log(`✅ Order ${orderId} updated to: ${status} (attempt ${retries + 1})`);
                } catch (error) {
                    retries++;
                    console.warn(`⚠️ Retry ${retries}/3 failed:`, error.message);
                    
                    if (retries < 3) {
                        await new Promise(resolve => setTimeout(resolve, 500 * retries));
                    } else {
                        throw error;
                    }
                }
            }
            
            if (!success) {
                throw new Error('Gagal setelah 3 percobaan');
            }
            
            // Update local state dengan data dari Firestore
            const updatedOrder = await this.getOrderById(orderId);
            if (updatedOrder) {
                const index = this.app.orders.findIndex(o => o.id === orderId);
                if (index !== -1) {
                    this.app.orders[index] = updatedOrder;
                }
            }
            
            // Update badge counts
            this.app.updateBadgeCounts();
            
            // Show notification
            Notification.success(`✅ Status pesanan diperbarui menjadi "${status}"`);
            
            // Track event
            Analytics.trackEvent('order_status_updated', { 
                orderId, 
                status,
                timestamp: new Date().toISOString()
            });
            
            // Re-enable selects
            statusSelects.forEach(select => {
                select.disabled = false;
                select.classList.remove('loading');
                select.classList.add('success');
                setTimeout(() => select.classList.remove('success'), 2000);
            });
            
            // Render
            this.app.render();
            
        } catch (error) {
            console.error('❌ Update status error:', error);
            
            // Rollback to old status
            const order = this.app.orders.find(o => o.id === orderId);
            if (order && order._oldStatus) {
                order.status = order._oldStatus;
                delete order._oldStatus;
            }
            
            Notification.error('Gagal memperbarui status: ' + error.message);
            ErrorTracker.logError(error);
            
            this.app.render();
            
        } finally {
            this.isUpdating = false;
        }
    }

    // ==========================================
    // GET ORDER BY ID
    // ==========================================
    async getOrderById(orderId) {
        try {
            const doc = await db.collection('orders').doc(orderId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Get order error:', error);
            return null;
        }
    }

    // ==========================================
    // VIEW & CLOSE DETAIL
    // ==========================================
    viewDetail(orderId) {
        console.log(`🔍 Viewing order: ${orderId}`);
        this.viewingOrderId = orderId;
        
        // Cek apakah order masih ada
        const order = this.app.orders?.find(o => o.id === orderId);
        if (!order) {
            Notification.error('Pesanan tidak ditemukan');
            this.viewingOrderId = null;
            return;
        }
        
        this.app.render();
    }

    closeDetail() {
        console.log('🔒 Closing order detail');
        this.viewingOrderId = null;
        this.app.render();
    }

    // ==========================================
    // PRINT INVOICE
    // ==========================================
    printInvoice(orderId) {
        const order = this.app.orders?.find(o => o.id === orderId);
        if (!order) {
            Notification.error('Pesanan tidak ditemukan');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=600,height=600');
        if (!printWindow) {
            Notification.error('Mohon izinkan pop-up untuk mencetak');
            return;
        }

        const settings = this.app.settings || {};
        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice #${orderId.slice(0, 8)}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 600px; margin: auto; }
                        .header { text-align: center; border-bottom: 2px solid #1F4D3D; padding-bottom: 20px; }
                        .shop-name { font-size: 24px; font-weight: bold; color: #1F4D3D; }
                        .invoice-title { font-size: 18px; margin: 10px 0; }
                        .info { margin: 20px 0; }
                        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                        .items { margin: 20px 0; }
                        .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                        .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; padding: 15px 0; border-top: 2px solid #1F4D3D; margin-top: 10px; }
                        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
                        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                        .status-wait { background: #FBF0DD; color: #C97F1D; }
                        .status-process { background: #E4EEF7; color: #2C6C9E; }
                        .status-ship { background: #E9E4F7; color: #6A46B0; }
                        .status-done { background: #E2F1E5; color: #3F7D53; }
                        .status-cancel { background: #F7E4E1; color: #B84A3E; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="shop-name">${escapeHtml(settings.shopName || 'Toko Online')}</div>
                        <div class="invoice-title">INVOICE #${orderId.slice(0, 8).toUpperCase()}</div>
                        <div>Tanggal: ${this.formatDate(order.createdAt)}</div>
                        <div style="margin-top:10px;">
                            <span class="status status-${order.status.toLowerCase().replace(' ', '')}">${order.status}</span>
                        </div>
                    </div>

                    <div class="info">
                        <h4>Informasi Pemesan</h4>
                        <div class="info-row"><span>Nama</span><span>${escapeHtml(order.customer?.nama)}</span></div>
                        <div class="info-row"><span>Alamat</span><span>${escapeHtml(order.customer?.alamat)}</span></div>
                        <div class="info-row"><span>Kurir</span><span>${escapeHtml(order.customer?.opsi)}</span></div>
                        ${order.customer?.keterangan ? `<div class="info-row"><span>Catatan</span><span>${escapeHtml(order.customer.keterangan)}</span></div>` : ''}
                    </div>

                    <div class="items">
                        <h4>Item Pesanan</h4>
                        ${order.items?.map(item => `
                            <div class="item">
                                <span>${escapeHtml(item.name)} ×${item.qty}</span>
                                <span>${rupiah(item.subtotal)}</span>
                            </div>
                        `).join('')}
                        <div class="total">
                            <span>Total</span>
                            <span>${rupiah(order.total)}</span>
                        </div>
                        ${typeof order.shippingFee === 'number' ? `
                            <div style="display:flex;justify-content:space-between;color:#666;font-size:14px;margin-top:5px;">
                                <span>🚚 Ongkos Kirim</span>
                                <span>${order.freeShipping ? 'GRATIS' : rupiah(order.shippingFee)}</span>
                            </div>
                        ` : ''}
                        ${order.promoCode ? `
                            <div style="display:flex;justify-content:space-between;color:#666;font-size:14px;margin-top:5px;">
                                <span>Promo: ${escapeHtml(order.promoCode)}</span>
                                <span>-${rupiah(order.promoDiscount || 0)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <div class="footer">
                        <p>Terima kasih telah berbelanja di ${escapeHtml(settings.shopName || 'Toko Online')}</p>
                        <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    // ==========================================
    // FILTER METHODS
    // ==========================================
    searchOrders(query) {
        this.searchQuery = query;
        this.app.render();
    }

    filterByStatus(status) {
        this.filterStatus = status;
        this.app.render();
    }

    getPendingCount() {
        return this.app.orders?.filter(o => o.status === 'Menunggu Konfirmasi' || o.status === 'Menunggu Pembayaran').length || 0;
    }

    getProcessingCount() {
        return this.app.orders?.filter(o => o.status === 'Diproses').length || 0;
    }
}
