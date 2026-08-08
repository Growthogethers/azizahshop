// js/admin.js - FULL
// ============================================
// ADMIN APPLICATION - Refactored with fixes
// ============================================

import { Notification } from './notification.js';
import { rupiah, escapeHtml, fmtDate, CONFIG, SessionManager } from './config.js';
import { 
  getProducts, getOrders, getSettings,
  updateOrder, updateSettings,
  listenProducts, listenOrders, listenSettings
} from './db.js';
import { Auth } from './auth.js';
import { Storage } from './storage.js';
import { PromoManager } from './promo.js';
import { Analytics } from './analytics.js';
import { ThemeManager } from './theme.js';
import { ErrorTracker } from './error-tracking.js';
import { AdminDashboard } from './admin-dashboard.js';
import { AdminProducts } from './admin-products.js';
import { AdminOrders } from './admin-orders.js';
import { AdminPromos } from './admin-promos.js';
import { AdminReport } from './admin-report.js';
import { AdminSettings } from './admin-settings.js';
import { renderAdminLayout, renderLoginForm } from './admin-components.js';
import { RateLimiter } from './rate-limiter.js';

export class AdminApp {
  constructor() {
    // ==========================================
    // STATE MANAGEMENT
    // ==========================================
    this.products = [];
    this.orders = [];
    this.settings = null;
    this.promos = [];
    
    // Auth state
    this.isLoggedIn = false;
    this.loading = true;
    this.currentView = 'dashboard';
    this.user = null;
    this.isAdmin = false;
    
    // Auth retry counter
    this.authRetries = 0;
    this.maxAuthRetries = 3;
    
    // Sub-modules
    this.dashboard = new AdminDashboard(this);
    this.productsModule = new AdminProducts(this);
    this.ordersModule = new AdminOrders(this);
    this.promosModule = new AdminPromos(this);
    this.reportModule = new AdminReport(this);
    this.settingsModule = new AdminSettings(this);
    
    // Unsubscribe functions
    this.unsubscribers = [];
    this.authUnsubscribe = null;
    this.sessionCheckTimer = null;
    
    // Order listener state
    this.orderListenerActive = false;
    this.lastOrderCount = 0;
    this.isUpdating = false;
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async init() {
    try {
      console.log('🚀 Initializing AdminApp...');
      
      // 1. Init dependencies
      ErrorTracker.init();
      ThemeManager.init();
      
      // 2. Init Analytics
      if (typeof Analytics !== 'undefined') {
        Analytics.init();
      }
      
      // 3. Check existing session
      const existingUser = await this.checkExistingSession();
      
      // 4. Set up auth listener
      this.setupAuthListener();
      
      // 5. Set up session monitor
      this.setupSessionMonitor();
      
      // 6. If already logged in, load data
      if (existingUser) {
        console.log('📦 Existing session found, loading data...');
        await this.loadData();
        this.loading = false;
        this.render();
      } else {
        console.log('ℹ️ No session found, waiting for auth...');
        this.loading = false;
        this.render();
      }
      
      console.log('✅ AdminApp initialized successfully');
      
    } catch (error) {
      console.error('❌ Admin init error:', error);
      Notification.error('Gagal memuat admin panel: ' + error.message);
      ErrorTracker.logError(error);
      this.loading = false;
      this.currentView = 'login';
      this.render();
    }
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================
  async checkExistingSession() {
    try {
      const session = await SessionManager.getSession();
      
      if (session) {
        console.log('📦 Found existing session:', { 
          email: session.email, 
          isAdmin: session.isAdmin 
        });
        
        // Verifikasi admin role
        const isAdmin = await Auth.checkAdminRole(session.uid);
        
        if (isAdmin) {
          this.user = session;
          this.isAdmin = true;
          this.isLoggedIn = true;
          this.currentView = 'dashboard';
          
          // Update session
          await SessionManager.refreshSession(session);
          
          // Track login
          Analytics.trackAdminLogin(session.email, 'session_restore');
          
          return session;
        } else {
          console.warn('⚠️ Session user is not admin, clearing session...');
          await SessionManager.clearSession();
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Session check error:', error);
      return null;
    }
  }

  setupAuthListener() {
    console.log('👂 Setting up auth listener...');
    
    this.authUnsubscribe = Auth.onAuthStateChanged(async (user) => {
      console.log('🔄 Auth state changed:', user ? user.email : 'null');
      
      if (user) {
        await this.handleAuthSuccess(user);
      } else {
        await this.handleAuthFailure();
      }
    });
  }

  setupSessionMonitor() {
    // Check session validity every 5 minutes
    this.sessionCheckTimer = setInterval(async () => {
      if (this.isLoggedIn) {
        const isValid = await SessionManager.isSessionValid();
        if (!isValid) {
          console.warn('⚠️ Session expired, logging out...');
          Notification.warning('Session expired. Silakan login kembali.');
          await this.logout();
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // ==========================================
  // AUTH HANDLERS
  // ==========================================
  async handleAuthSuccess(user) {
    console.log('✅ User authenticated:', user.email);
    
    const isAdmin = await Auth.checkAdminRole(user.uid);
    
    if (isAdmin) {
      console.log('✅ Admin confirmed');
      
      this.user = user;
      this.isAdmin = true;
      this.isLoggedIn = true;
      
      // Track login
      Analytics.trackAdminLogin(user.email, 'auth_listener');
      
      // Load data
      await this.loadData();
      
      if (this.currentView === 'login') {
        this.currentView = 'dashboard';
      }
      
      this.loading = false;
      this.render();
      
    } else {
      console.warn('❌ User is NOT admin');
      await this.handleAuthFailure('User is not admin');
    }
  }

  async handleAuthFailure(error = null) {
    console.warn('⚠️ Auth failure:', error || 'No user');
    
    this.authRetries++;
    
    if (this.authRetries <= this.maxAuthRetries && error !== 'User is not admin') {
      console.log(`🔄 Retry ${this.authRetries}/${this.maxAuthRetries}...`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * this.authRetries));
      return;
    }
    
    // Reset state
    this.isLoggedIn = false;
    this.isAdmin = false;
    this.user = null;
    this.products = [];
    this.orders = [];
    this.settings = null;
    this.promos = [];
    
    // Cleanup listeners
    this.cleanup();
    
    this.currentView = 'login';
    this.loading = false;
    this.render();
    
    if (error && error !== 'No user') {
      Notification.error('Akses admin tidak diizinkan: ' + error);
    }
  }

  // ==========================================
  // DATA LOADING - PERBAIKAN
  // ==========================================
  async loadData() {
    try {
      console.log('📦 Loading data...');
      
      // Load settings first
      this.settings = await getSettings();
      
      // Setup real-time listeners
      // Products listener
      const unsubProducts = listenProducts((products) => {
        this.products = products;
        console.log(`📦 Products updated: ${products.length}`);
        this.render();
      });
      this.unsubscribers.push(unsubProducts);

      // Orders listener - PERBAIKAN
      const unsubOrders = listenOrders((orders) => {
        console.log(`📦 Orders received: ${orders.length}`);
        
        // Check if orders array changed significantly
        if (orders.length !== this.orders.length || 
            (orders.length > 0 && orders[0].id !== this.orders[0]?.id)) {
          console.log('🔄 Orders changed! Updating...');
          
          // Sort orders by createdAt (newest first)
          this.orders = orders.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return dateB - dateA;
          });
          
          console.log(`📦 Orders updated: ${this.orders.length} orders`);
          
          // Update badge counts
          this.updateBadgeCounts();
          
          // Render only if not in detail view or if detail order is updated
          if (!this.ordersModule.viewingOrderId) {
            this.render();
          } else {
            // If in detail view, update detail modal too
            const order = this.orders.find(o => o.id === this.ordersModule.viewingOrderId);
            if (order) {
              this.ordersModule.viewingOrderId = order.id;
              this.render();
            }
          }
        } else {
          // Check if status changed for specific order (minor update)
          const changedOrder = orders.find(o => {
            const oldOrder = this.orders.find(oo => oo.id === o.id);
            return oldOrder && oldOrder.status !== o.status;
          });
          
          if (changedOrder) {
            console.log(`🔄 Order ${changedOrder.id} status changed to: ${changedOrder.status}`);
            this.orders = orders.sort((a, b) => {
              const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
              const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
              return dateB - dateA;
            });
            
            // Update badge counts
            this.updateBadgeCounts();
            
            // Render if in detail view
            if (this.ordersModule.viewingOrderId === changedOrder.id) {
              this.render();
            }
          }
        }
      });
      this.unsubscribers.push(unsubOrders);

      // Settings listener
      const unsubSettings = listenSettings((settings) => {
        this.settings = settings;
        console.log('⚙️ Settings updated');
        this.render();
      });
      this.unsubscribers.push(unsubSettings);

      // Load promos
      await this.loadPromos();

      console.log('✅ Data loaded successfully');

    } catch (error) {
      console.error('❌ Load data error:', error);
      throw error;
    }
  }

  async loadPromos() {
    try {
      this.promos = await PromoManager.getAllPromos();
      console.log('📢 Promos loaded:', this.promos.length);
      this.render();
    } catch (error) {
      console.error('Load promos error:', error);
      this.promos = [];
    }
  }

  // ==========================================
  // UPDATE BADGE COUNTS - NEW
  // ==========================================
  updateBadgeCounts() {
    // Update pending orders count for sidebar badge
    const pendingOrders = this.orders?.filter(o => 
      o.status === 'Menunggu Konfirmasi' || 
      o.status === 'Menunggu Pembayaran'
    ).length || 0;
    
    // Update badge in sidebar if exists
    const badge = document.querySelector('.sidebar-nav .nav-item[data-view="orders"] .nav-badge');
    if (badge) {
      if (pendingOrders > 0) {
        badge.textContent = pendingOrders;
        badge.style.display = 'inline';
        badge.classList.add('updating');
        setTimeout(() => badge.classList.remove('updating'), 500);
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // ==========================================
  // CLEANUP
  // ==========================================
  cleanup() {
    // Unsubscribe from Firestore listeners
    this.unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.unsubscribers = [];
    
    // Clear session monitor
    if (this.sessionCheckTimer) {
      clearInterval(this.sessionCheckTimer);
      this.sessionCheckTimer = null;
    }
  }

  destroy() {
    this.cleanup();
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
  }

  // ==========================================
  // NAVIGATION
  // ==========================================
  navigateTo(view) {
    // Track navigation
    Analytics.trackEvent('admin_navigation', { 
      from: this.currentView, 
      to: view 
    });
    
    this.currentView = view;
    this.render();
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  async login(email, password) {
    try {
      // Rate limit check
      const rateLimitKey = `login_${email}`;
      if (!RateLimiter.check(rateLimitKey)) {
        Notification.error('Terlalu banyak percobaan login. Coba lagi dalam 1 jam.');
        return;
      }
      
      console.log('🔐 Login attempt:', email);
      
      const result = await Auth.login(email, password);
      const { user, isAdmin } = result;
      
      console.log('✅ Login successful:', { 
        email: user.email, 
        isAdmin 
      });
      
      if (!isAdmin) {
        await Auth.logout();
        throw new Error('Anda tidak memiliki akses admin');
      }
      
      // Reset auth retries on successful login
      this.authRetries = 0;
      
      this.user = user;
      this.isAdmin = true;
      this.isLoggedIn = true;
      
      Analytics.trackAdminLogin(email, 'manual_login');
      
      Notification.success('Login berhasil!');
      
      // Load data
      await this.loadData();
      this.currentView = 'dashboard';
      this.render();
      
    } catch (error) {
      console.error('❌ Login error:', error);
      Notification.error(error.message);
      ErrorTracker.logError(error);
    }
  }

  async logout() {
    try {
      console.log('🚪 Logging out...');
      
      if (this.user) {
        Analytics.trackAdminLogout(this.user.email);
      }
      
      await Auth.logout();
      
      this.isLoggedIn = false;
      this.isAdmin = false;
      this.user = null;
      this.products = [];
      this.orders = [];
      this.settings = null;
      this.promos = [];
      
      this.cleanup();
      
      this.currentView = 'login';
      this.render();
      
      Notification.success('Logout berhasil');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      Notification.error('Gagal logout: ' + error.message);
      ErrorTracker.logError(error);
    }
  }

  // ==========================================
  // RENDER
  // ==========================================
  render() {
    const appElement = document.getElementById('app');
    
    if (this.loading) {
      appElement.innerHTML = this.renderLoading();
      return;
    }

    if (!this.isLoggedIn) {
      appElement.innerHTML = renderLoginForm(this);
      this.bindLoginEvents();
      return;
    }

    let content = '';
    switch (this.currentView) {
      case 'dashboard':
        content = this.dashboard.render();
        break;
      case 'products':
        content = this.productsModule.render();
        break;
      case 'orders':
        content = this.ordersModule.render();
        break;
      case 'promos':
        content = this.promosModule.render();
        break;
      case 'report':
        content = this.reportModule.render();
        break;
      case 'settings':
        content = this.settingsModule.render();
        break;
      default:
        content = this.dashboard.render();
    }

    appElement.innerHTML = renderAdminLayout(this, content);
    this.bindEvents();
  }

  renderLoading() {
    return `
      <div style="padding:60px;text-align:center;color:var(--muted);">
        <div style="font-size:40px;margin-bottom:20px;">⏳</div>
        <div>Memuat admin panel...</div>
      </div>
    `;
  }

  // ==========================================
  // EVENT BINDING
  // ==========================================
  bindLoginEvents() {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('[name="email"]').value;
        const password = loginForm.querySelector('[name="password"]').value;
        await this.login(email, password);
      };
    }
  }

  bindEvents() {
    // Close overlays
    document.querySelectorAll('.overlay').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('overlay')) {
          this.closeAllModals();
        }
      };
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  closeAllModals() {
    this.productsModule.closeEdit();
    this.ordersModule.closeDetail();
    this.promosModule.closeEdit();
    this.render();
  }

  // ==========================================
  // FORCE REFRESH DATA - NEW
  // ==========================================
  async forceRefreshData() {
    try {
      console.log('🔄 Force refreshing data...');
      Notification.info('🔄 Me-refresh data...');
      
      // Re-fetch all data
      this.products = await getProducts();
      this.orders = await getOrders();
      this.settings = await getSettings();
      this.promos = await PromoManager.getAllPromos();
      
      // Update badge counts
      this.updateBadgeCounts();
      
      // Force render
      this.render();
      
      Notification.success('✅ Data berhasil direfresh');
      
    } catch (error) {
      console.error('❌ Force refresh error:', error);
      Notification.error('Gagal refresh data: ' + error.message);
      ErrorTracker.logError(error);
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================
  getStats() {
    const validOrders = this.orders?.filter(o => o.status !== 'Dibatalkan') || [];
    const totalSales = validOrders.reduce((s, o) => s + (o.total || 0), 0);
    const lowStock = this.products.filter(p => p.stock > 0 && p.stock <= 3).length;
    const outStock = this.products.filter(p => p.stock <= 0).length;
    const pendingOrders = this.orders?.filter(o => 
      o.status === 'Menunggu Konfirmasi' || 
      o.status === 'Menunggu Pembayaran'
    ).length || 0;
    
    return {
      totalSales,
      totalOrders: this.orders?.length || 0,
      pendingOrders,
      lowStock,
      outStock,
      totalProducts: this.products.length
    };
  }

  getRecentOrders(limit = 5) {
    return [...(this.orders || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  formatDate(date) {
    return fmtDate(date);
  }

  formatPrice(price) {
    return rupiah(price);
  }

  escapeHtml(text) {
    return escapeHtml(text);
  }
}

// ==========================================
// INITIALIZE ADMIN APP
// ==========================================
console.log('🚀 Creating AdminApp instance...');
const adminApp = new AdminApp();
window.adminApp = adminApp;

// Ekspos method refresh ke window
window.adminApp.forceRefreshData = adminApp.forceRefreshData.bind(adminApp);

// Initialize with error handling
adminApp.init().catch(error => {
  console.error('❌ Failed to initialize admin app:', error);
  Notification.error('Gagal memuat admin panel: ' + error.message);
  ErrorTracker.logError(error);
});

// ==========================================
// EXPOSE TO WINDOW FOR DEBUGGING
// ==========================================
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('🔧 Admin debug mode:');
  console.log('  - adminApp: window.adminApp');
  console.log('  - Analytics: window.Analytics');
}
