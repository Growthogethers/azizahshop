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
}