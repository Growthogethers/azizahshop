// js/protect.js
// ============================================
// PROTEKSI UI DASAR (bersifat deterrent, bukan keamanan sungguhan)
// ============================================
// Catatan penting:
// Script ini hanya mencegah klik kanan & beberapa shortcut umum lewat UI.
// Ini TIDAK benar-benar mencegah orang membuka DevTools — pengguna yang
// cukup paham tetap bisa membukanya lewat menu browser (⋮ > More tools >
// Developer tools), mode responsive, ekstensi browser, browser lain, atau
// bahkan menonaktifkan JavaScript sebelum halaman dimuat.
// Jangan jadikan ini satu-satunya lapisan keamanan. Data penting seperti
// harga, stok, dan total transaksi tetap harus divalidasi di server
// (Firestore Security Rules), bukan hanya dihalangi di sisi tampilan.

(function () {
    // Nonaktifkan klik kanan (context menu) — termasuk "Inspect"
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Nonaktifkan shortcut keyboard umum untuk buka DevTools / lihat source
    document.addEventListener('keydown', (e) => {
        const key = e.key;
        const ctrlOrCmd = e.ctrlKey || e.metaKey;

        // F12
        if (key === 'F12') {
            e.preventDefault();
            return;
        }

        // Ctrl/Cmd + Shift + I / J / C → DevTools panels
        if (ctrlOrCmd && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) {
            e.preventDefault();
            return;
        }

        // Ctrl/Cmd + U → View Source
        if (ctrlOrCmd && (key === 'U' || key === 'u')) {
            e.preventDefault();
            return;
        }
    });

    // Nonaktifkan drag gambar (biar tidak gampang di-drag keluar/save)
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });
})();
