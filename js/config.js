// js/config.js
export const CONFIG = {
    SHIPPING_OPTIONS: ['JNE', 'J&T', 'SiCepat', 'Anteraja', 'Lainnya'],
    // Status yang konsisten dengan alur:
    // Menunggu Pembayaran → Menunggu Konfirmasi → Diproses → Dikirim → Selesai → Dibatalkan
    STATUS_LIST: [
        'Menunggu Pembayaran',
        'Menunggu Konfirmasi',
        'Diproses',
        'Dikirim',
        'Selesai',
        'Dibatalkan'
    ],
    STATUS_CLASS: {
        'Menunggu Pembayaran': 'wait',
        'Menunggu Konfirmasi': 'wait',
        'Diproses': 'process',
        'Dikirim': 'ship',
        'Selesai': 'done',
        'Dibatalkan': 'cancel'
    },
    DEFAULT_SETTINGS: {
        shopName: 'Toko Online',
        tagline: 'Belanja gampang, tinggal chat WhatsApp',
        waNumber: '6285227601111',
        bankName: 'BCA',
        bankAccount: '11111111111',
        accountHolder: '',
        adminEmail: 'admin@toko.com',
        enableQRIS: true
    }
};

export function rupiah(n) {
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fmtDate(iso) {
    if (!iso) return '-';
    
    try {
        let date;
        // Handle Firestore timestamp
        if (iso && typeof iso === 'object' && iso.toDate && typeof iso.toDate === 'function') {
            date = iso.toDate();
        } else if (typeof iso === 'string' || typeof iso === 'number') {
            date = new Date(iso);
        } else if (iso instanceof Date) {
            date = iso;
        } else {
            return '-';
        }
        
        // Check if valid date
        if (isNaN(date.getTime())) {
            return '-';
        }
        
        return date.toLocaleDateString('id-ID', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        }) + ' ' + date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch (error) {
        console.warn('Date formatting error:', error);
        return '-';
    }
}

export function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c] || c));
}

export function resizeImage(file, maxW = 800, quality = 0.72) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let w = img.width,
                    h = img.height;
                if (w > maxW) {
                    h = Math.round(h * (maxW / w));
                    w = maxW;
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============ SESSION MANAGER (DIPERBAIKI) ============
export class SessionManager {
    static async getSession() {
        try {
            const session = localStorage.getItem('userSession');
            if (session) {
                return JSON.parse(session);
            }
            return null;
        } catch (error) {
            console.error('Session get error:', error);
            return null;
        }
    }
    
    static async setSession(user) {
        try {
            // Validasi input
            if (!user || !user.uid) {
                console.error('❌ Invalid user data for session:', user);
                return null;
            }

            const session = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || user.email?.split('@')[0] || 'User',
                photoURL: user.photoURL || null,
                emailVerified: user.emailVerified || false,
                isAdmin: user.isAdmin === true,
                role: user.role || (user.isAdmin ? 'admin' : 'customer'),
                lastLogin: new Date().toISOString()
            };
            
            localStorage.setItem('userSession', JSON.stringify(session));
            console.log('💾 Session saved:', session);
            return session;
        } catch (error) {
            console.error('❌ Session set error:', error);
            return null;
        }
    }
    
    static async clearSession() {
        try {
            localStorage.removeItem('userSession');
            localStorage.removeItem('theme');
            console.log('🧹 Session cleared');
        } catch (error) {
            console.error('Session clear error:', error);
        }
    }
    
    static async refreshSession(user) {
        return await this.setSession(user);
    }
    
    static async isSessionValid() {
        const session = await this.getSession();
        if (!session) return false;
        
        // Check if session is expired (7 days)
        const lastLogin = new Date(session.lastLogin);
        const now = new Date();
        const diffDays = (now - lastLogin) / (1000 * 60 * 60 * 24);
        
        return diffDays < 7;
    }
    
    static async getUser() {
        const session = await this.getSession();
        if (session && await this.isSessionValid()) {
            return session;
        }
        return null;
    }

    // Helper untuk debugging
    static async debugSession() {
        const session = await this.getSession();
        console.log('📦 Current session:', session);
        return session;
    }
}

export function createAdminUser(uid, email) {
    return {
        uid,
        email,
        isAdmin: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
}