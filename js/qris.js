export class QRISPayment {
    static generateQR(orderId, total) {
        return fetch('/api/payment/qris', {
            method: 'POST',
            body: JSON.stringify({ orderId, total }),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json());
    }
    
    static async pollStatus(orderId) {
        // Polling status pembayaran
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const status = await this.checkStatus(orderId);
            if (status === 'paid') return true;
            if (status === 'failed') return false;
        }
        return false;
    }
}