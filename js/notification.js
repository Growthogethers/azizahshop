export class Notification {
    static show(message, type = 'success', duration = 3000) {
        // Remove existing notification
        const existing = document.querySelector('.notification-container');
        if (existing) existing.remove();

        // Create container
        const container = document.createElement('div');
        container.className = 'notification-container';
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">${this.getIcon(type)}</div>
            <div class="notification-message">${message}</div>
            <button class="notification-close" aria-label="Close notification">&times;</button>
        `;

        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.hide(container);
            };
        }

        container.appendChild(notification);
        document.body.appendChild(container);

        // Auto hide after duration
        let timeout = setTimeout(() => {
            this.hide(container);
        }, duration);

        // Pause auto-hide on hover
        container.addEventListener('mouseenter', () => {
            clearTimeout(timeout);
        });

        container.addEventListener('mouseleave', () => {
            timeout = setTimeout(() => {
                this.hide(container);
            }, duration);
        });

        // Click outside to close
        container.onclick = (e) => {
            if (e.target === container) {
                this.hide(container);
            }
        };
    }

    static hide(container) {
        if (!container) return;
        container.classList.add('notification-hide');
        setTimeout(() => {
            if (container.parentNode) {
                container.remove();
            }
        }, 300);
    }

    static getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    static success(message) {
        this.show(message, 'success');
    }

    static error(message) {
        this.show(message, 'error');
    }

    static warning(message) {
        this.show(message, 'warning');
    }

    static info(message) {
        this.show(message, 'info');
    }

    // ==========================================
    // CONFIRM MODAL (pengganti window.confirm())
    // ==========================================
    // Pemakaian: const ok = await Notification.confirm('Yakin hapus?');
    // Mendukung juga opsi: Notification.confirm(msg, { confirmText, cancelText, danger: true })
    static confirm(message, options = {}) {
        return new Promise((resolve) => {
            const existing = document.querySelector('.confirm-overlay');
            if (existing) existing.remove();

            const {
                confirmText = 'Ya, Lanjutkan',
                cancelText = 'Batal',
                danger = false
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            // \n dari string message lama diubah jadi <br> biar tetap rapi tampil di modal
            const safeMessage = String(message)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');

            overlay.innerHTML = `
                <div class="confirm-modal" role="alertdialog" aria-modal="true">
                    <div class="confirm-message">${safeMessage}</div>
                    <div class="confirm-actions">
                        <button type="button" class="confirm-btn confirm-cancel">${cancelText}</button>
                        <button type="button" class="confirm-btn confirm-ok ${danger ? 'danger' : ''}">${confirmText}</button>
                    </div>
                </div>
            `;

            const cleanup = (result) => {
                overlay.classList.add('confirm-hide');
                setTimeout(() => overlay.remove(), 200);
                document.removeEventListener('keydown', onKeydown);
                resolve(result);
            };

            const onKeydown = (e) => {
                if (e.key === 'Escape') cleanup(false);
                if (e.key === 'Enter') cleanup(true);
            };

            overlay.querySelector('.confirm-cancel').onclick = () => cleanup(false);
            overlay.querySelector('.confirm-ok').onclick = () => cleanup(true);
            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup(false);
            };
            document.addEventListener('keydown', onKeydown);

            document.body.appendChild(overlay);
            overlay.querySelector('.confirm-ok').focus();
        });
    }
}
