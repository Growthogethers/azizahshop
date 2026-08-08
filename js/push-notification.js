// js/push-notification.js
export class PushNotification {
    static async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Browser tidak support notification');
            return;
        }
        
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    static async sendNotification(title, body, icon = '/assets/icons/icon-192.png') {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon,
                badge: '/assets/icons/icon-192.png',
                vibrate: [200, 100, 200]
            });
        }
    }
}

// Notifikasi order baru
const orderListener = listenOrders((orders) => {
    const newOrder = orders[0];
    if (newOrder && !seenOrders.has(newOrder.id)) {
        PushNotification.sendNotification(
            '📦 Pesanan Baru!',
            `${newOrder.customer.nama} memesan ${newOrder.items.length} item`
        );
    }
});