// js/db.js - FULL
import { CONFIG } from './config.js';

// Collections
const COLLECTIONS = {
    PRODUCTS: 'products',
    ORDERS: 'orders',
    SETTINGS: 'settings',
    USERS: 'users'
};

// ============ PRODUCT OPERATIONS ============
export async function getProducts() {
    try {
        console.log('📦 Getting products...');
        const snapshot = await db.collection(COLLECTIONS.PRODUCTS)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting products:', error);
        return [];
    }
}

export async function addProduct(product) {
    try {
        const docRef = await db.collection(COLLECTIONS.PRODUCTS).add({
            ...product,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: docRef.id, ...product };
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
}

export async function updateProduct(id, product) {
    try {
        await db.collection(COLLECTIONS.PRODUCTS).doc(id).update({
            ...product,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id, ...product };
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
}

export async function deleteProduct(id) {
    try {
        await db.collection(COLLECTIONS.PRODUCTS).doc(id).delete();
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
}

// ============ ORDER OPERATIONS ============
export async function getOrders() {
    try {
        console.log('📦 Getting orders from Firestore...');
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .orderBy('createdAt', 'desc')
            .get();
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`📦 Found ${orders.length} orders`);
        return orders;
    } catch (error) {
        console.error('Error getting orders:', error);
        return [];
    }
}

export async function addOrder(order) {
    try {
        console.log('📦 Menambahkan order...', order);
        
        // Validasi order
        if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
            throw new Error('Order tidak memiliki items');
        }

        // Cek stok sebelum simpan
        for (const item of order.items) {
            const productRef = db.collection('products').doc(item.id);
            const productDoc = await productRef.get();
            
            if (!productDoc.exists) {
                throw new Error(`Produk ${item.name} tidak ditemukan`);
            }
            
            const currentStock = productDoc.data().stock || 0;
            if (currentStock < item.qty) {
                throw new Error(`Stok ${item.name} tidak mencukupi. Tersedia: ${currentStock}, dibutuhkan: ${item.qty}`);
            }
        }
        
        // Simpan order
        const orderRef = db.collection('orders').doc();
        const orderData = {
            ...order,
            id: orderRef.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await orderRef.set(orderData);
        console.log('✅ Order saved with ID:', orderRef.id);
        
        // KURANGI STOK
        for (const item of order.items) {
            const productRef = db.collection('products').doc(item.id);
            await productRef.update({
                stock: firebase.firestore.FieldValue.increment(-item.qty)
            });
            console.log(`📦 Stok ${item.name} dikurangi ${item.qty}`);
        }
        
        return { id: orderRef.id, ...order };
        
    } catch (error) {
        console.error('❌ Error adding order:', error);
        throw error;
    }
}

// ==========================================
// UPDATE ORDER - PERBAIKAN
// ==========================================
export async function updateOrder(id, data) {
    try {
        console.log(`📦 Updating order ${id}:`, data);
        
        // Validasi data
        if (!data || typeof data !== 'object') {
            throw new Error('Data update tidak valid');
        }
        
        // Pastikan status valid
        if (data.status && !CONFIG.STATUS_LIST.includes(data.status)) {
            throw new Error(`Status "${data.status}" tidak valid`);
        }
        
        // Get current order data for audit
        const docRef = db.collection('orders').doc(id);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            throw new Error('Order tidak ditemukan');
        }
        
        const currentData = doc.data();
        
        // Update di Firestore
        await docRef.update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            _history: firebase.firestore.FieldValue.arrayUnion({
                status: data.status || currentData.status,
                timestamp: new Date().toISOString(),
                note: data.note || 'Status updated'
            })
        });
        
        console.log(`✅ Order ${id} updated successfully`);
        
        // Return updated data with server timestamp
        return { 
            id, 
            ...currentData, 
            ...data, 
            updatedAt: new Date().toISOString() 
        };
        
    } catch (error) {
        console.error('❌ Error updating order:', error);
        throw error;
    }
}

export async function cancelOrder(id) {
    try {
        console.log('📦 Canceling order:', id);
        
        const orderRef = db.collection(COLLECTIONS.ORDERS).doc(id);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            throw new Error('Order tidak ditemukan');
        }
        
        const order = orderDoc.data();
        
        // Update status order
        await orderRef.update({
            status: 'Dibatalkan',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Kembalikan stok
        if (order.status !== 'Dibatalkan') {
            for (const item of order.items) {
                const productRef = db.collection('products').doc(item.id);
                await productRef.update({
                    stock: firebase.firestore.FieldValue.increment(item.qty)
                });
                console.log(`📦 Stok ${item.name} dikembalikan ${item.qty}`);
            }
        }
        
        return { id, status: 'Dibatalkan' };
    } catch (error) {
        console.error('Error canceling order:', error);
        throw error;
    }
}

// ============ SETTINGS OPERATIONS ============
export async function getSettings() {
    try {
        console.log('⚙️ Getting settings...');
        const doc = await db.collection(COLLECTIONS.SETTINGS).doc('config').get();
        if (doc.exists) {
            return doc.data();
        } else {
            console.log('Settings not found, creating default...');
            await db.collection(COLLECTIONS.SETTINGS).doc('config').set(CONFIG.DEFAULT_SETTINGS);
            return CONFIG.DEFAULT_SETTINGS;
        }
    } catch (error) {
        console.error('Error getting settings:', error);
        return CONFIG.DEFAULT_SETTINGS;
    }
}

export async function updateSettings(settings) {
    try {
        await db.collection(COLLECTIONS.SETTINGS).doc('config').update({
            ...settings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        throw error;
    }
}

// ============ BATCH OPERATIONS (Untuk Restore) ============
export async function batchWrite(data) {
    try {
        const batch = db.batch();
        
        // Products
        if (data.products && Array.isArray(data.products)) {
            for (const product of data.products) {
                const { id, ...productData } = product;
                const ref = db.collection(COLLECTIONS.PRODUCTS).doc(id);
                batch.set(ref, productData, { merge: true });
            }
        }
        
        // Orders
        if (data.orders && Array.isArray(data.orders)) {
            for (const order of data.orders) {
                const { id, ...orderData } = order;
                const ref = db.collection(COLLECTIONS.ORDERS).doc(id);
                batch.set(ref, orderData, { merge: true });
            }
        }
        
        // Settings
        if (data.settings) {
            const ref = db.collection(COLLECTIONS.SETTINGS).doc('config');
            batch.set(ref, data.settings, { merge: true });
        }
        
        // Promos
        if (data.promos && Array.isArray(data.promos)) {
            for (const promo of data.promos) {
                const { id, ...promoData } = promo;
                const ref = db.collection('promos').doc(id);
                batch.set(ref, promoData, { merge: true });
            }
        }
        
        await batch.commit();
        console.log('✅ Batch write successful');
        return { success: true, message: 'Data berhasil dipulihkan' };
    } catch (error) {
        console.error('Batch write error:', error);
        throw error;
    }
}

// ============ REAL-TIME LISTENERS ============
export function listenProducts(callback) {
    console.log('👂 Listening to products...');
    return db.collection(COLLECTIONS.PRODUCTS)
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(products);
        }, error => {
            console.error('Error listening to products:', error);
        });
}

export function listenOrders(callback) {
    console.log('👂 Setting up orders listener...');
    
    return db.collection('orders')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
            (snapshot) => {
                if (snapshot.empty) {
                    console.log('📦 No orders found');
                    callback([]);
                    return;
                }
                
                const orders = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, ...data };
                });
                
                console.log(`📦 Orders listener received ${orders.length} orders`);
                callback(orders);
            },
            (error) => {
                console.error('❌ Error listening to orders:', error);
                callback([]);
            }
        );
}

export function listenSettings(callback) {
    console.log('👂 Listening to settings...');
    return db.collection(COLLECTIONS.SETTINGS)
        .doc('config')
        .onSnapshot(doc => {
            if (doc.exists) {
                callback(doc.data());
            }
        }, error => {
            console.error('Error listening to settings:', error);
        });
}
