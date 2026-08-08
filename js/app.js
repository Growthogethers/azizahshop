// js/app.js
// ============================================
// STORE APPLICATION - Main App
// ============================================

import { Notification } from './notification.js';
import { rupiah, escapeHtml, CONFIG, uid, fmtDate, SessionManager } from './config.js';
import { getProducts, addOrder, updateProduct, listenProducts, listenSettings, getSettings } from './db.js';
import { Storage } from './storage.js';
import { Analytics } from './analytics.js';
import { PromoManager } from './promo.js';
import { ReviewSystem } from './review.js';
import { Pagination } from './pagination.js';
import { ThemeManager } from './theme.js';
import { ErrorTracker } from './error-tracking.js';
import { QRISPayment } from './qris-payment.js';
import { Auth } from './auth.js';

class StoreApp {
  constructor() {
    // ==========================================
    // STATE
    // ==========================================
    this.products = [];
    this.settings = null;
    this.cart = [];
    this.selectedProduct = null;
    this.unsubscribeProducts = null;
    this.unsubscribeSettings = null;
    this.view = 'store';
    this.loading = true;
    this.pagination = null;
    this.filters = {
      search: '',
      minPrice: 0,
      maxPrice: Infinity,
      sortBy: 'newest'
    };
    this.promoCode = '';
    this.promoDiscount = 0;
    this.reviews = {};
    this.user = null;

    // QRIS State
    this.showQRIS = false;
    this.currentOrder = null;
    this.cartBackup = [];
    this.pendingOrder = null;
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async init() {
    try {
      console.log('🚀 Initializing Store App...');
      
      // Init error tracking
      ErrorTracker.init();

      // Init theme
      ThemeManager.init();

      // Check user session
      this.user = await SessionManager.getUser();
      if (this.user) {
        console.log('👤 User session found:', this.user.email);
        const isAdmin = await Auth.checkAdminRole(this.user.uid);
        if (isAdmin) {
          this.user.isAdmin = true;
        }
      }

      // Track page view
      Analytics.trackPageView('store');

      // Load settings
      this.settings = await getSettings();

      // Listen to products
      this.unsubscribeProducts = listenProducts((products) => {
        this.products = products;
        this.loading = false;
        this.applyFilters();
        this.render();
      });

      // Listen to settings
      this.unsubscribeSettings = listenSettings((settings) => {
        this.settings = settings;
        this.render();
      });

      // Load promos
      this.loadPromos();

      // Check for pending orders in localStorage
      this.checkPendingOrders();

      this.render();
    } catch (error) {
      console.error('❌ Init error:', error);
      ErrorTracker.logError(error);
      this.showError('Gagal memuat aplikasi', error.message);
    }
  }

  destroy() {
    if (this.unsubscribeProducts) this.unsubscribeProducts();
    if (this.unsubscribeSettings) this.unsubscribeSettings();
  }

  showError(title, message) {
    const appElement = document.getElementById('app');
    appElement.innerHTML = `
      <div style="padding:40px;text-align:center;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;">
        <div style="font-size:48px;margin-bottom:20px;">⚠️</div>
        <h2 style="color:var(--danger);">${title}</h2>
        <p style="color:var(--muted);max-width:400px;margin:10px auto;">${message}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 30px;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
          🔄 Refresh Halaman
        </button>
      </div>
    `;
  }

  // ==========================================
  // PENDING ORDERS
  // ==========================================
  checkPendingOrders() {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
      if (pending.length > 0) {
        console.log(`📦 ${pending.length} pending orders found in localStorage`);
        setTimeout(() => {
          if (confirm(`Terdapat ${pending.length} pesanan yang belum tersimpan. Sync sekarang?`)) {
            this.syncPendingOrders();
          }
        }, 2000);
      }
    } catch (e) {
      console.warn('Check pending orders error:', e);
    }
  }

  async syncPendingOrders() {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
      let synced = 0;

      for (const order of pending) {
        try {
          if (this.user) {
            await addOrder(order);
          } else {
            await Auth.checkoutWithoutLogin(order);
          }
          synced++;
        } catch (e) {
          console.error('Failed to sync order:', e);
        }
      }

      if (synced > 0) {
        localStorage.setItem('pendingOrders', JSON.stringify([]));
        Notification.success(`✅ ${synced} pesanan berhasil disinkronkan!`);
      }
    } catch (error) {
      console.error('Sync pending orders error:', error);
    }
  }

  // ==========================================
  // FILTERS
  // ==========================================
  applyFilters() {
    let filtered = [...this.products];

    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }

    filtered = filtered.filter(p =>
      p.price >= this.filters.minPrice &&
      p.price <= this.filters.maxPrice
    );

    const sorts = {
      'name': (a, b) => a.name.localeCompare(b.name),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'newest': (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      'popular': (a, b) => (b.rating || 0) - (a.rating || 0)
    };
    filtered.sort(sorts[this.filters.sortBy] || sorts.newest);

    if (!this.pagination) {
      this.pagination = new Pagination(filtered);
    } else {
      this.pagination.updateItems(filtered);
    }

    return filtered;
  }

  searchProducts(query) {
    this.filters.search = query;
    Analytics.trackSearch(query, this.products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase())
    ).length);
    this.applyFilters();
    this.render();
  }

  filterByPrice(min, max) {
    this.filters.minPrice = min || 0;
    this.filters.maxPrice = max || Infinity;
    this.applyFilters();
    this.render();
  }

  sortProducts(sortBy) {
    this.filters.sortBy = sortBy;
    this.applyFilters();
    this.render();
  }

  // ==========================================
  // CART
  // ==========================================
  cartQty(id) {
    const it = this.cart.find(c => c.id === id);
    return it ? it.qty : 0;
  }

  addToCart(id, delta) {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;

    let it = this.cart.find(c => c.id === id);
    if (!it) {
      it = { id, qty: 0 };
      this.cart.push(it);
    }

    const oldQty = it.qty;
    it.qty += delta;

    if (it.qty <= 0) {
      this.cart = this.cart.filter(c => c.id !== id);
      Analytics.trackRemoveFromCart(id, prod.name, oldQty);
    } else if (it.qty > prod.stock) {
      it.qty = prod.stock;
      Notification.warning(`Stok ${prod.name} tersisa ${prod.stock}`);
    } else {
      if (delta > 0) {
        Analytics.trackAddToCart(id, prod.name, delta, prod.price);
      } else {
        Analytics.trackRemoveFromCart(id, prod.name, Math.abs(delta));
      }
    }

    this.applyPromo(this.promoCode);
    this.render();
  }

  cartTotal() {
    return this.cart.reduce((sum, c) => {
      const p = this.products.find(pp => pp.id === c.id);
      return sum + (p ? p.price * c.qty : 0);
    }, 0);
  }

  cartCount() {
    return this.cart.reduce((s, c) => s + c.qty, 0);
  }

  // ==========================================
  // PROMO
  // ==========================================
  async applyPromo(code) {
    this.promoCode = code;
    this.promoDiscount = 0;

    if (!code) {
      this.render();
      return;
    }

    const total = this.cartTotal();
    if (total === 0) {
      Notification.warning('Keranjang kosong');
      this.render();
      return;
    }

    const result = await PromoManager.applyPromo(code, total);

    if (result.valid) {
      this.promoDiscount = result.discount;
      Notification.success(result.message);
      Analytics.trackPromoApplied(code, result.discount);

      console.log('✅ Promo applied:', {
        code: code,
        total: total,
        discount: result.discount,
        finalTotal: result.totalAfterDiscount
      });
    } else {
      this.promoDiscount = 0;
      Notification.error(result.message);
    }

    const promoInput = document.getElementById('promoInput');
    if (promoInput) {
      if (this.promoCode && this.promoDiscount > 0) {
        promoInput.value = this.promoCode;
        promoInput.readOnly = true;
      } else {
        promoInput.value = '';
        promoInput.readOnly = false;
        promoInput.focus();
      }
    }

    this.render();
  }

  async applyPromoFromCheckout() {
    const input = document.getElementById('promoInput');
    if (!input) {
      Notification.error('Input promo tidak ditemukan');
      return;
    }

    const code = input.value.trim();
    if (!code) {
      Notification.warning('Masukkan kode promo');
      return;
    }

    await this.applyPromo(code);
  }

  removePromo() {
    this.promoCode = '';
    this.promoDiscount = 0;
    this.render();
    Notification.info('Promo dihapus');
  }

  async loadPromos() {
    try {
      const promos = await PromoManager.getActivePromos();
      if (promos.length > 0) {
        console.log('📢 Active promos:', promos);
      }
    } catch (error) {
      console.error('Load promos error:', error);
    }
  }

  // ==========================================
  // REVIEW
  // ==========================================
  async addReview(productId, rating, comment) {
    try {
      if (!this.user) {
        Notification.warning('Silakan login terlebih dahulu untuk menambahkan review');
        return;
      }

      const userId = this.user.uid;
      const userName = this.user.displayName || 'Pelanggan';

      await ReviewSystem.addReview(productId, userId, userName, rating, comment);
      Notification.success('Review berhasil ditambahkan!');
      this.render();
    } catch (error) {
      Notification.error('Gagal menambahkan review');
    }
  }

  // ==========================================
  // QRIS CHECKOUT
  // ==========================================
  async submitCheckout(data) {
    try {
      // Validate data
      if (!data.nama || !data.alamat || !data.opsi) {
        Notification.error('Mohon lengkapi semua data');
        return;
      }

      const items = this.cart.map(c => {
        const p = this.products.find(pp => pp.id === c.id);
        return {
          id: p.id,
          name: p.name,
          qty: c.qty,
          price: p.price,
          subtotal: p.price * c.qty
        };
      });

      const total = this.cartTotal() - this.promoDiscount;
      const orderId = uid();

      const order = {
        id: orderId,
        customer: {
          nama: data.nama.trim(),
          alamat: data.alamat.trim(),
          opsi: data.opsi,
          keterangan: data.keterangan || ''
        },
        items,
        total,
        promoCode: this.promoCode || null,
        promoDiscount: this.promoDiscount || 0,
        userId: this.user?.uid || null,
        userEmail: this.user?.email || null,
        status: 'Menunggu Pembayaran',
        paymentMethod: 'QRIS',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Backup cart
      this.cartBackup = [...this.cart];

      // Clear cart
      this.cart = [];
      this.promoCode = '';
      this.promoDiscount = 0;

      // PERBAIKAN: Gunakan trackBeginCheckout (bukan trackCheckout)
      Analytics.trackBeginCheckout(total, items.length);

      // Show QRIS popup
      this.showQRISPopup(order);

      this.render();

    } catch (error) {
      console.error('Checkout error:', error);
      Notification.error('Gagal membuat pesanan');
      ErrorTracker.logError(error);

      // Restore cart
      if (this.cartBackup.length > 0) {
        this.cart = [...this.cartBackup];
        this.cartBackup = [];
      }
    }
  }

  showQRISPopup(order) {
    this.showQRIS = true;
    this.currentOrder = order;
    this.pendingOrder = order;

    // Setup window functions untuk QRIS
    window.closeQRIS = () => {
      if (this.currentOrder) {
        if (confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) {
          if (this.currentOrder.id) {
            this.cancelOrder(this.currentOrder.id);
          }
          this.showQRIS = false;
          this.currentOrder = null;
          if (this.cartBackup.length > 0 && this.cart.length === 0) {
            this.cart = [...this.cartBackup];
            this.cartBackup = [];
          }
          this.render();
        }
      } else {
        this.showQRIS = false;
        this.render();
      }
    };

    window.copyAmount = () => {
      const amount = this.currentOrder.total;
      const formatted = rupiah(amount);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(amount.toString()).then(() => {
          Notification.success('💰 Nominal berhasil dicopy!');
        }).catch(() => {
          this.fallbackCopy(amount.toString());
        });
      } else {
        this.fallbackCopy(amount.toString());
      }
    };

    window.sendToWhatsApp = () => {
      this.sendOrderToWhatsApp(this.currentOrder);
    };
  }

  fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      Notification.success('💰 Nominal berhasil dicopy!');
    } catch (e) {
      Notification.error('Gagal copy nominal');
    }
    document.body.removeChild(input);
  }

  sendOrderToWhatsApp(order) {
    // Buat pesan WhatsApp
    const itemsText = order.items.map(it => `${it.qty}x ${it.name}`).join(', ');

    let msg = `✅ *PESANAN BARU*\n\n`;
    msg += `*No Pesanan:* #${order.id.slice(0, 8).toUpperCase()}\n`;
    msg += `*Nama:* ${order.customer.nama}\n`;
    msg += `*Alamat:* ${order.customer.alamat}\n`;
    msg += `*Kurir:* ${order.customer.opsi}\n`;
    msg += `*Item:* ${itemsText}\n`;
    msg += `*Total:* ${rupiah(order.total)}\n`;

    if (order.promoCode) {
      msg += `*Promo:* ${order.promoCode} (diskon ${rupiah(order.promoDiscount)})\n`;
    }

    msg += `\n*Metode Pembayaran:* QRIS\n`;
    msg += `*Status:* Menunggu Konfirmasi Pembayaran\n\n`;
    msg += `*Harap kirim bukti transfer ke nomor ini*`;

    if (order.customer.keterangan) {
      msg += `\n\n*Catatan:* ${order.customer.keterangan}`;
    }

    const waLink = `https://wa.me/${this.settings.waNumber}?text=${encodeURIComponent(msg)}`;
    window.open(waLink, '_blank');

    // Save order ke Firestore
    this.saveOrder(order);

    // Close QRIS popup
    this.showQRIS = false;
    this.currentOrder = null;
    this.cartBackup = [];

    // Tampilkan halaman sukses
    this.view = 'order-success';
    this.render();

    // PERBAIKAN: Gunakan trackPurchase (bukan trackOrderComplete)
    Analytics.trackPurchase(order.id, order.total, order.items);

    Notification.success('📱 WhatsApp terbuka! Kirim bukti transfer Anda.');
  }

  async saveOrder(order) {
    try {
      if (!this.user) {
        await Auth.checkoutWithoutLogin(order);
      } else {
        await addOrder(order);
      }

      console.log('✅ Order saved to Firestore:', order.id);
      this.removeFromPending(order.id);

    } catch (error) {
      console.error('Save order error:', error);
      this.saveToPending(order);
      Notification.warning('⚠️ Pesanan disimpan lokal, akan sync otomatis nanti');
    }
  }

  async cancelOrder(orderId) {
    try {
      const { cancelOrder } = await import('./db.js');
      await cancelOrder(orderId);
      console.log('✅ Order cancelled:', orderId);
    } catch (error) {
      console.error('Cancel order error:', error);
    }
  }

  saveToPending(order) {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
      pending.push(order);
      localStorage.setItem('pendingOrders', JSON.stringify(pending));
    } catch (e) {
      console.error('Save to pending error:', e);
    }
  }

  removeFromPending(orderId) {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingOrders') || '[]');
      const filtered = pending.filter(o => o.id !== orderId);
      localStorage.setItem('pendingOrders', JSON.stringify(filtered));
    } catch (e) {
      console.error('Remove from pending error:', e);
    }
  }

  // ==========================================
  // NAVIGATION
  // ==========================================
  goCheckout() {
    if (this.cartCount() === 0) {
      Notification.warning('Keranjang kosong');
      return;
    }

    if (this.settings?.enableQRIS !== false) {
      Analytics.trackBeginCheckout(this.cartTotal(), this.cartCount());
      this.view = 'checkout';
      this.render();
      window.scrollTo(0, 0);
    } else {
      Analytics.trackBeginCheckout(this.cartTotal(), this.cartCount());
      this.view = 'checkout';
      this.render();
      window.scrollTo(0, 0);
    }
  }

  backToStore() {
    this.view = 'store';
    this.selectedProduct = null;
    this.showQRIS = false;
    this.currentOrder = null;
    this.render();
    window.scrollTo(0, 0);
  }

  openProduct(id) {
    this.selectedProduct = this.products.find(p => p.id === id);
    if (this.selectedProduct) {
      Analytics.trackProductView(id, this.selectedProduct.name);
    }
    this.render();
  }

  closeProduct() {
    this.selectedProduct = null;
    this.render();
  }

  // ==========================================
  // RENDER
  // ==========================================
  render() {
    const appElement = document.getElementById('app');

    if (this.loading) {
      appElement.innerHTML = this.renderSkeleton();
      return;
    }

    try {
      // QRIS Popup di atas halaman
      if (this.showQRIS && this.currentOrder) {
        appElement.innerHTML = this.renderStoreHome() + QRISPayment.renderQRISModal(this.currentOrder);
        this.bindEvents();
        return;
      }

      if (this.view === 'checkout') {
        appElement.innerHTML = this.renderCheckout();
      } else if (this.view === 'order-success') {
        appElement.innerHTML = this.renderOrderSuccess();
      } else {
        appElement.innerHTML = this.renderStoreHome();
      }

      this.bindEvents();
    } catch (error) {
      console.error('Render error:', error);
      this.showError('Terjadi kesalahan saat render', error.message);
    }
  }

  renderSkeleton() {
    return `
      <div class="store-header">
        <h1 class="store-title skeleton" style="width:200px;height:30px;"></h1>
        <p class="store-tag skeleton" style="width:300px;height:16px;"></p>
      </div>
      <div class="wrap">
        <div class="grid">
          ${Array(8).fill(0).map(() => `
            <div class="card">
              <div class="skeleton-card"></div>
              <div class="card-body">
                <div class="skeleton-text" style="width:80%;"></div>
                <div class="skeleton-text-sm" style="width:60%;"></div>
                <div class="skeleton-text-sm" style="width:40%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderStoreHome() {
    const filtered = this.applyFilters();
    const currentItems = this.pagination ? this.pagination.getCurrentPage() : filtered;

    const productsHtml = currentItems.length ?
      `<div class="grid">${currentItems.map(p => this.renderProductCard(p)).join('')}</div>` :
      `<div class="empty-note">😕 Tidak ada produk yang ditemukan.</div>`;
    const paginationHtml = this.pagination ? this.pagination.getPaginationHTML() : '';

    return `
      <div class="store-header">
        <h1 class="store-title">${escapeHtml(this.settings?.shopName || 'Toko Online')}</h1>
        <p class="store-tag">${escapeHtml(this.settings?.tagline || '')}</p>
        ${this.user ? `<div style="margin-top:5px;font-size:12px;opacity:0.7;">👤 ${escapeHtml(this.user.email)}</div>` : ''}
        ${this.settings?.enableQRIS !== false ? `
          <div style="margin-top:10px;font-size:12px;opacity:0.7;">
            💳 Pembayaran QRIS tersedia
          </div>
        ` : ''}
      </div>
      <div class="wrap">
        ${this.renderFilters()}
        ${productsHtml}
        ${paginationHtml}
      </div>
      ${this.cartCount() > 0 ? this.renderCartBar() : ''}
      ${this.selectedProduct ? this.renderProductModal(this.selectedProduct) : ''}
      <div class="footer-note">
        <p>© ${new Date().getFullYear()} ${escapeHtml(this.settings?.shopName || 'Toko Online')} • Dibuat dengan ❤️</p>
      </div>
    `;
  }

  renderFilters() {
    return `
      <div class="filters-bar">
        <div class="search-box">
          <input type="text" 
                 placeholder="🔍 Cari produk..." 
                 value="${escapeHtml(this.filters.search)}"
                 oninput="window.app.searchProducts(this.value)">
        </div>
        <div class="filter-controls">
          <select onchange="window.app.sortProducts(this.value)">
            <option value="newest" ${this.filters.sortBy === 'newest' ? 'selected' : ''}>Terbaru</option>
            <option value="popular" ${this.filters.sortBy === 'popular' ? 'selected' : ''}>Terpopuler</option>
            <option value="price-asc" ${this.filters.sortBy === 'price-asc' ? 'selected' : ''}>Harga: Rendah→Tinggi</option>
            <option value="price-desc" ${this.filters.sortBy === 'price-desc' ? 'selected' : ''}>Harga: Tinggi→Rendah</option>
            <option value="name" ${this.filters.sortBy === 'name' ? 'selected' : ''}>Nama</option>
          </select>
        </div>
      </div>
    `;
  }

  renderProductCard(p) {
    const stockClass = p.stock <= 0 ? 'out' : (p.stock <= 3 ? 'low' : '');
    const stockLabel = p.stock <= 0 ? 'Stok habis' : `Stok: ${p.stock}`;
    const qty = this.cartQty(p.id);
    const rating = p.rating || 0;
    const stars = '⭐'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '⭐' : '');

    const img = p.image ?
      `<img class="card-img" src="${p.image}" loading="lazy" onclick="window.app.openProduct('${p.id}')" alt="${escapeHtml(p.name)}">` :
      `<div class="card-img noimg" onclick="window.app.openProduct('${p.id}')">📷</div>`;

    return `
      <div class="card">
        ${img}
        <div class="card-body">
          <div class="card-name" onclick="window.app.openProduct('${p.id}')">${escapeHtml(p.name)}</div>
          ${rating > 0 ? `<div class="card-rating">${stars} (${p.totalReviews || 0})</div>` : ''}
          <div class="card-price">${rupiah(p.price)}</div>
          <div class="card-stock ${stockClass}">${stockLabel}</div>
          ${p.stock <= 0 ? `<button class="add-btn" disabled>Habis</button>` :
          qty === 0 ? `<button class="add-btn" onclick="window.app.addToCart('${p.id}',1)">+ Keranjang</button>` :
            `<div class="qty-row">
              <button onclick="window.app.addToCart('${p.id}',-1)">−</button>
              <span>${qty}</span>
              <button onclick="window.app.addToCart('${p.id}',1)">+</button>
            </div>`
          }
        </div>
      </div>`;
  }

  renderProductModal(p) {
    const qty = this.cartQty(p.id);
    return `
      <div class="overlay" onclick="if(event.target.classList.contains('overlay')) window.app.closeProduct()">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-close"><button onclick="window.app.closeProduct()">✕</button></div>
          <div class="modal-inner">
            ${p.image ? `<img class="modal-img" src="${p.image}" alt="${escapeHtml(p.name)}">` : `<div class="modal-img" style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">📷 Tanpa foto</div>`}
            <h3 class="modal-title">${escapeHtml(p.name)}</h3>
            <div class="modal-price">${rupiah(p.price)}</div>
            <div class="modal-desc">${escapeHtml(p.description || 'Tidak ada deskripsi.')}</div>
            <div class="modal-stock">${p.stock > 0 ? `✅ Stok tersedia: ${p.stock}` : '❌ Stok habis'}</div>
            ${p.stock <= 0 ? `<button class="btn" disabled style="opacity:.5;">Stok Habis</button>` :
              qty === 0 ? `<button class="btn" onclick="window.app.addToCart('${p.id}',1)">Tambah ke Keranjang</button>` :
                `<div class="qty-row" style="justify-content:center;gap:14px;margin-top:10px;">
                  <button onclick="window.app.addToCart('${p.id}',-1)">−</button>
                  <span style="font-size:16px;font-weight:600;">${qty}</span>
                  <button onclick="window.app.addToCart('${p.id}',1)">+</button>
                </div>`
            }
          </div>
        </div>
      </div>`;
  }

  renderCartBar() {
    const total = this.cartTotal() - this.promoDiscount;
    return `
      <div class="cart-bar">
        <div>
          <div class="cart-bar-info">🛒 ${this.cartCount()} item</div>
          <div class="cart-bar-total">${rupiah(total)}</div>
          ${this.promoDiscount > 0 ? `<div class="cart-bar-discount">💸 Diskon: -${rupiah(this.promoDiscount)}</div>` : ''}
        </div>
        <button onclick="window.app.goCheckout()">Checkout →</button>
      </div>`;
  }

  renderCheckout() {
    const items = this.cart.map(c => {
      const p = this.products.find(pp => pp.id === c.id);
      return { name: p.name, qty: c.qty, price: p.price, subtotal: p.price * c.qty };
    });
    const total = this.cartTotal() - this.promoDiscount;
    const settings = this.settings || {};

    return `
      <div class="store-header">
        <h1 class="store-title" style="font-size:19px;">📋 Checkout</h1>
        <p class="store-tag">${settings.enableQRIS !== false ? 'Pilih metode pembayaran' : 'Periksa pesananmu, lalu lanjut ke WhatsApp'}</p>
      </div>
      <div class="wrap" style="max-width:480px;">
        <div class="receipt">
          <div class="receipt-body">
            <div class="receipt-head">
              <div class="shop">${escapeHtml(settings.shopName || 'Toko Online')}</div>
              <div class="sub">NOTA PESANAN</div>
            </div>
            <div class="receipt-divider"></div>
            ${items.map(it => `
              <div class="receipt-row">
                <span class="label">${escapeHtml(it.name)} ×${it.qty}</span>
                <span class="val">${rupiah(it.subtotal)}</span>
              </div>`).join('')}
            ${this.promoDiscount > 0 ? `
              <div class="receipt-row" style="color:var(--success);">
                <span class="label">💸 Diskon (${escapeHtml(this.promoCode)})</span>
                <span class="val">-${rupiah(this.promoDiscount)}</span>
              </div>` : ''}
            <div class="receipt-divider"></div>
            <div class="receipt-total"><span>Total</span><span class="val">${rupiah(total)}</span></div>
          </div>
          <div class="receipt-tear"></div>
        </div>

        <!-- ============ PROMO INPUT ============ -->
        <div class="promo-section">
          <div class="promo-input-wrapper">
            <label>🏷️ Kode Promo</label>
            <div class="promo-input-group">
              <input type="text" 
                     id="promoInput" 
                     placeholder="Masukkan kode promo..." 
                     value="${escapeHtml(this.promoCode)}"
                     ${this.promoCode ? 'readonly' : ''}>
              ${this.promoCode ?
                `<button class="btn promo-remove-btn" onclick="window.app.removePromo()">✕</button>` :
                `<button class="btn promo-apply-btn" onclick="window.app.applyPromoFromCheckout()">Apply</button>`
              }
            </div>
            ${this.promoCode ?
              `<div class="promo-active">✅ Promo <strong>${escapeHtml(this.promoCode)}</strong> aktif (diskon ${rupiah(this.promoDiscount)})</div>` :
              `<div class="promo-hint">💡 Masukkan kode promo untuk mendapatkan diskon</div>`
            }
          </div>
        </div>

        ${settings.enableQRIS !== false ? `
          <div class="payment-methods">
            <h4 style="margin:16px 0 8px;">💳 Metode Pembayaran</h4>
            <div class="payment-option selected" onclick="document.querySelector('input[name=payment]').value='qris'">
              <span>📱 QRIS</span>
              <span style="font-size:11px;color:var(--muted);">Scan & bayar</span>
            </div>
          </div>
          <input type="hidden" name="payment" value="qris">
        ` : ''}

        <form id="checkoutForm">
          <div class="field">
            <label>👤 Nama Pemesan *</label>
            <input type="text" name="nama" required placeholder="Nama lengkap">
          </div>
          <div class="field">
            <label>📍 Alamat Pengiriman *</label>
            <textarea name="alamat" required placeholder="Alamat lengkap (jalan, kota, kode pos)"></textarea>
          </div>
          <div class="field">
            <label>🚚 Opsi Pengiriman *</label>
            <select name="opsi" required>
              <option value="">Pilih kurir</option>
              ${CONFIG.SHIPPING_OPTIONS.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>📝 Keterangan (opsional)</label>
            <textarea name="keterangan" placeholder="Catatan tambahan untuk penjual"></textarea>
          </div>
          <button type="button" class="btn outline" style="margin-bottom:10px;" onclick="window.app.backToStore()">← Kembali belanja</button>
          <button type="submit" class="btn accent">
            ${settings.enableQRIS !== false ? '💳 Bayar dengan QRIS' : '📱 Pesan via WhatsApp'}
          </button>
          ${settings.enableQRIS !== false ? `
            <div style="margin-top:8px;font-size:11px;color:var(--muted);text-align:center;">
              🔒 Aman • QRIS • Langsung ke WhatsApp setelah pembayaran
            </div>
          ` : ''}
        </form>
      </div>`;
  }

  renderOrderSuccess() {
    return `
      <div class="wrap" style="max-width:420px; padding-top:60px; text-align:center;">
        <div style="font-size:64px; margin-bottom:20px;">✅</div>
        <h2>Pesanan Berhasil!</h2>
        <p style="color:var(--muted); font-size:14px; line-height:1.8;">
          WhatsApp telah terbuka dengan pesan otomatis.<br>
          Silakan kirim <strong>bukti transfer</strong> ke admin.<br>
          Pesanan akan diproses setelah pembayaran dikonfirmasi.
        </p>
        <div style="background:#FFF8E1;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;border:1px solid #FFE082;">
          ⚠️ <strong>Harap kirim bukti transfer ke WhatsApp</strong><br>
          <span style="font-size:11px;color:var(--muted);">Admin akan mengkonfirmasi pesanan Anda</span>
        </div>
        <button class="btn" style="margin-top:8px;" onclick="window.app.backToStore()">🏪 Kembali ke Toko</button>
      </div>`;
  }

  // ==========================================
  // EVENT BINDING
  // ==========================================
  bindEvents() {
    // Close overlay on click outside
    document.querySelectorAll('.overlay').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('overlay')) {
          this.selectedProduct = null;
          this.render();
        }
      };
    });

    // Promo input Enter key
    const promoInput = document.getElementById('promoInput');
    if (promoInput) {
      promoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyPromoFromCheckout();
        }
      });
    }

    // Checkout form
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(checkoutForm);
        const data = {
          nama: formData.get('nama'),
          alamat: formData.get('alamat'),
          opsi: formData.get('opsi'),
          keterangan: formData.get('keterangan'),
          payment: formData.get('payment') || 'qris'
        };

        await this.submitCheckout(data);
      };
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.selectedProduct) {
          this.closeProduct();
        }
        if (this.showQRIS) {
          this.showQRIS = false;
          this.render();
        }
      }
    });
  }
}

// ==========================================
// INITIALIZE & EXPOSE
// ==========================================
console.log('🚀 Initializing Store App...');
const app = new StoreApp();

// EXPOSE ALL METHODS TO WINDOW
window.app = {
  // Core
  init: app.init.bind(app),
  render: app.render.bind(app),
  destroy: app.destroy.bind(app),

  // Navigation
  goCheckout: app.goCheckout.bind(app),
  backToStore: app.backToStore.bind(app),
  openProduct: app.openProduct.bind(app),
  closeProduct: app.closeProduct.bind(app),

  // Cart
  addToCart: app.addToCart.bind(app),
  cartQty: app.cartQty.bind(app),
  cartTotal: app.cartTotal.bind(app),
  cartCount: app.cartCount.bind(app),

  // Filters & Sort
  searchProducts: app.searchProducts.bind(app),
  sortProducts: app.sortProducts.bind(app),
  filterByPrice: app.filterByPrice.bind(app),

  // Promo
  applyPromoFromCheckout: app.applyPromoFromCheckout.bind(app),
  removePromo: app.removePromo.bind(app),
  applyPromo: app.applyPromo.bind(app),

  // Pagination
  pagination: app.pagination,

  // Review
  addReview: app.addReview.bind(app),

  // QRIS
  closeQRIS: window.closeQRIS,
  copyAmount: window.copyAmount,
  sendToWhatsApp: window.sendToWhatsApp
};

// Initialize
app.init().catch(error => {
  console.error('❌ Failed to initialize app:', error);
  Notification.error('Gagal memuat aplikasi');
  ErrorTracker.logError(error);
});
