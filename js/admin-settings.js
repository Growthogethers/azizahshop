// js/admin-settings.js - FULL
// ============================================
// ADMIN SETTINGS MODULE - Fixed
// ============================================

import { Notification } from './notification.js';
import { rupiah, escapeHtml, fmtDate } from './config.js';
import { updateSettings, batchWrite } from './db.js';
import { Analytics } from './analytics.js';
import { ErrorTracker } from './error-tracking.js';
import { Auth } from './auth.js';
import { SessionManager } from './config.js';

export class AdminSettings {
  constructor(app) {
    this.app = app;
    this.restoreProgress = 0;
    this.isRestoring = false;
    this.syncProgress = 0;
    this.isSyncing = false;
    
    // Validation rules
    this.validationRules = {
      waNumberRegex: /^62[0-9]{10,13}$/,
      bankAccountRegex: /^[0-9]{6,20}$/,
      shopNameMaxLength: 50,
      taglineMaxLength: 100
    };
  }

  // ==========================================
  // RENDER
  // ==========================================
  render() {
    const s = this.app.settings || {};
    const user = this.app.user || {};

    return `
      <div class="admin-page">
        <div class="admin-topbar">
          <h2>⚙️ Pengaturan</h2>
        </div>

        <!-- Shop Settings -->
        <div class="settings-section">
          <div class="section-header">
            <h3>🏪 Info Toko & WhatsApp</h3>
          </div>
          <form id="shopSettingsForm" onsubmit="window.adminApp.settingsModule.saveShopSettings(event)">
            <div class="form-group">
              <label>Nama Toko *</label>
              <input type="text" name="shopName" required 
                     value="${escapeHtml(s.shopName || '')}" 
                     placeholder="Nama toko"
                     maxlength="${this.validationRules.shopNameMaxLength}">
              <small>Maksimal ${this.validationRules.shopNameMaxLength} karakter</small>
            </div>

            <div class="form-group">
              <label>Tagline</label>
              <input type="text" name="tagline" 
                     value="${escapeHtml(s.tagline || '')}" 
                     placeholder="Tagline toko"
                     maxlength="${this.validationRules.taglineMaxLength}">
              <small>Maksimal ${this.validationRules.taglineMaxLength} karakter</small>
            </div>

            <div class="form-group">
              <label>Nomor WhatsApp (format 62...) *</label>
              <input type="text" name="waNumber" required 
                     value="${escapeHtml(s.waNumber || '')}" 
                     placeholder="6285227601111">
              <small>Format: 62 diikuti nomor (10-13 digit)</small>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nama Bank *</label>
                <input type="text" name="bankName" required 
                       value="${escapeHtml(s.bankName || '')}" 
                       placeholder="BCA">
              </div>
              <div class="form-group">
                <label>Nomor Rekening *</label>
                <input type="text" name="bankAccount" required 
                       value="${escapeHtml(s.bankAccount || '')}" 
                       placeholder="11111111111">
                <small>6-20 digit angka</small>
              </div>
            </div>

            <div class="form-group">
              <label>Atas Nama (opsional)</label>
              <input type="text" name="accountHolder" 
                     value="${escapeHtml(s.accountHolder || '')}" 
                     placeholder="Nama pemilik rekening">
            </div>

            <div class="form-group">
              <label>Enable QRIS Payment</label>
              <select name="enableQRIS">
                <option value="true" ${s.enableQRIS !== false ? 'selected' : ''}>Ya</option>
                <option value="false" ${s.enableQRIS === false ? 'selected' : ''}>Tidak</option>
              </select>
            </div>

            <button type="submit" class="btn">💾 Simpan Pengaturan</button>
          </form>
        </div>

        <!-- Admin Account - PERBAIKAN -->
        <div class="settings-section">
          <div class="section-header">
            <h3>🔐 Akun Admin</h3>
          </div>
          <div class="admin-info">
            <div class="info-item">
              <label>Email</label>
              <p><strong>${escapeHtml(user.email || 'Belum login')}</strong></p>
              <p style="font-size:12px;color:var(--muted);">
                Email admin terautentikasi dari Firebase Authentication
              </p>
            </div>
            <div class="info-item">
              <label>UID</label>
              <p><strong>${escapeHtml(user.uid || '-')}</strong></p>
            </div>
            <div class="info-item">
              <label>Status</label>
              <p><span class="badge done">✅ Terautentikasi sebagai Admin</span></p>
            </div>
            <div class="info-item">
              <label>Session Status</label>
              <p id="sessionStatus">${this.getSessionStatus()}</p>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn sm outline" onclick="window.adminApp.settingsModule.refreshSession()">
              🔄 Refresh Session
            </button>
            <button class="btn sm danger" onclick="window.adminApp.settingsModule.logoutAllDevices()">
              🚪 Logout Semua Perangkat
            </button>
          </div>
          <p style="font-size:12px; color:var(--muted); margin-top:10px;">
            ⚠️ Untuk mengubah email/password, gunakan <strong>Firebase Console</strong> 
            di bagian Authentication. Email saat ini: <strong>${escapeHtml(user.email || 'Belum login')}</strong>
          </p>
        </div>

        <!-- Backup & Restore -->
        <div class="settings-section">
          <div class="section-header">
            <h3>📦 Backup & Restore Data</h3>
          </div>
          <p style="color:var(--muted); margin-bottom:15px;">
            Unduh cadangan seluruh data, atau pulihkan dari file cadangan.
          </p>
          <div class="backup-actions">
            <button class="btn outline" onclick="window.adminApp.settingsModule.backupData()">
              ⬇ Unduh Backup (.json)
            </button>
            <div class="upload-box" onclick="document.getElementById('restoreInput').click()">
              📂 Klik untuk pilih file backup (.json) dan pulihkan
              <input type="file" id="restoreInput" accept="application/json" 
                     style="display:none;" 
                     onchange="window.adminApp.settingsModule.restoreData(event)">
            </div>
          </div>
          
          <!-- Restore Progress -->
          <div id="restoreProgress" style="display:none;margin-top:10px;">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${this.restoreProgress}%;"></div>
            </div>
            <p id="restoreStatus" style="font-size:12px;color:var(--muted);">
              ${this.isRestoring ? 'Memulihkan data...' : 'Siap'}
            </p>
          </div>
        </div>

        <!-- Sync Data -->
        <div class="settings-section">
          <div class="section-header">
            <h3>🔄 Sinkronisasi Data ke Firebase</h3>
          </div>
          <p style="color:var(--muted); margin-bottom:15px;">
            Sinkronkan semua data lokal (produk, pesanan, promo, pengaturan) ke Firestore.<br>
            Gunakan jika ada data yang tidak tersimpan di Firebase.
          </p>
          <div class="sync-actions">
            <button class="btn" onclick="window.adminApp.settingsModule.syncData()" 
                    ${this.isSyncing ? 'disabled' : ''}>
              ${this.isSyncing ? '⏳ Menyinkronkan...' : '🔄 Sinkronkan Semua Data'}
            </button>
          </div>
          
          <!-- Sync Progress -->
          <div id="syncProgress" style="display:none;margin-top:15px;">
            <div class="progress-bar">
              <div class="progress-fill" id="syncProgressFill" style="width:0%;"></div>
            </div>
            <p id="syncStatusText" style="font-size:12px;color:var(--muted);margin-top:5px;">
              Memulai sinkronisasi...
            </p>
          </div>
        </div>

        <!-- System Info -->
        <div class="settings-section">
          <div class="section-header">
            <h3>ℹ️ Informasi Sistem</h3>
          </div>
          <div class="system-info">
            <div class="info-row">
              <span>Versi Aplikasi</span>
              <span><strong>v2.0.0</strong></span>
            </div>
            <div class="info-row">
              <span>Firebase Project</span>
              <span><strong>${escapeHtml(s.projectId || 'Tidak diketahui')}</strong></span>
            </div>
            <div class="info-row">
              <span>Total Data</span>
              <span><strong>${this.app.products.length} Produk, ${this.app.orders?.length || 0} Pesanan</strong></span>
            </div>
            <div class="info-row">
              <span>GA4 Tracking</span>
              <span><strong>${typeof gtag !== 'undefined' ? '✅ Aktif' : '❌ Tidak aktif'}</strong></span>
            </div>
            <div class="info-row">
              <span>Terakhir Diperbarui</span>
              <span><strong>${fmtDate(new Date().toISOString())}</strong></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // SESSION STATUS
  // ==========================================
  getSessionStatus() {
    const session = localStorage.getItem('userSession');
    if (!session) return '<span class="badge cancel">❌ Session tidak ditemukan</span>';
    
    try {
      const data = JSON.parse(session);
      const lastLogin = new Date(data.lastLogin);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastLogin) / (1000 * 60));
      
      if (diffMinutes < 60) {
        return `<span class="badge done">✅ Aktif (${diffMinutes} menit yang lalu)</span>`;
      } else if (diffMinutes < 1440) {
        return `<span class="badge wait">⏳ Aktif (${Math.floor(diffMinutes / 60)} jam yang lalu)</span>`;
      } else {
        return `<span class="badge cancel">⚠️ Session expired (${Math.floor(diffMinutes / 1440)} hari yang lalu)</span>`;
      }
    } catch (error) {
      return '<span class="badge cancel">❌ Session tidak valid</span>';
    }
  }

  // ==========================================
  // SETTINGS OPERATIONS
  // ==========================================
  async saveShopSettings(event) {
    event.preventDefault();
    const form = event.target;
    
    // Get form data
    const settings = {
      shopName: form.shopName.value.trim(),
      tagline: form.tagline.value.trim(),
      waNumber: form.waNumber.value.trim().replace(/[^0-9]/g, ''),
      bankName: form.bankName.value.trim(),
      bankAccount: form.bankAccount.value.trim(),
      accountHolder: form.accountHolder.value.trim(),
      enableQRIS: form.enableQRIS.value === 'true'
    };

    // Validate settings
    const validation = this.validateSettings(settings);
    if (!validation.valid) {
      Notification.error(validation.errors.join('\n'));
      return;
    }

    try {
      await updateSettings(settings);
      
      // Track settings update
      Analytics.trackSettingsUpdated(settings);
      Notification.success('Pengaturan berhasil disimpan');
      
      this.app.render();
    } catch (error) {
      console.error('Save settings error:', error);
      Notification.error('Gagal menyimpan pengaturan: ' + error.message);
      ErrorTracker.logError(error);
    }
  }

  validateSettings(settings) {
    const errors = [];
    
    // Validate shop name
    if (!settings.shopName || settings.shopName.length < 2) {
      errors.push('Nama toko minimal 2 karakter');
    }
    if (settings.shopName.length > this.validationRules.shopNameMaxLength) {
      errors.push(`Nama toko maksimal ${this.validationRules.shopNameMaxLength} karakter`);
    }
    
    // Validate WhatsApp number
    if (!settings.waNumber) {
      errors.push('Nomor WhatsApp harus diisi');
    } else if (!this.validationRules.waNumberRegex.test(settings.waNumber)) {
      errors.push('Nomor WhatsApp tidak valid. Format: 62 diikuti 10-13 digit angka');
    }
    
    // Validate bank data
    if (!settings.bankName) {
      errors.push('Nama bank harus diisi');
    }
    if (!settings.bankAccount) {
      errors.push('Nomor rekening harus diisi');
    } else if (!this.validationRules.bankAccountRegex.test(settings.bankAccount)) {
      errors.push('Nomor rekening tidak valid (6-20 digit angka)');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // ==========================================
  // BACKUP DATA
  // ==========================================
  backupData() {
    try {
      // Prepare data
      const data = {
        products: this.app.products.map(p => ({
          ...p,
        })),
        orders: this.app.orders.map(o => ({
          ...o,
          customer: {
            ...o.customer,
            alamat: this.maskAddress(o.customer?.alamat)
          }
        })),
        settings: this.app.settings,
        promos: this.app.promos || [],
        exportedAt: new Date().toISOString(),
        version: '2.0.0',
        totalData: {
          products: this.app.products.length,
          orders: this.app.orders?.length || 0,
          promos: (this.app.promos || []).length
        },
        checksum: this.generateChecksum(data)
      };

      // Create JSON blob
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Download file
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-toko-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Track backup
      Analytics.trackBackupDownloaded();
      Notification.success('Backup berhasil diunduh');
      
    } catch (error) {
      console.error('Backup error:', error);
      Notification.error('Gagal membuat backup: ' + error.message);
      ErrorTracker.logError(error);
    }
  }

  maskAddress(address) {
    if (!address) return '';
    if (address.length <= 20) return address;
    return address.substring(0, 10) + '...' + address.substring(address.length - 10);
  }

  generateChecksum(data) {
    try {
      const json = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < json.length; i++) {
        hash = ((hash << 5) - hash) + json.charCodeAt(i);
        hash = hash & hash;
      }
      return hash.toString(36);
    } catch (error) {
      return 'unknown';
    }
  }

  // ==========================================
  // RESTORE DATA
  // ==========================================
  async restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Confirmation
    const ok = await Notification.confirm(
      '⚠️ MEMULIHKAN BACKUP AKAN MENIMPA SELURUH DATA SAAT INI!\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan?',
      { confirmText: 'Lanjutkan', danger: true }
    );
    if (!ok) {
      return;
    }

    // Show progress
    this.isRestoring = true;
    this.restoreProgress = 0;
    this.showProgress();

    try {
      // Read file
      const text = await file.text();
      this.restoreProgress = 10;
      this.updateProgress('Memvalidasi data...');
      
      const data = JSON.parse(text);
      
      // Validate data
      if (!(await this.validateBackupData(data))) {
        throw new Error('File backup tidak valid atau rusak');
      }
      
      this.restoreProgress = 30;
      this.updateProgress('Memproses data...');
      
      // Process dates
      const processedData = this.processBackupData(data);
      
      this.restoreProgress = 50;
      this.updateProgress('Menulis data ke Firestore...');
      
      // Restore data
      await batchWrite(processedData);
      
      this.restoreProgress = 90;
      this.updateProgress('Finalisasi...');
      
      // Track restore
      Analytics.trackRestoreCompleted();
      
      this.restoreProgress = 100;
      this.updateProgress('✅ Data berhasil dipulihkan!');
      
      Notification.success('Data berhasil dipulihkan! Halaman akan reload.');
      
      // Reset file input
      event.target.value = '';
      
      // Reload after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Restore error:', error);
      Notification.error('Gagal memulihkan data: ' + error.message);
      ErrorTracker.logError(error);
      
      this.restoreProgress = 0;
      this.updateProgress('❌ Gagal memulihkan data: ' + error.message);
      
      this.isRestoring = false;
    }
  }

  async validateBackupData(data) {
    // Required fields
    const requiredFields = ['products', 'orders', 'settings'];
    for (const field of requiredFields) {
      if (!data[field]) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // Validate data types
    if (!Array.isArray(data.products)) {
      console.error('Products must be an array');
      return false;
    }
    
    if (!Array.isArray(data.orders)) {
      console.error('Orders must be an array');
      return false;
    }
    
    // Validate version
    if (data.version !== '2.0.0') {
      console.warn('⚠️ Different backup version:', data.version);
      const ok = await Notification.confirm(`File backup menggunakan versi ${data.version}. Apakah tetap ingin memulihkan?`);
      if (!ok) {
        return false;
      }
    }
    
    return true;
  }

  processBackupData(data) {
    // Process products
    const products = data.products.map(p => ({
      ...p,
      createdAt: p.createdAt ? new Date(p.createdAt) : firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : firebase.firestore.FieldValue.serverTimestamp()
    }));

    // Process orders
    const orders = data.orders.map(o => ({
      ...o,
      createdAt: o.createdAt ? new Date(o.createdAt) : firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: o.updatedAt ? new Date(o.updatedAt) : firebase.firestore.FieldValue.serverTimestamp()
    }));

    // Process promos
    const promos = (data.promos || []).map(p => ({
      ...p,
      startDate: p.startDate ? new Date(p.startDate) : new Date(),
      endDate: p.endDate ? new Date(p.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: p.createdAt ? new Date(p.createdAt) : firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : firebase.firestore.FieldValue.serverTimestamp()
    }));

    // Process settings
    const settings = {
      ...data.settings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return {
      products,
      orders,
      settings,
      promos
    };
  }

  // ==========================================
  // PROGRESS UI (Restore)
  // ==========================================
  showProgress() {
    const container = document.getElementById('restoreProgress');
    if (container) {
      container.style.display = 'block';
    }
  }

  updateProgress(status) {
    const fill = document.querySelector('.progress-fill');
    const statusText = document.getElementById('restoreStatus');
    
    if (fill) {
      fill.style.width = `${this.restoreProgress}%`;
    }
    if (statusText) {
      statusText.textContent = status;
    }
  }

  // ==========================================
  // SYNC DATA TO FIRESTORE
  // ==========================================
  async syncData() {
    // Prevent multiple syncs
    if (this.isSyncing) {
      Notification.warning('Sinkronisasi sedang berlangsung...');
      return;
    }

    // Konfirmasi sebelum sync
    const ok = await Notification.confirm(
      '⚠️ Apakah Anda yakin ingin menyinkronkan semua data ke Firebase?\n\n' +
      'Tindakan ini akan menimpa data di Firebase dengan data lokal.\n' +
      'Pastikan Anda memiliki backup sebelum melanjutkan.',
      { confirmText: 'Sinkronkan', danger: true }
    );
    if (!ok) {
      return;
    }

    this.isSyncing = true;
    this.syncProgress = 0;
    this.showSyncProgress();

    try {
      Notification.info('🔄 Memulai sinkronisasi data...');
      
      // Update progress
      this.updateSyncProgress(5, 'Memvalidasi data...');

      // Validasi data
      const products = this.app.products || [];
      const orders = this.app.orders || [];
      const promos = this.app.promos || [];
      const settings = this.app.settings || {};

      if (products.length === 0 && orders.length === 0 && promos.length === 0) {
        Notification.warning('Tidak ada data untuk disinkronkan');
        this.isSyncing = false;
        this.hideSyncProgress();
        return;
      }

      // Update progress
      this.updateSyncProgress(15, `Menyiapkan ${products.length} produk, ${orders.length} pesanan, ${promos.length} promo...`);

      // Sync products
      let syncedCount = 0;
      const batch = db.batch();
      
      // Produk
      for (const product of products) {
        const ref = db.collection('products').doc(product.id);
        batch.set(ref, {
          ...product,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        syncedCount++;
      }
      
      // Update progress
      this.updateSyncProgress(40, `Menyinkronkan ${syncedCount} produk...`);

      // Orders
      for (const order of orders) {
        const ref = db.collection('orders').doc(order.id);
        batch.set(ref, {
          ...order,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        syncedCount++;
      }

      // Update progress
      this.updateSyncProgress(65, `Menyinkronkan ${orders.length} pesanan...`);

      // Promos
      for (const promo of promos) {
        const ref = db.collection('promos').doc(promo.id);
        batch.set(ref, {
          ...promo,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        syncedCount++;
      }

      // Update progress
      this.updateSyncProgress(85, `Menyinkronkan ${promos.length} promo...`);

      // Settings
      if (settings && Object.keys(settings).length > 0) {
        const ref = db.collection('settings').doc('config');
        batch.set(ref, {
          ...settings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        syncedCount++;
      }

      // Commit batch
      this.updateSyncProgress(90, 'Menulis ke Firestore...');

      await batch.commit();

      // Track sync
      Analytics.trackEvent('admin_data_synced', {
        products: products.length,
        orders: orders.length,
        promos: promos.length,
        settings: Object.keys(settings).length > 0 ? 1 : 0
      });

      // Complete
      this.updateSyncProgress(100, `✅ Sinkronisasi selesai! ${syncedCount} data disinkronkan.`);

      Notification.success(`✅ Sinkronisasi selesai! ${syncedCount} data disinkronkan ke Firebase.`);
      
      // Reload data
      await this.app.loadData();
      this.app.render();

    } catch (error) {
      console.error('Sync data error:', error);
      Notification.error('Gagal menyinkronkan data: ' + error.message);
      ErrorTracker.logError(error);
      
      this.updateSyncProgress(0, `❌ Gagal: ${error.message}`);
      document.getElementById('syncStatusText').style.color = 'var(--danger)';
    } finally {
      this.isSyncing = false;
      
      // Hide progress after 3 seconds on success
      setTimeout(() => {
        if (this.syncProgress === 100) {
          this.hideSyncProgress();
        }
      }, 3000);
    }
  }

  // ==========================================
  // SYNC PROGRESS UI
  // ==========================================
  showSyncProgress() {
    const container = document.getElementById('syncProgress');
    if (container) {
      container.style.display = 'block';
      container.style.maxWidth = '500px';
      container.style.margin = '0 auto';
    }
    
    const statusText = document.getElementById('syncStatusText');
    if (statusText) {
      statusText.style.color = 'var(--muted)';
    }
  }

  hideSyncProgress() {
    const container = document.getElementById('syncProgress');
    if (container) {
      container.style.display = 'none';
    }
  }

  updateSyncProgress(percent, status) {
    this.syncProgress = percent;
    
    const fill = document.getElementById('syncProgressFill');
    const statusText = document.getElementById('syncStatusText');
    
    if (fill) {
      fill.style.width = `${percent}%`;
    }
    if (statusText) {
      statusText.textContent = status;
    }
  }

  // ==========================================
  // SESSION MANAGEMENT - PERBAIKAN
  // ==========================================
  async refreshSession() {
    try {
      // Get current user from Firebase Auth
      const currentUser = firebase.auth().currentUser;
      
      if (currentUser) {
        const isAdmin = await Auth.checkAdminRole(currentUser.uid);
        
        // Update session
        await SessionManager.setSession({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email.split('@')[0],
          photoURL: currentUser.photoURL || null,
          isAdmin: isAdmin,
          role: isAdmin ? 'admin' : 'customer',
          lastLogin: new Date().toISOString()
        });
        
        // Track refresh
        Analytics.trackEvent('session_refreshed', { 
          email: currentUser.email 
        });
        
        Notification.success('Session berhasil direfresh');
        this.app.render();
      } else {
        Notification.warning('Tidak ada session aktif');
      }
    } catch (error) {
      console.error('Refresh session error:', error);
      Notification.error('Gagal refresh session: ' + error.message);
    }
  }

  async logoutAllDevices() {
    const ok = await Notification.confirm('Apakah Anda yakin ingin logout dari semua perangkat?', { danger: true });
    if (!ok) return;

    try {
      // Get current user from Firebase Auth
      const currentUser = firebase.auth().currentUser;
      
      if (currentUser) {
        // Track logout all devices
        Analytics.trackEvent('logout_all_devices', {
          email: currentUser.email
        });
        
        // Clear local session
        await Auth.logout();
        Notification.success('Logout dari semua perangkat berhasil');
        window.location.reload();
      } else {
        Notification.warning('Tidak ada user yang login');
      }
    } catch (error) {
      console.error('Logout all devices error:', error);
      Notification.error('Gagal logout dari semua perangkat: ' + error.message);
    }
  }
}
