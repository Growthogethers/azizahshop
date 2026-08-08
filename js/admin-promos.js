// js/admin-promos.js
import { Notification } from './notification.js';
import { rupiah, escapeHtml, fmtDate } from './config.js';
import { PromoManager } from './promo.js';
import { Analytics } from './analytics.js';
import { ErrorTracker } from './error-tracking.js';

export class AdminPromos {
    constructor(app) {
        this.app = app;
        this.editingPromo = null;
    }

    render() {
        const promos = this.app.promos || [];

        return `
            <div class="admin-page">
                <div class="admin-topbar">
                    <h2>🏷️ Manajemen Promo</h2>
                    <button class="btn" onclick="window.adminApp.promosModule.openEdit()">
                        + Tambah Promo
                    </button>
                </div>

                <!-- Promo Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${promos.length}</div>
                        <div class="stat-label">Total Promo</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${promos.filter(p => p.active).length}</div>
                        <div class="stat-label">Promo Aktif</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${promos.filter(p => !p.active).length}</div>
                        <div class="stat-label">Promo Nonaktif</div>
                    </div>
                </div>

                <!-- Promos Table -->
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Jenis</th>
                                <th>Nilai</th>
                                <th>Min. Belanja</th>
                                <th>Periode</th>
                                <th>Penggunaan</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${promos.length ? promos.map(p => `
                                <tr>
                                    <td><strong>${escapeHtml(p.code)}</strong></td>
                                    <td>${p.type === 'percentage' ? 'Persentase' : 'Nominal'}</td>
                                    <td>${p.type === 'percentage' ? p.value + '%' : rupiah(p.value)}</td>
                                    <td>${p.minPurchase ? rupiah(p.minPurchase) : '-'}</td>
                                    <td>
                                        <small>${fmtDate(p.startDate)} - ${fmtDate(p.endDate)}</small>
                                    </td>
                                    <td>${p.usedCount || 0}${p.maxUses ? '/' + p.maxUses : ''}</td>
                                    <td>
                                        <span class="badge ${p.active ? 'done' : 'cancel'}">
                                            ${p.active ? '✅ Aktif' : '❌ Nonaktif'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="icon-btn" onclick="window.adminApp.promosModule.toggleStatus('${p.id}')" title="Toggle">
                                            ${p.active ? '⏸️' : '▶️'}
                                        </button>
                                        <button class="icon-btn danger" onclick="window.adminApp.promosModule.deletePromo('${p.id}')" title="Hapus">
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="8" style="text-align:center;color:var(--muted);padding:40px;">
                                        <div style="font-size:40px;margin-bottom:10px;">🏷️</div>
                                        Belum ada promo. Klik "Tambah Promo" untuk membuat.
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Edit Modal -->
            ${this.editingPromo ? this.renderEditModal() : ''}
        `;
    }

    renderEditModal() {
        const p = this.editingPromo;
        const isNew = !p?.id;

        // Format dates for input
        const formatDateForInput = (date) => {
            if (!date) return '';
            if (date instanceof Date) return date.toISOString().slice(0, 10);
            if (date.toDate) return date.toDate().toISOString().slice(0, 10);
            return new Date(date).toISOString().slice(0, 10);
        };

        return `
            <div class="overlay" onclick="if(event.target.classList.contains('overlay')) window.adminApp.promosModule.closeEdit()">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${isNew ? '➕ Tambah Promo' : '✏️ Edit Promo'}</h3>
                        <button class="modal-close-btn" onclick="window.adminApp.promosModule.closeEdit()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="promoForm" onsubmit="window.adminApp.promosModule.savePromo(event)">
                            <div class="form-group">
                                <label>Kode Promo *</label>
                                <input type="text" name="code" required 
                                       value="${escapeHtml(p?.code || '')}" 
                                       placeholder="PROMO10" 
                                       style="text-transform:uppercase;">
                                <small>Gunakan huruf kapital dan angka tanpa spasi</small>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Jenis Diskon *</label>
                                    <select name="type" required>
                                        <option value="percentage" ${p?.type === 'percentage' ? 'selected' : ''}>Persentase (%)</option>
                                        <option value="nominal" ${p?.type === 'nominal' ? 'selected' : ''}>Nominal (Rp)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Nilai Diskon *</label>
                                    <input type="number" name="value" required min="0" 
                                           value="${p?.value || 0}" 
                                           placeholder="10">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Minimal Pembelian</label>
                                    <input type="number" name="minPurchase" min="0" 
                                           value="${p?.minPurchase || 0}" 
                                           placeholder="0 (tanpa minimal)">
                                </div>
                                <div class="form-group">
                                    <label>Maksimal Diskon</label>
                                    <input type="number" name="maxDiscount" min="0" 
                                           value="${p?.maxDiscount || 0}" 
                                           placeholder="0 (tanpa batas)">
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Maksimal Penggunaan</label>
                                <input type="number" name="maxUses" min="0" 
                                       value="${p?.maxUses || 0}" 
                                       placeholder="0 (tanpa batas)">
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Tanggal Mulai *</label>
                                    <input type="date" name="startDate" required 
                                           value="${formatDateForInput(p?.startDate)}">
                                </div>
                                <div class="form-group">
                                    <label>Tanggal Berakhir *</label>
                                    <input type="date" name="endDate" required 
                                           value="${formatDateForInput(p?.endDate)}">
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn outline" onclick="window.adminApp.promosModule.closeEdit()">
                                    Batal
                                </button>
                                <button type="submit" class="btn">
                                    ${isNew ? 'Buat Promo' : 'Update Promo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    // Promo Operations
    openEdit(promoId = null) {
        if (promoId) {
            const promo = this.app.promos?.find(p => p.id === promoId);
            if (promo) {
                this.editingPromo = { ...promo };
                // Pastikan tanggal dalam format yang benar
                if (promo.startDate?.toDate) {
                    this.editingPromo.startDate = promo.startDate.toDate();
                }
                if (promo.endDate?.toDate) {
                    this.editingPromo.endDate = promo.endDate.toDate();
                }
            }
        } else {
            const now = new Date();
            const future = new Date(now);
            future.setDate(future.getDate() + 30);

            this.editingPromo = {
                id: null,
                code: '',
                type: 'percentage',
                value: 0,
                minPurchase: 0,
                maxDiscount: 0,
                maxUses: 0,
                startDate: now,
                endDate: future
            };
        }
        this.app.render();
    }

    closeEdit() {
        this.editingPromo = null;
        this.app.render();
    }

    // js/admin-promos.js - Bagian savePromo

    async savePromo(event) {
        event.preventDefault();
        const form = event.target;

        const data = {
            code: form.code.value.trim().toUpperCase(),
            type: form.type.value,
            value: Number(form.value.value),
            minPurchase: Number(form.minPurchase.value) || 0,
            maxDiscount: Number(form.maxDiscount.value) || 0,
            maxUses: Number(form.maxUses.value) || 0,
            startDate: new Date(form.startDate.value),
            endDate: new Date(form.endDate.value)
        };

        // Validate
        if (!data.code) {
            Notification.error('Kode promo harus diisi');
            return;
        }

        if (data.value <= 0) {
            Notification.error('Nilai diskon harus lebih dari 0');
            return;
        }

        // Validasi tambahan untuk diskon nominal
        if (data.type === 'nominal' && data.maxDiscount > 0) {
            Notification.warning('Max discount tidak berlaku untuk diskon nominal');
            data.maxDiscount = 0;
        }

        if (data.startDate >= data.endDate) {
            Notification.error('Tanggal mulai harus sebelum tanggal berakhir');
            return;
        }

        // Validasi minPurchase tidak boleh lebih besar dari nilai diskon untuk nominal
        if (data.type === 'nominal' && data.minPurchase > 0 && data.minPurchase < data.value) {
            Notification.warning('Minimal pembelian sebaiknya lebih besar dari nilai diskon');
        }

        try {
            // Jika edit, update existing
            if (this.editingPromo?.id) {
                await db.collection('promos').doc(this.editingPromo.id).update({
                    ...data,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                Notification.success('Promo berhasil diperbarui');
            } else {
                // Create new promo
                await PromoManager.createPromo(data);
                Notification.success('Promo berhasil dibuat');
            }

            Analytics.trackEvent('promo_created', { code: data.code });

            // Reload promos
            await this.app.loadPromos();
            this.closeEdit();
        } catch (error) {
            console.error('Save promo error:', error);
            Notification.error(error.message || 'Gagal menyimpan promo');
            ErrorTracker.logError(error);
        }
    }

    async toggleStatus(promoId) {
        try {
            const promo = this.app.promos?.find(p => p.id === promoId);
            if (!promo) return;

            await PromoManager.togglePromo(promoId, !promo.active);

            Notification.success(`Promo ${promo.active ? 'dinonaktifkan' : 'diaktifkan'}`);
            await this.app.loadPromos();
            this.app.render();
        } catch (error) {
            console.error('Toggle promo error:', error);
            Notification.error('Gagal mengubah status promo');
            ErrorTracker.logError(error);
        }
    }

    async deletePromo(promoId) {
        if (!confirm('Apakah Anda yakin ingin menghapus promo ini?')) return;

        try {
            await PromoManager.deletePromo(promoId);
            Notification.success('Promo berhasil dihapus');
            Analytics.trackEvent('promo_deleted', { promoId });
            await this.app.loadPromos();
            this.app.render();
        } catch (error) {
            console.error('Delete promo error:', error);
            Notification.error('Gagal menghapus promo');
            ErrorTracker.logError(error);
        }
    }
}