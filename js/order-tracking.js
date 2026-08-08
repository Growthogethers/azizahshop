export class OrderTracking {
    static async getStatus(orderId) {
        const doc = await db.collection('orders').doc(orderId).get();
        return doc.data()?.status || 'Tidak ditemukan';
    }
    
    static async getTimeline(orderId) {
        const snapshot = await db.collection('order_timeline')
            .where('orderId', '==', orderId)
            .orderBy('createdAt', 'asc')
            .get();
        return snapshot.docs.map(doc => doc.data());
    }
    
    static async updateStatus(orderId, status, note = '') {
        await db.collection('orders').doc(orderId).update({ status });
        await db.collection('order_timeline').add({
            orderId,
            status,
            note,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}