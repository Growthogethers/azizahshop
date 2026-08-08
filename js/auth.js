// js/auth.js - PERBAIKAN
import { SessionManager } from './config.js';

export class Auth {
    // ============ AUTHENTICATION ============
    static async login(email, password) {
        try {
            // Validasi input
            if (!email || !password) {
                throw new Error('Email dan password harus diisi');
            }
            
            console.log('🔐 Attempting login...');
            
            // Login ke Firebase Authentication
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('✅ User authenticated:', user.email);
            console.log('🆔 UID:', user.uid);
            
            // Cek admin role dengan error handling yang aman
            const isAdmin = await this.checkAdminRole(user.uid);
            console.log('👑 Is Admin?', isAdmin);
            
            // Ambil user data dari Firestore (jika ada)
            let userData = null;
            try {
                userData = await this.getUserData(user.uid);
                console.log('📊 User data from Firestore:', userData);
            } catch (err) {
                console.warn('⚠️ Gagal membaca user data dari Firestore:', err);
                userData = { 
                    role: isAdmin ? 'admin' : 'customer', 
                    isAdmin: isAdmin,
                    displayName: user.displayName || user.email.split('@')[0]
                };
            }
            
            // Simpan session ke localStorage
            const sessionData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                isAdmin: isAdmin,
                role: userData?.role || (isAdmin ? 'admin' : 'customer'),
                lastLogin: new Date().toISOString()
            };
            
            console.log('💾 Saving session:', sessionData);
            await SessionManager.setSession(sessionData);
            
            // Update last login di Firestore (jika berhasil)
            try {
                if (userData && db) {
                    await db.collection('users').doc(user.uid).update({
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (err) {
                console.warn('⚠️ Could not update last login:', err);
            }
            
            return { 
                user, 
                isAdmin, 
                role: userData?.role || (isAdmin ? 'admin' : 'customer') 
            };
            
        } catch (error) {
            console.error('❌ Login error:', error);
            throw this.getAuthError(error.code);
        }
    }

    // ============ CHECK ADMIN ROLE ============
    static async checkAdminRole(uid) {
        try {
            console.log('🔍 Checking admin role for UID:', uid);
            
            // Jika UID kosong, return false
            if (!uid) {
                console.warn('⚠️ UID is empty');
                return false;
            }
            
            // Ambil user data dari Firestore
            const userData = await this.getUserData(uid);
            console.log('📊 User data:', userData);
            
            // Jika tidak ada data, default ke customer
            if (!userData) {
                console.warn('⚠️ User data not found, defaulting to customer');
                return false;
            }
            
            // Cek role admin (mendukung 2 format: 'role' atau 'isAdmin')
            const isAdmin = userData.role === 'admin' || userData.isAdmin === true;
            console.log('👑 Is admin?', isAdmin);
            
            return isAdmin;
            
        } catch (error) {
            console.error('❌ checkAdminRole error:', error);
            return false;
        }
    }

    // ============ USER DATA ============
    static async getUserData(uid) {
        try {
            if (typeof db === 'undefined') {
                console.warn('⚠️ db is undefined, returning null');
                return null;
            }
            
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('Get user data error:', error);
            return null; // Jangan throw error, kembalikan null
        }
    }

    static async saveUserData(user, isAdmin = false) {
        try {
            if (typeof db === 'undefined') {
                console.warn('⚠️ db is undefined, skipping saveUserData');
                return;
            }
            
            const userRef = db.collection('users').doc(user.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                // Create new user document
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL || null,
                    role: isAdmin ? 'admin' : 'customer',
                    isAdmin: isAdmin,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(userData);
                console.log('✅ New user document created for:', user.uid);
                return userData;
            }
            return userDoc.data();
        } catch (error) {
            console.error('Save user data error:', error);
            return null;
        }
    }

    // ============ GET CURRENT USER - PERBAIKAN ============
    static getCurrentUser() {
        try {
            // Get current user from Firebase Auth
            const user = firebase.auth().currentUser;
            return user || null;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    // ============ SESSION MANAGEMENT ============
    static async getSession() {
        return await SessionManager.getUser();
    }

    static async isLoggedIn() {
        const user = await SessionManager.getUser();
        return user !== null;
    }

    static async isAdmin() {
        const session = await SessionManager.getUser();
        return session?.isAdmin === true;
    }

    static async getCurrentUserData() {
        const session = await SessionManager.getUser();
        if (session) {
            return await this.getUserData(session.uid);
        }
        return null;
    }

    // ============ CHECKOUT WITHOUT LOGIN ============
    static async checkoutWithoutLogin(orderData) {
        try {
            // Simpan order ke Firestore tanpa auth
            const orderRef = await firebase.firestore().collection('orders').add({
                ...orderData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { id: orderRef.id, ...orderData };
        } catch (error) {
            console.error('Checkout without login error:', error);
            throw error;
        }
    }

    // ============ LOGOUT ============
    static async logout() {
        try {
            await firebase.auth().signOut();
            await SessionManager.clearSession();
            // Redirect jika di halaman admin
            if (window.location.pathname.includes('admin.html')) {
                window.location.href = 'admin.html';
            } else {
                window.location.reload();
            }
            console.log('✅ Logout berhasil');
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    // ============ AUTH STATE LISTENER ============
    static onAuthStateChanged(callback) {
        return firebase.auth().onAuthStateChanged(async (user) => {
            console.log('🔄 Auth state changed:', user ? user.email : 'null');
            
            if (user) {
                // Check admin role
                const isAdmin = await this.checkAdminRole(user.uid);
                
                // Save session
                await SessionManager.setSession({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL || null,
                    isAdmin: isAdmin,
                    role: isAdmin ? 'admin' : 'customer',
                    lastLogin: new Date().toISOString()
                });
                
                callback(user);
            } else {
                await SessionManager.clearSession();
                callback(null);
            }
        });
    }

    // ============ ERROR HANDLING ============
    static getAuthError(code) {
        const errors = {
            'auth/user-not-found': 'Email tidak ditemukan',
            'auth/wrong-password': 'Password salah',
            'auth/invalid-email': 'Email tidak valid',
            'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti',
            'auth/network-request-failed': 'Gagal terhubung ke server',
            'auth/email-already-in-use': 'Email sudah terdaftar',
            'auth/weak-password': 'Password terlalu lemah (minimal 6 karakter)',
            'auth/user-disabled': 'Akun Anda telah dinonaktifkan',
            'auth/operation-not-allowed': 'Metode login tidak diizinkan',
            'auth/invalid-credential': 'Email atau password salah'
        };
        return errors[code] || 'Terjadi kesalahan saat login: ' + code;
    }

    // ============ SIGN UP (Optional) ============
    static async signUp(email, password, displayName = null) {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Update display name
            if (displayName) {
                await user.updateProfile({ displayName });
            }
            
            // Save user data
            await this.saveUserData(user, false);
            
            return user;
        } catch (error) {
            console.error('Sign up error:', error);
            throw this.getAuthError(error.code);
        }
    }

    // ============ PASSWORD RESET ============
    static async resetPassword(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            return { success: true, message: 'Email reset password telah dikirim' };
        } catch (error) {
            console.error('Reset password error:', error);
            throw this.getAuthError(error.code);
        }
    }

    // ============ VERIFY EMAIL ============
    static async sendEmailVerification() {
        try {
            const user = firebase.auth().currentUser;
            if (user) {
                await user.sendEmailVerification();
                return { success: true, message: 'Email verifikasi telah dikirim' };
            }
            throw new Error('Tidak ada user yang login');
        } catch (error) {
            console.error('Send email verification error:', error);
            throw error;
        }
    }
}
