export class Wishlist {
    constructor(userId) {
        this.userId = userId;
        this.items = [];
    }
    
    async load() {
        const doc = await db.collection('wishlists').doc(this.userId).get();
        this.items = doc.exists ? doc.data().items || [] : [];
        return this.items;
    }
    
    async toggle(productId) {
        const index = this.items.indexOf(productId);
        if (index > -1) {
            this.items.splice(index, 1);
        } else {
            this.items.push(productId);
        }
        await db.collection('wishlists').doc(this.userId).set({
            items: this.items,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return index === -1; // true if added
    }
    
    async isWishlisted(productId) {
        return this.items.includes(productId);
    }
}