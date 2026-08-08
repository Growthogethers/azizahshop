// js/promo.js
import { Notification } from './notification.js';

export class PromoManager {
    static async getActivePromos() {
        try {
            const now = new Date();
            console.log('📢 Fetching promos...');
            
            const snapshot = await db.collection('promos')
                .where('active', '==', true)
                .get();
            
            const promos = snapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore timestamps ke Date
                if (data.startDate && data.startDate.toDate) {
                    data.startDate = data.startDate.toDate();
                }
                if (data.endDate && data.endDate.toDate) {
                    data.endDate = data.endDate.toDate();
                }
                return { id: doc.id, ...data };
            });
            
            // Filter by date
            const activePromos = promos.filter(p => {
                const start = p.startDate || new Date(0);
                const end = p.endDate || new Date(8640000000000000);
                return p.active && start <= now && end >= now;
            });
            
            console.log(`✅ Found ${activePromos.length} active promos`);
            return activePromos;
        } catch (error) {
            console.error('Get promos error:', error);
            return [];
        }
    }
    
    static async getAllPromos() {
        try {
            console.log('📢 Fetching all promos...');
            const snapshot = await db.collection('promos')
                .orderBy('createdAt', 'desc')
                .get();
            
            const promos = snapshot.docs.map(doc => {
                const data = doc.data();
                if (data.startDate && data.startDate.toDate) {
                    data.startDate = data.startDate.toDate();
                }
                if (data.endDate && data.endDate.toDate) {
                    data.endDate = data.endDate.toDate();
                }
                return { id: doc.id, ...data };
            });
            
            console.log(`✅ Found ${promos.length} total promos`);
            return promos;
        } catch (error) {
            console.error('Get all promos error:', error);
            return [];
        }
    }
    
    static async createPromo(data) {
        try {
            console.log('📝 Creating promo:', data.code);
            
            // Check if promo code already exists
            const existing = await db.collection('promos')
                .where('code', '==', data.code.toUpperCase())
                .get();
            
            if (!existing.empty) {
                throw new Error('Kode promo sudah digunakan');
            }
            
            const promo = {
                code: data.code.toUpperCase(),
                type: data.type,
                value: Number(data.value),
                minPurchase: Number(data.minPurchase) || 0,
                maxDiscount: Number(data.maxDiscount) || 0,
                maxUses: Number(data.maxUses) || 0,
                usedCount: 0,
                active: true,
                startDate: data.startDate,
                endDate: data.endDate,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('promos').add(promo);
            console.log('✅ Promo created with ID:', docRef.id);
            return { id: docRef.id, ...promo };
        } catch (error) {
            console.error('Create promo error:', error);
            throw error;
        }
    }
    
    static async togglePromo(id, active) {
        try {
            await db.collection('promos').doc(id).update({
                active: active,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Promo ${id} ${active ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error('Toggle promo error:', error);
            throw error;
        }
    }
    
    static async deletePromo(id) {
        try {
            await db.collection('promos').doc(id).delete();
            console.log('✅ Promo deleted:', id);
        } catch (error) {
            console.error('Delete promo error:', error);
            throw error;
        }
    }
    
    // ============ PERBAIKAN LOGIKA DISKON ============
    static async applyPromo(code, total) {
        try {
            console.log('🔍 Applying promo:', code);
            console.log('💰 Cart total:', total);
            
            const promoSnapshot = await db.collection('promos')
                .where('code', '==', code.toUpperCase())
                .where('active', '==', true)
                .get();
            
            if (promoSnapshot.empty) {
                return { valid: false, message: '❌ Kode promo tidak valid' };
            }
            
            const promoData = promoSnapshot.docs[0].data();
            const promoId = promoSnapshot.docs[0].id;
            const now = new Date();
            
            // Cek tanggal
            const startDate = promoData.startDate?.toDate?.() || promoData.startDate || new Date(0);
            const endDate = promoData.endDate?.toDate?.() || promoData.endDate || new Date(8640000000000000);
            
            if (now < startDate || now > endDate) {
                return { valid: false, message: '❌ Kode promo sudah kadaluarsa' };
            }
            
            // Cek minimal pembelian
            if (promoData.minPurchase && total < promoData.minPurchase) {
                return { 
                    valid: false, 
                    message: `❌ Minimal pembelian ${rupiah(promoData.minPurchase)}` 
                };
            }
            
            // Cek maksimal penggunaan
            if (promoData.maxUses && promoData.usedCount >= promoData.maxUses) {
                return { valid: false, message: '❌ Kode promo sudah habis digunakan' };
            }
            
            // ============ PERBAIKAN LOGIKA DISKON ============
            let discount = 0;
            
            if (promoData.type === 'percentage') {
                // Diskon persentase
                discount = total * (promoData.value / 100);
                
                // Batasi dengan maxDiscount jika ada
                if (promoData.maxDiscount && discount > promoData.maxDiscount) {
                    discount = promoData.maxDiscount;
                }
            } else {
                // Diskon nominal
                discount = promoData.value;
            }
            
            // PENTING: Diskon tidak boleh melebihi total belanja
            if (discount > total) {
                discount = total;
            }
            
            console.log('💰 Total:', total);
            console.log('💸 Discount calculated:', discount);
            console.log('💳 Total after discount:', total - discount);
            
            // Update penggunaan promo
            await db.collection('promos').doc(promoId).update({
                usedCount: firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Format pesan
            let message = `✅ Diskon ${promoData.type === 'percentage' ? promoData.value + '%' : rupiah(discount)} berhasil!`;
            if (promoData.type === 'percentage' && promoData.maxDiscount) {
                message = `✅ Diskon ${promoData.value}% (maks. ${rupiah(promoData.maxDiscount)}) berhasil!`;
            }
            
            return {
                valid: true,
                discount: discount,
                totalAfterDiscount: total - discount,
                promoCode: promoData.code,
                message: message
            };
        } catch (error) {
            console.error('Apply promo error:', error);
            return { valid: false, message: '❌ Terjadi kesalahan, coba lagi' };
        }
    }
}

// Helper function untuk format rupiah (gunakan dari config)
function rupiah(n) {
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
}