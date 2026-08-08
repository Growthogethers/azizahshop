// js/sanitize.js
export function sanitizeInput(input) {
    // Remove HTML tags
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone) {
    return /^62[0-9]{10,13}$/.test(phone);
}