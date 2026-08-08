export class BulkOperations {
    static async deleteProducts(productIds) {
        const batch = db.batch();
        productIds.forEach(id => {
            const ref = db.collection('products').doc(id);
            batch.delete(ref);
        });
        await batch.commit();
    }
    
    static async updateStock(productIds, stock) {
        const batch = db.batch();
        productIds.forEach(id => {
            const ref = db.collection('products').doc(id);
            batch.update(ref, { stock });
        });
        await batch.commit();
    }
    
    static async exportOrders(startDate, endDate) {
        const orders = await db.collection('orders')
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .get();
        
        return orders.docs.map(doc => doc.data());
    }
}