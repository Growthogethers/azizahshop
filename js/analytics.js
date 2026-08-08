// js/analytics.js - FULL
// ============================================
// ANALYTICS MANAGER - Google Analytics 4
// ============================================

export class Analytics {
  static initialized = false;
  static ga4Id = 'G-LDY7BHEB1R';

  // ==========================================
  // INITIALIZATION
  // ==========================================
  static init(ga4Id = 'G-LDY7BHEB1R') {
    try {
      if (this.initialized) {
        console.log('📊 Analytics already initialized');
        return true;
      }

      this.ga4Id = ga4Id;

      // Check if gtag is loaded
      if (typeof gtag === 'undefined') {
        console.warn('⚠️ Google Analytics (gtag) not loaded. Attempting to load...');
        
        // Try to load gtag dynamically
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
        document.head.appendChild(script);
        
        // Define gtag if not available
        window.dataLayer = window.dataLayer || [];
        window.gtag = function() {
          window.dataLayer.push(arguments);
        };
        
        // Initialize gtag after script loads
        script.onload = () => {
          gtag('js', new Date());
          gtag('config', ga4Id, {
            'send_page_view': true,
            'allow_google_signals': true,
            'allow_ad_personalization_signals': true
          });
          console.log('📊 Google Analytics 4 initialized (loaded dynamically)');
          this.initialized = true;
          this.trackPageView(window.location.pathname);
        };
        
        return false;
      }

      // Already initialized
      gtag('js', new Date());
      gtag('config', ga4Id, {
        'send_page_view': true,
        'allow_google_signals': true,
        'allow_ad_personalization_signals': true
      });
      
      console.log('📊 Google Analytics 4 initialized');
      this.initialized = true;
      
      // Track initial page view
      this.trackPageView(window.location.pathname);
      
      return true;
    } catch (error) {
      console.error('❌ GA4 init error:', error);
      return false;
    }
  }

  // ==========================================
  // CORE TRACKING METHODS
  // ==========================================
  static trackEvent(eventName, params = {}) {
    try {
      // Ensure gtag is available
      if (typeof gtag === 'undefined') {
        console.warn('⚠️ gtag not available, skipping event:', eventName);
        return;
      }
      
      const defaultParams = {
        event_category: 'user_action',
        event_label: eventName,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        screen_resolution: `${window.innerWidth}x${window.innerHeight}`
      };
      
      const eventParams = { ...defaultParams, ...params };
      
      gtag('event', eventName, eventParams);
      
      // Debug logging (development only)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`📊 GA4 Event: ${eventName}`, eventParams);
      }
      
      // Also save to Firestore for backup (optional)
      this.saveToFirestore(eventName, eventParams);
      
    } catch (error) {
      console.error('❌ GA4 track event error:', error);
    }
  }

  static trackPageView(pagePath, pageTitle = null) {
    try {
      if (typeof gtag === 'undefined') {
        console.warn('⚠️ gtag not available, skipping page view');
        return;
      }
      
      gtag('event', 'page_view', {
        page_title: pageTitle || document.title,
        page_location: window.location.href,
        page_path: pagePath || window.location.pathname
      });
      
      console.log(`📊 Page View: ${pagePath || window.location.pathname}`);
    } catch (error) {
      console.error('❌ GA4 page view error:', error);
    }
  }

  // ==========================================
  // USER TRACKING
  // ==========================================
  static setUserId(userId) {
    try {
      if (typeof gtag === 'undefined') return;
      gtag('config', this.ga4Id, {
        'user_id': userId
      });
      console.log(`👤 GA4 User ID set: ${userId}`);
    } catch (error) {
      console.error('❌ GA4 set user error:', error);
    }
  }

  static setUserProperties(properties) {
    try {
      if (typeof gtag === 'undefined') return;
      gtag('set', 'user_properties', properties);
      console.log('👤 GA4 User properties:', properties);
    } catch (error) {
      console.error('❌ GA4 set user properties error:', error);
    }
  }

  // ==========================================
  // PRODUCT EVENTS
  // ==========================================
  static trackProductView(productId, productName) {
    this.trackEvent('view_item', { 
      item_id: productId,
      item_name: productName
    });
  }

  static trackAddToCart(productId, productName, quantity, price) {
    this.trackEvent('add_to_cart', { 
      currency: 'IDR',
      value: quantity * price,
      items: [{
        item_id: productId,
        item_name: productName,
        quantity: quantity,
        price: price
      }]
    });
  }

  static trackRemoveFromCart(productId, productName, quantity) {
    this.trackEvent('remove_from_cart', { 
      items: [{
        item_id: productId,
        item_name: productName,
        quantity: quantity
      }]
    });
  }

  static trackViewCart() {
    this.trackEvent('view_cart');
  }

  // ==========================================
  // CHECKOUT EVENTS
  // ==========================================
  static trackBeginCheckout(total, itemCount) {
    this.trackEvent('begin_checkout', { 
      value: total,
      currency: 'IDR',
      items: []
    });
  }

  static trackPurchase(orderId, total, items) {
    this.trackEvent('purchase', { 
      transaction_id: orderId,
      value: total,
      currency: 'IDR',
      items: items || []
    });
  }

  // ==========================================
  // SEARCH EVENTS
  // ==========================================
  static trackSearch(query, resultsCount) {
    this.trackEvent('search', { 
      search_term: query,
      result_count: resultsCount
    });
  }

  // ==========================================
  // PROMO EVENTS
  // ==========================================
  static trackPromoApplied(code, discount) {
    this.trackEvent('promo_applied', { 
      promo_code: code,
      discount: discount
    });
  }

  // ==========================================
  // ERROR EVENTS
  // ==========================================
  static trackError(errorMessage, errorType = 'javascript') {
    this.trackEvent('error_occurred', {
      error_message: errorMessage,
      error_type: errorType
    });
  }

  // ==========================================
  // ADMIN EVENTS
  // ==========================================
  static trackAdminLogin(email, method = 'email') {
    this.trackEvent('admin_login', {
      email: email,
      method: method
    });
  }

  static trackAdminLogout(email) {
    this.trackEvent('admin_logout', {
      email: email
    });
  }

  static trackAdminAction(action, details = {}) {
    this.trackEvent('admin_action', {
      action: action,
      ...details
    });
  }

  // ==========================================
  // PRODUCT ADMIN EVENTS - TAMBAHKAN INI
  // ==========================================
  static trackProductAdded(product) {
    this.trackEvent('product_added', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_stock: product.stock
    });
  }

  static trackProductUpdated(productId, changes) {
    this.trackEvent('product_updated', {
      product_id: productId,
      changes: JSON.stringify(changes)
    });
  }

  static trackProductDeleted(productId, productName) {
    this.trackEvent('product_deleted', {
      product_id: productId,
      product_name: productName
    });
  }

  static trackSettingsUpdated(settings) {
    this.trackEvent('settings_updated', {
      settings: JSON.stringify(settings)
    });
  }

  static trackBackupDownloaded() {
    this.trackEvent('backup_downloaded');
  }

  static trackRestoreCompleted() {
    this.trackEvent('restore_completed');
  }

  // ==========================================
  // FIRESTORE BACKUP (OPSIONAL)
  // ==========================================
  static async saveToFirestore(eventName, params) {
    try {
      // Only save important events to Firestore
      const importantEvents = ['purchase', 'add_to_cart', 'admin_login'];
      if (!importantEvents.includes(eventName)) {
        return;
      }
      
      if (typeof db === 'undefined' || !db) {
        return;
      }
      
      await db.collection('analytics').add({
        event: eventName,
        data: params,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      console.log(`📝 Event saved to Firestore: ${eventName}`);
    } catch (error) {
      // Silent fail - don't break the app
      console.debug('⚠️ Failed to save analytics to Firestore:', error.message);
    }
  }

  // ==========================================
  // DEBUG HELPER
  // ==========================================
  static testConnection() {
    console.log('🔍 Testing GA4 connection...');
    if (typeof gtag !== 'undefined') {
      console.log('✅ gtag is available');
      this.trackEvent('test_event', { message: 'GA4 test event' });
      console.log('✅ Test event sent. Check GA4 debug view.');
      return true;
    } else {
      console.error('❌ gtag is NOT available');
      return false;
    }
  }
}

// ==========================================
// EXPOSE TO WINDOW
// ==========================================
window.Analytics = Analytics;

// ==========================================
// AUTO-INITIALIZATION
// ==========================================
(function autoInitAnalytics() {
  const GA4_ID = 'G-LDY7BHEB1R';
  
  if (document.readyState === 'complete') {
    setTimeout(() => Analytics.init(GA4_ID), 100);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => Analytics.init(GA4_ID), 100);
    });
  }
})();
