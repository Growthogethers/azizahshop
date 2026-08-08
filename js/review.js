export class ReviewSystem {
    static async addReview(productId, userId, userName, rating, comment) {
        try {
            const review = {
                productId,
                userId,
                userName,
                rating: Math.min(5, Math.max(1, rating)),
                comment: comment || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('reviews').add(review);
            
            // Update product rating
            await this.updateProductRating(productId);
            
            return { id: docRef.id, ...review };
        } catch (error) {
            console.error('Add review error:', error);
            throw error;
        }
    }
    
    static async getProductReviews(productId) {
        try {
            const snapshot = await db.collection('reviews')
                .where('productId', '==', productId)
                .orderBy('createdAt', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Get reviews error:', error);
            return [];
        }
    }
    
    static async updateProductRating(productId) {
        try {
            const reviews = await this.getProductReviews(productId);
            
            if (reviews.length === 0) {
                await db.collection('products').doc(productId).update({
                    rating: 0,
                    totalReviews: 0
                });
                return;
            }
            
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
            const averageRating = totalRating / reviews.length;
            
            await db.collection('products').doc(productId).update({
                rating: Math.round(averageRating * 10) / 10,
                totalReviews: reviews.length
            });
        } catch (error) {
            console.error('Update product rating error:', error);
        }
    }
    
    static async deleteReview(reviewId, productId) {
        try {
            await db.collection('reviews').doc(reviewId).delete();
            await this.updateProductRating(productId);
        } catch (error) {
            console.error('Delete review error:', error);
            throw error;
        }
    }
    
    static async getProductRatingStats(productId) {
        const reviews = await this.getProductReviews(productId);
        const stats = {
            total: reviews.length,
            average: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
        
        if (reviews.length === 0) return stats;
        
        const total = reviews.reduce((sum, r) => {
            stats.distribution[r.rating] = (stats.distribution[r.rating] || 0) + 1;
            return sum + r.rating;
        }, 0);
        
        stats.average = Math.round((total / reviews.length) * 10) / 10;
        return stats;
    }
}