// js/error-tracking.js
// ============================================
// ERROR TRACKER - Refactored
// ============================================

import { Notification } from './notification.js';

export class ErrorTracker {
  static init() {
    console.log('🐛 ErrorTracker initialized');
    
    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('🚨 Global Error:', { message, source, lineno, colno });
      this.logError({
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        error: error
      });
    };
    
    // Unhandled promise rejection
    window.onunhandledrejection = (event) => {
      console.error('🚨 Unhandled Rejection:', event.reason);
      this.logError({
        message: event.reason?.message || 'Unhandled rejection',
        stack: event.reason?.stack,
        type: 'unhandledrejection',
        reason: event.reason
      });
    };
    
    // Console error override
    const originalConsoleError = console.error;
    console.error = function(...args) {
      originalConsoleError.apply(console, args);
      ErrorTracker.logError({
        message: args.join(' '),
        type: 'console.error',
        source: 'console'
      });
    };
  }
  
  // ==========================================
  // CORE LOGGING METHOD
  // ==========================================
  static async logError(errorData) {
    try {
      // Sanitasi error data sebelum disimpan ke Firestore
      const sanitizedData = this.sanitizeErrorData(errorData);
      
      console.warn('📝 Error logged:', sanitizedData);
      
      // Simpan ke Firestore jika tersedia
      if (typeof db !== 'undefined' && db) {
        await db.collection('errors').add({
          ...sanitizedData,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          platform: navigator.platform,
          language: navigator.language
        }).catch(err => {
          console.warn('⚠️ Failed to log error to Firestore:', err.message);
        });
      }
    } catch (e) {
      console.error('❌ Error tracking failed:', e.message);
    }
  }

  // ==========================================
  // SANITIZATION
  // ==========================================
  static sanitizeErrorData(data) {
    if (!data || typeof data !== 'object') {
      return { message: String(data || 'Unknown error') };
    }
    
    const sanitized = {};
    
    // Handle Error objects
    if (data instanceof Error) {
      sanitized.message = data.message || 'Error';
      sanitized.stack = data.stack || '';
      sanitized.name = data.name || 'Error';
      return sanitized;
    }
    
    // Handle regular objects
    for (const [key, value] of Object.entries(data)) {
      // Skip jika key adalah 'error' yang berisi objek Error
      if (key === 'error' && value instanceof Error) {
        sanitized.error = {
          message: value.message || 'Error',
          stack: value.stack || '',
          name: value.name || 'Error'
        };
        continue;
      }
      
      // Skip jika key adalah 'reason' (dari unhandledrejection)
      if (key === 'reason' && value instanceof Error) {
        sanitized.reason = {
          message: value.message || 'Error',
          stack: value.stack || '',
          name: value.name || 'Error'
        };
        continue;
      }
      
      // Handle nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeErrorData(value);
        continue;
      }
      
      // Handle arrays
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item => {
          if (item instanceof Error) {
            return {
              message: item.message || 'Error',
              stack: item.stack || '',
              name: item.name || 'Error'
            };
          }
          if (item && typeof item === 'object') {
            return this.sanitizeErrorData(item);
          }
          return item;
        });
        continue;
      }
      
      // Handle primitives
      if (typeof value === 'string' || 
          typeof value === 'number' || 
          typeof value === 'boolean' || 
          value === null) {
        sanitized[key] = value;
        continue;
      }
      
      // Convert anything else to string
      try {
        sanitized[key] = JSON.stringify(value);
      } catch (e) {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================
  static logInfo(message, data = {}) {
    console.log('ℹ️', message, data);
    this.logError({ 
      message, 
      ...this.sanitizeErrorData(data), 
      type: 'info' 
    });
  }
  
  static logWarning(message, data = {}) {
    console.warn('⚠️', message, data);
    this.logError({ 
      message, 
      ...this.sanitizeErrorData(data), 
      type: 'warning' 
    });
  }
  
  static logDebug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('🔍', message, data);
    }
    this.logError({ 
      message, 
      ...this.sanitizeErrorData(data), 
      type: 'debug' 
    });
  }

  // ==========================================
  // GET RECENT ERRORS (Admin Only)
  // ==========================================
  static async getRecentErrors(limit = 50) {
    try {
      if (typeof db === 'undefined' || !db) {
        return [];
      }
      
      const snapshot = await db.collection('errors')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Failed to get errors:', error.message);
      return [];
    }
  }

  // ==========================================
  // CLEAR ERRORS (Admin Only)
  // ==========================================
  static async clearErrors(olderThan = 7) {
    try {
      if (typeof db === 'undefined' || !db) {
        return;
      }
      
      // Hapus error yang lebih lama dari N hari
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThan);
      
      const snapshot = await db.collection('errors')
        .where('timestamp', '<', cutoffDate)
        .get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`🧹 Cleared ${snapshot.size} old errors`);
      
    } catch (error) {
      console.error('❌ Failed to clear errors:', error.message);
    }
  }
}

// ==========================================
// EXPOSE TO WINDOW
// ==========================================
window.ErrorTracker = ErrorTracker;
