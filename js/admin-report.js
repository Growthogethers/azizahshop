// js/admin-report.js
import { rupiah, escapeHtml, fmtDate } from './config.js';
import { Notification } from './notification.js';

export class AdminReport {
    constructor(app) {
        this.app = app;
        this.dateRange = {
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10)
        };
        this.salesChart = null;
    }

    render() {
        const stats = this.getReportStats();
        const topProducts = this.getTopProducts();
        const salesData = this.getSalesData();

        return `
            <div class="admin-page">
                <div class="admin-topbar">
                    <h2>📈 Laporan</h2>
                    <div class="report-actions">
                        <button class="btn sm outline" onclick="window.adminApp.reportModule.exportCSV()">
                            ⬇ Export CSV
                        </button>
                        <button class="btn sm outline" onclick="window.adminApp.reportModule.printReport()">
                            🖨️ Print
                        </button>
                    </div>
                </div>

                <!-- Date Range Filter -->
                <div class="report-filters">
                    <div class="filter-group">
                        <label>Dari Tanggal</label>
                        <input type="date" value="${this.dateRange.from}" 
                               onchange="window.adminApp.reportModule.setDateRange(this.value, 'from')">
                    </div>
                    <div class="filter-group">
                        <label>Sampai Tanggal</label>
                        <input type="date" value="${this.dateRange.to}" 
                               onchange="window.adminApp.reportModule.setDateRange(this.value, 'to')">
                    </div>
                    <button class="btn sm" onclick="window.adminApp.reportModule.updateReport()">
                        🔄 Update
                    </button>
                </div>

                <!-- Summary Stats -->
                <div class="stats-grid">
                    <div class="stat-card primary">
                        <div class="stat-value">${rupiah(stats.totalSales)}</div>
                        <div class="stat-label">💰 Total Penjualan</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.totalOrders}</div>
                        <div class="stat-label">📦 Jumlah Pesanan</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.averageOrder}</div>
                        <div class="stat-label">📊 Rata-rata Pesanan</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.totalItems}</div>
                        <div class="stat-label">🛒 Total Item Terjual</div>
                    </div>
                </div>

                <!-- Charts -->
                <div class="chart-container">
                    <h4>📊 Grafik Penjualan</h4>
                    <div class="chart-wrapper" style="position:relative;height:300px;">
                        <canvas id="salesChart"></canvas>
                        <div id="chartNoData" style="display:${salesData.length ? 'none' : 'flex'};position:absolute;top:0;left:0;width:100%;height:100%;align-items:center;justify-content:center;color:var(--muted);flex-direction:column;">
                            <div style="font-size:40px;margin-bottom:10px;">📊</div>
                            <p>Tidak ada data untuk ditampilkan</p>
                        </div>
                    </div>
                </div>

                <!-- Top Products -->
                <div class="admin-section">
                    <div class="section-header">
                        <h3>🏆 Produk Terlaris</h3>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Produk</th>
                                    <th>Jumlah Terjual</th>
                                    <th>Total Pendapatan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topProducts.length ? topProducts.map((p, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${escapeHtml(p.name)}</td>
                                        <td>${p.totalSold}</td>
                                        <td class="mono">${rupiah(p.totalRevenue)}</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="4" style="text-align:center;color:var(--muted);padding:30px;">
                                            Tidak ada data penjualan
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Daily Sales -->
                <div class="admin-section">
                    <div class="section-header">
                        <h3>📅 Penjualan Harian</h3>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Jumlah Pesanan</th>
                                    <th>Total Penjualan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${salesData.length ? salesData.map(d => `
                                    <tr>
                                        <td>${fmtDate(d.date)}</td>
                                        <td>${d.count}</td>
                                        <td class="mono">${rupiah(d.total)}</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="3" style="text-align:center;color:var(--muted);padding:30px;">
                                            Tidak ada data
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // GET REPORT STATS
    // ==========================================
    getReportStats() {
        const orders = this.getFilteredOrders();
        const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
        const totalItems = orders.reduce((s, o) => s + (o.items?.reduce((a, i) => a + i.qty, 0) || 0), 0);
        
        return {
            totalSales,
            totalOrders: orders.length,
            averageOrder: orders.length ? rupiah(totalSales / orders.length) : 'Rp0',
            totalItems
        };
    }

    getTopProducts(limit = 10) {
        const orders = this.getFilteredOrders();
        const productSales = {};
        
        orders.forEach(o => {
            o.items?.forEach(item => {
                if (!productSales[item.name]) {
                    productSales[item.name] = {
                        name: item.name,
                        totalSold: 0,
                        totalRevenue: 0
                    };
                }
                productSales[item.name].totalSold += item.qty;
                productSales[item.name].totalRevenue += item.subtotal || 0;
            });
        });

        return Object.values(productSales)
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, limit);
    }

    getSalesData() {
        const orders = this.getFilteredOrders();
        const dailySales = {};
        
        orders.forEach(o => {
            const date = o.createdAt?.toDate?.() || new Date(o.createdAt);
            const key = date.toISOString().slice(0, 10);
            if (!dailySales[key]) {
                dailySales[key] = { date: key, count: 0, total: 0 };
            }
            dailySales[key].count += 1;
            dailySales[key].total += o.total || 0;
        });

        return Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date));
    }

    getFilteredOrders() {
        const from = new Date(this.dateRange.from);
        const to = new Date(this.dateRange.to);
        to.setHours(23, 59, 59, 999);

        return (this.app.orders || []).filter(o => {
            const date = o.createdAt?.toDate?.() || new Date(o.createdAt);
            return date >= from && date <= to && o.status !== 'Dibatalkan';
        });
    }

    setDateRange(value, type) {
        if (type === 'from') {
            this.dateRange.from = value;
        } else {
            this.dateRange.to = value;
        }
    }

    updateReport() {
        // Destroy existing chart
        if (this.salesChart) {
            this.salesChart.destroy();
            this.salesChart = null;
        }
        this.app.render();
        setTimeout(() => this.renderChart(), 100);
    }

    // ==========================================
    // RENDER CHART - PERBAIKAN
    // ==========================================
    renderChart() {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const salesData = this.getSalesData();
        if (salesData.length === 0) {
            const noData = document.getElementById('chartNoData');
            if (noData) noData.style.display = 'flex';
            return;
        }

        // Hide no data message
        const noData = document.getElementById('chartNoData');
        if (noData) noData.style.display = 'none';

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('⚠️ Chart.js not loaded, loading dynamically...');
            this.loadChartLibrary().then(() => this.renderChart());
            return;
        }

        try {
            const ctx = canvas.getContext('2d');
            
            // Destroy existing chart
            if (this.salesChart) {
                this.salesChart.destroy();
            }

            // Prepare data
            const dates = salesData.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            });

            const totals = salesData.map(d => d.total);

            // Create chart
            this.salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Penjualan (Rp)',
                        data: totals,
                        borderColor: '#1F4D3D',
                        backgroundColor: 'rgba(31, 77, 61, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#1F4D3D',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return 'Rp' + context.parsed.y.toLocaleString('id-ID');
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return 'Rp' + value.toLocaleString('id-ID');
                                }
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });

            console.log('✅ Chart rendered successfully');

        } catch (error) {
            console.error('❌ Chart render error:', error);
        }
    }

    // ==========================================
    // LOAD CHART LIBRARY
    // ==========================================
    loadChartLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ==========================================
    // EXPORT & PRINT
    // ==========================================
    exportCSV() {
        const orders = this.getFilteredOrders();
        if (!orders.length) {
            Notification.warning('Tidak ada data untuk diexport');
            return;
        }

        let csv = 'Tanggal,Nama Pembeli,Alamat,Kurir,Item,Total,Status\n';
        orders.forEach(o => {
            const items = o.items?.map(i => `${i.qty}x ${i.name}`).join(' | ') || '';
            csv += [
                fmtDate(o.createdAt),
                o.customer?.nama || '',
                o.customer?.alamat || '',
                o.customer?.opsi || '',
                items,
                o.total || 0,
                o.status || ''
            ].map(v => `"${v}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `laporan-${this.dateRange.from}_${this.dateRange.to}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        Notification.success('CSV berhasil diexport');
    }

    printReport() {
        window.print();
    }
}
