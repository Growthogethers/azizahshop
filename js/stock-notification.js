export class StockNotification {
    static async subscribe(productId, email) {
        await db.collection('stock_notifications').add({
            productId,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            sent: false
        });
    }
    
    static async checkLowStock() {
        const products = await getProducts();
        const lowStock = products.filter(p => p.stock <= 3);
        
        for (const product of lowStock) {
            const subscribers = await db.collection('stock_notifications')
                .where('productId', '==', product.id)
                .where('sent', '==', false)
                .get();
            
            for (const doc of subscribers.docs) {
                // Send email notification
                await this.sendNotification(doc.data().email, product);
                await doc.ref.update({ sent: true });
            }
        }
    }
}