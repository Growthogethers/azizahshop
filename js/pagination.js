// js/pagination.js
export class Pagination {
    constructor(items, perPage = 12) {
        this.items = items || [];
        this.perPage = perPage;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.items.length / this.perPage);
    }
    
    getCurrentPage() {
        const start = (this.currentPage - 1) * this.perPage;
        const end = Math.min(start + this.perPage, this.items.length);
        return this.items.slice(start, end);
    }
    
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            return this.getCurrentPage();
        }
        return null;
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            return this.getCurrentPage();
        }
        return null;
    }
    
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            return this.getCurrentPage();
        }
        return null;
    }
    
    getPaginationInfo() {
        const start = (this.currentPage - 1) * this.perPage + 1;
        const end = Math.min(this.currentPage * this.perPage, this.items.length);
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            start,
            end,
            total: this.items.length,
            hasNext: this.currentPage < this.totalPages,
            hasPrev: this.currentPage > 1
        };
    }
    
    getPaginationHTML() {
        const info = this.getPaginationInfo();
        if (this.totalPages <= 1) return '';
        
        let html = '<div class="pagination">';
        
        html += `<button class="pagination-btn" ${info.hasPrev ? '' : 'disabled'} onclick="window.app.pagination.prevPage()">‹</button>`;
        
        const pages = this.getPageRange();
        pages.forEach(page => {
            if (page === '...') {
                html += `<span class="pagination-dots">…</span>`;
            } else {
                html += `<button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" onclick="window.app.pagination.goToPage(${page})">${page}</button>`;
            }
        });
        
        html += `<button class="pagination-btn" ${info.hasNext ? '' : 'disabled'} onclick="window.app.pagination.nextPage()">›</button>`;
        
        html += '</div>';
        return html;
    }
    
    getPageRange() {
        const current = this.currentPage;
        const total = this.totalPages;
        const pages = [];
        const delta = 2;
        
        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                pages.push(i);
            } else if (i === current - delta - 1 || i === current + delta + 1) {
                pages.push('...');
            }
        }
        
        // Filter duplicates
        return pages.filter((page, index) => {
            if (page === '...') {
                return pages[index - 1] !== '...';
            }
            return true;
        });
    }
    
    updateItems(newItems) {
        this.items = newItems || [];
        this.totalPages = Math.ceil(this.items.length / this.perPage);
        this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
    }
}