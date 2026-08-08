// js/rate-limiter.js
// ============================================
// RATE LIMITER
// ============================================

export class RateLimiter {
  static attempts = {};
  static cleanupTimer = null;

  // ==========================================
  // RATE LIMIT CHECK
  // ==========================================
  static check(key, limit = 5, windowMs = 60000) {
    // Cleanup old entries periodically
    this.cleanup();

    const now = Date.now();
    
    // Initialize attempts for key
    if (!this.attempts[key]) {
      this.attempts[key] = [];
    }
    
    // Filter out old attempts
    this.attempts[key] = this.attempts[key]
      .filter(timestamp => now - timestamp < windowMs);
    
    // Check if limit exceeded
    if (this.attempts[key].length >= limit) {
      console.warn(`🚫 Rate limit exceeded for: ${key}`);
      return false;
    }
    
    // Add current attempt
    this.attempts[key].push(now);
    
    return true;
  }

  // ==========================================
  // CLEANUP
  // ==========================================
  static cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    // Clean up old attempts
    Object.keys(this.attempts).forEach(key => {
      this.attempts[key] = this.attempts[key]
        .filter(timestamp => now - timestamp < maxAge);
      
      // Remove empty keys
      if (this.attempts[key].length === 0) {
        delete this.attempts[key];
      }
    });
  }

  // ==========================================
  // RESET
  // ==========================================
  static reset(key) {
    if (key) {
      delete this.attempts[key];
    } else {
      this.attempts = {};
    }
    console.log('🔄 Rate limiter reset');
  }

  // ==========================================
  // GET STATUS
  // ==========================================
  static getStatus(key) {
    if (!this.attempts[key]) {
      return {
        attempts: 0,
        remaining: Infinity,
        resetTime: null
      };
    }
    
    const attempts = this.attempts[key].length;
    return {
      attempts: attempts,
      remaining: Math.max(0, 5 - attempts),
      resetTime: attempts > 0 ? this.attempts[key][0] + 60000 : null
    };
  }
}
