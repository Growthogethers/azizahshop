// js/qris-payment.js
export class QRISPayment {
    static getStaticQR() {
        return {
            // Ganti dengan QRIS statis merchant Anda
            imageUrl: 'assets/qris-static.jpeg',
            qrString: '00020101021126670016COM.MIDTRANS.WWW011893600123456789021234567890303UMI51440114ID.CO.QRIS.WWW0215ID10221117450303UMI5204581253033605802ID5925TOKO ONLINE KITA6009JAKARTA61051234561070630A016'
        };
    }

    static renderQRISModal(orderData) {
        // Validasi data
        if (!orderData) {
            console.error('❌ orderData is undefined');
            return `
                <div class="qris-overlay" id="qrisOverlay">
                    <div class="qris-modal">
                        <div class="qris-header">
                            <h3>⚠️ Error</h3>
                            <button class="qris-close" onclick="window.closeQRIS()">✕</button>
                        </div>
                        <div class="qris-body">
                            <p style="color:var(--danger);">Terjadi kesalahan, silakan coba lagi.</p>
                        </div>
                        <div class="qris-footer">
                            <button class="btn" onclick="window.closeQRIS()">Tutup</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Ambil data dengan aman
        const total = orderData.total || 0;
        const qris = this.getStaticQR();
        const orderId = orderData.id || 'PENDING';
        const orderIdDisplay = orderId.slice(0, 8).toUpperCase() || 'PENDING';
        const customerName = orderData.customer?.nama || 'Pelanggan';
        const itemCount = orderData.items?.length || 0;

        return `
            <div class="qris-overlay" id="qrisOverlay">
                <div class="qris-modal">
                    <div class="qris-header">
                        <h3>💳 QRIS Payment</h3>
                        <button class="qris-close" onclick="window.closeQRIS()">✕</button>
                    </div>
                    
                    <div class="qris-body">
                        <div class="qris-code-container">
                            <img src="${qris.imageUrl}" alt="QRIS Code" class="qris-image" id="qrisImage" onerror="this.src='data:image/qris-static.jpeg QRIS</text></svg>'">
                            <div class="qris-label">Scan QR Code dengan e-wallet atau mobile banking</div>
                            <button class="qris-download-btn" onclick="window.downloadQR()">
                                ⬇️ Download QR
                            </button>
                        </div>

                        <div class="qris-info">
                            <div class="qris-amount">
                                <label>💰 Total Pembayaran</label>
                                <div class="qris-amount-value">${this.formatRupiah(total)}</div>
                                <button class="qris-copy-btn" onclick="window.copyAmount()">
                                    📋 Copy Nominal
                                </button>
                            </div>

                            <div class="qris-details">
                                <div class="qris-detail-row">
                                    <span>No. Pesanan</span>
                                    <span><strong>#${orderIdDisplay}</strong></span>
                                </div>
                                <div class="qris-detail-row">
                                    <span>Pembeli</span>
                                    <span><strong>${this.escapeHtml(customerName)}</strong></span>
                                </div>
                                <div class="qris-detail-row">
                                    <span>Item</span>
                                    <span><strong>${itemCount} item</strong></span>
                                </div>
                            </div>
                        </div>

                        <div class="qris-instructions">
                            <div class="qris-instruction-step">
                                <span class="step-number">1</span>
                                <span class="step-text">Scan QR Code dengan aplikasi pembayaran (GoPay, OVO, DANA, ShopeePay, dll)</span>
                            </div>
                            <div class="qris-instruction-step">
                                <span class="step-number">2</span>
                                <span class="step-text">Pastikan nominal <strong>${this.formatRupiah(total)}</strong> sudah sesuai</span>
                            </div>
                            <div class="qris-instruction-step">
                                <span class="step-number">3</span>
                                <span class="step-text">Konfirmasi pembayaran VIA WHATSAPP</span>
                            </div>
                            <div class="qris-instruction-step highlight">
                                <span class="step-number">📱</span>
                                <span class="step-text"><strong>⚠️ Harap kirim bukti transfer ke WhatsApp</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="qris-footer">
                        <button class="btn outline" onclick="window.closeQRIS()">Batal</button>
                        <button class="btn whatsapp-btn" onclick="window.sendToWhatsApp()">
                            📱 Kirim Bukti ke WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Download gambar QRIS ke perangkat pengguna.
     * Dipanggil lewat window.downloadQR() dari tombol di modal.
     * @param {Object} [orderData] - opsional, dipakai untuk membuat nama file yang unik
     */
    static async downloadQR(orderData) {
        const qris = this.getStaticQR();
        const orderId = orderData?.id ? orderData.id.slice(0, 8).toUpperCase() : 'QRIS';
        const fileName = `QRIS-${orderId}-${Date.now()}.jpg`;

        try {
            // Fetch gambar sebagai blob agar bisa didownload walau berbeda origin/CDN
            const response = await fetch(qris.imageUrl);
            if (!response.ok) throw new Error('Gagal mengambil gambar QR');
            const blob = await response.blob();

            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('❌ Gagal download QR:', err);
            // Fallback: buka gambar di tab baru agar user bisa simpan manual
            window.open(qris.imageUrl, '_blank');
            alert('Tidak bisa download otomatis. Gambar QR dibuka di tab baru, silakan tekan lama / klik kanan untuk menyimpan.');
        }
    }

    static formatRupiah(amount) {
        if (!amount || isNaN(amount)) return 'Rp0';
        return 'Rp' + Math.round(amount).toLocaleString('id-ID');
    }

    static escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c] || c));
    }
}
