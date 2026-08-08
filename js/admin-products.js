// js/admin-products.js - FULL
// ============================================
// ADMIN PRODUCTS MODULE - Refactored with fixes
// ============================================

import { Notification } from './notification.js';
import { rupiah, escapeHtml, resizeImage } from './config.js';
import { addProduct, updateProduct, deleteProduct } from './db.js';
import { Storage } from './storage.js';
import { Analytics } from './analytics.js';
import { ErrorTracker } from './error-tracking.js';
import { Pagination } from './pagination.js';

export class AdminProducts {
  constructor(app) {
    this.app = app;
    this.editingProduct = null;
    this.isUploading = false;
    this.uploadProgress = 0;
    this.searchQuery = '';
    this.stockFilter = 'all';
    this.pagination = new Pagination([], 10);
    this.currentPage = 1;
    
    // Validation rules
    this.validationRules = {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxNameLength: 100,
      maxDescriptionLength: 1000
    };
  }

  // ==========================================
  // RENDER
  // ==========================================
  render() {
    // Apply filters
    const filteredProducts = this.getFilteredProducts();
    this.pagination.updateItems(filteredProducts);
    const currentItems = this.pagination.getCurrentPage();

    return `
      <div class="admin-page">
        <div class="admin-topbar">
          <h2>🛍️ Manajemen Produk</h2>
          <button class="btn" onclick="window.adminApp.productsModule.openEdit()">
            + Tambah Produk
          </button>
        </div>

        <!-- Filter & Search -->
        <div class="admin-filters">
          <div class="search-box">
            <input type="text" 
                   placeholder="🔍 Cari produk..." 
                   id="productSearch"
                   value="${escapeHtml(this.searchQuery)}"
                   oninput="window.adminApp.productsModule.handleSearch(this.value)">
          </div>
          <div class="filter-controls">
            <select id="productStockFilter" 
                    onchange="window.adminApp.productsModule.handleStockFilter(this.value)">
              <option value="all" ${this.stockFilter === 'all' ? 'selected' : ''}>Semua Stok</option>
              <option value="instock" ${this.stockFilter === 'instock' ? 'selected' : ''}>Tersedia (>3)</option>
              <option value="low" ${this.stockFilter === 'low' ? 'selected' : ''}>Stok Menipis (1-3)</option>
              <option value="out" ${this.stockFilter === 'out' ? 'selected' : ''}>Stok Habis (0)</option>
            </select>
          </div>
        </div>

        <!-- Products Table -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:60px;">Foto</th>
                <th>Nama</th>
                <th>Deskripsi</th>
                <th>Harga</th>
                <th>Stok</th>
                <th>Rating</th>
                <th style="width:100px;">Aksi</th>
              </tr>
            </thead>
            <tbody id="productsTableBody">
              ${this.renderProducts(currentItems)}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        ${this.pagination.getPaginationHTML('window.adminApp.productsModule.goToPage')}

        <!-- Stats -->
        <div style="margin-top:10px;display:flex;gap:20px;font-size:13px;color:var(--muted);">
          <span>📦 Total: ${filteredProducts.length} produk</span>
          <span>📊 Menampilkan ${this.pagination.getPaginationInfo().start}-${this.pagination.getPaginationInfo().end}</span>
        </div>
      </div>

      <!-- Edit Modal -->
      ${this.editingProduct ? this.renderEditModal() : ''}
    `;
  }

  renderProducts(products) {
    if (!products || products.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align:center;color:var(--muted);padding:40px;">
            <div style="font-size:40px;margin-bottom:10px;">📦</div>
            ${this.searchQuery ? 'Tidak ada produk yang cocok' : 'Belum ada produk. Klik "Tambah Produk" untuk memulai.'}
          </td>
        </tr>
      `;
    }

    return products.map(p => `
      <tr>
        <td>
          ${p.image ? 
            `<img class="thumb" src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">` : 
            `<div class="thumb no-image">📷</div>`
          }
        </td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td class="product-desc">${this.truncateText(escapeHtml(p.description), 50)}</td>
        <td class="mono">${rupiah(p.price)}</td>
        <td>
          <span class="stock-badge ${this.getStockClass(p.stock)}">
            ${p.stock}
          </span>
        </td>
        <td>
          ${p.rating ? this.renderStars(p.rating) : '-'}
          ${p.totalReviews ? `(${p.totalReviews})` : ''}
        </td>
        <td>
          <div class="action-buttons">
            <button class="icon-btn" onclick="window.adminApp.productsModule.openEdit('${p.id}')" title="Edit">✏️</button>
            <button class="icon-btn danger" onclick="window.adminApp.productsModule.deleteProduct('${p.id}')" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderEditModal() {
    const p = this.editingProduct;
    const isNew = !p?.id;
    
    return `
      <div class="overlay" onclick="if(event.target.classList.contains('overlay')) window.adminApp.productsModule.closeEdit()">
        <div class="modal modal-lg" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${isNew ? '➕ Tambah Produk' : '✏️ Edit Produk'}</h3>
            <button class="modal-close-btn" onclick="window.adminApp.productsModule.closeEdit()">✕</button>
          </div>
          <div class="modal-body">
            <form id="productForm" onsubmit="window.adminApp.productsModule.saveProduct(event)">
              <!-- Image Upload -->
              <div class="form-group">
                <label>Foto Produk</label>
                <div class="image-upload-container">
                  <div class="image-preview" onclick="document.getElementById('productImageInput').click()">
                    ${p?.image ? 
                      `<img src="${p.image}" alt="Preview" loading="lazy">` : 
                      `<div class="upload-placeholder">
                        <span class="upload-icon">📷</span>
                        <span>Klik untuk upload foto</span>
                        <span style="font-size:11px;color:var(--muted);">Max 5MB (JPG, PNG, WEBP)</span>
                      </div>`
                    }
                    <input type="file" id="productImageInput" 
                           accept="${this.validationRules.allowedImageTypes.join(',')}" 
                           onchange="window.adminApp.productsModule.handleImageUpload(event)">
                  </div>
                  ${this.isUploading ? 
                    `<div class="upload-progress">⏳ Mengupload... ${this.uploadProgress || 0}%</div>` : 
                    ''
                  }
                  ${p?.image ? 
                    `<button type="button" class="btn sm danger" style="margin-top:8px;" onclick="window.adminApp.productsModule.removeImage()">
                      🗑️ Hapus Foto
                    </button>` : 
                    ''
                  }
                </div>
              </div>

              <!-- Product Details -->
              <div class="form-row">
                <div class="form-group">
                  <label>Nama Barang *</label>
                  <input type="text" name="name" required 
                         value="${escapeHtml(p?.name || '')}" 
                         placeholder="Nama produk"
                         maxlength="${this.validationRules.maxNameLength}">
                  <small>Maksimal ${this.validationRules.maxNameLength} karakter</small>
                </div>
              </div>

              <div class="form-group">
                <label>Deskripsi</label>
                <textarea name="description" rows="3" 
                          placeholder="Deskripsi produk"
                          maxlength="${this.validationRules.maxDescriptionLength}">${escapeHtml(p?.description || '')}</textarea>
                <small>Maksimal ${this.validationRules.maxDescriptionLength} karakter</small>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Harga (Rp) *</label>
                  <input type="number" name="price" required min="0" step="1000"
                         value="${p?.price || 0}" 
                         placeholder="0">
                  <small>Harga dalam Rupiah</small>
                </div>
                <div class="form-group">
                  <label>Stok *</label>
                  <input type="number" name="stock" required min="0" step="1"
                         value="${p?.stock || 0}" 
                         placeholder="0">
                  <small>Jumlah barang tersedia</small>
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn outline" onclick="window.adminApp.productsModule.closeEdit()">
                  Batal
                </button>
                <button type="submit" class="btn" ${this.isUploading ? 'disabled' : ''}>
                  ${isNew ? 'Tambah Produk' : 'Update Produk'}
                </button>
              </div>

              ${!isNew ? `
                <div class="form-divider"></div>
                <button type="button" class="btn danger" 
                        onclick="window.adminApp.productsModule.deleteProduct('${p.id}')">
                  🗑️ Hapus Produk
                </button>
              ` : ''}
            </form>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // FILTERING & PAGINATION
  // ==========================================
  getFilteredProducts() {
    let filtered = [...this.app.products];
    
    // Search filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    
    // Stock filter
    switch (this.stockFilter) {
      case 'instock':
        filtered = filtered.filter(p => p.stock > 3);
        break;
      case 'low':
        filtered = filtered.filter(p => p.stock > 0 && p.stock <= 3);
        break;
      case 'out':
        filtered = filtered.filter(p => p.stock <= 0);
        break;
      default:
        break;
    }
    
    // Sort by newest
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  handleSearch(query) {
    this.searchQuery = query;
    this.currentPage = 1;
    this.app.render();
  }

  handleStockFilter(filter) {
    this.stockFilter = filter;
    this.currentPage = 1;
    this.app.render();
  }

  goToPage(page) {
    this.currentPage = page;
    this.app.render();
  }

  // ==========================================
  // PRODUCT CRUD OPERATIONS
  // ==========================================
  openEdit(id = null) {
    if (id) {
      const product = this.app.products.find(p => p.id === id);
      if (product) {
        this.editingProduct = { ...product };
        
        // Track edit open - dengan error handling
        try {
          if (typeof Analytics !== 'undefined' && Analytics.trackEvent) {
            Analytics.trackEvent('product_edit_open', { product_id: id });
          }
        } catch (e) {
          console.warn('Analytics error:', e);
        }
      } else {
        Notification.error('Produk tidak ditemukan');
        return;
      }
    } else {
      this.editingProduct = {
        id: null,
        name: '',
        description: '',
        price: 0,
        stock: 0,
        image: ''
      };
    }
    this.isUploading = false;
    this.uploadProgress = 0;
    this.app.render();
  }

  closeEdit() {
    this.editingProduct = null;
    this.isUploading = false;
    this.uploadProgress = 0;
    this.app.render();
  }

  // ==========================================
  // IMAGE HANDLING
  // ==========================================
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!this.validationRules.allowedImageTypes.includes(file.type)) {
      Notification.error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP');
      return;
    }

    // Validate file size
    if (file.size > this.validationRules.maxImageSize) {
      Notification.error(`Ukuran gambar maksimal ${this.validationRules.maxImageSize / (1024 * 1024)}MB`);
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.app.render();

    try {
      // Compress image
      const compressed = await resizeImage(file, 800, 0.8);
      this.editingProduct.image = compressed;
      
      // Track upload - dengan error handling
      try {
        if (typeof Analytics !== 'undefined' && Analytics.trackEvent) {
          Analytics.trackEvent('product_image_uploaded', {
            file_size: file.size,
            file_type: file.type
          });
        }
      } catch (e) {
        console.warn('Analytics error:', e);
      }
      
      Notification.success('Gambar berhasil diupload');
    } catch (error) {
      console.error('Image upload error:', error);
      Notification.error('Gagal mengupload gambar: ' + error.message);
      ErrorTracker.logError(error);
    } finally {
      this.isUploading = false;
      this.uploadProgress = 0;
      this.app.render();
    }
  }

  removeImage() {
    if (this.editingProduct) {
      this.editingProduct.image = '';
      this.app.render();
      Notification.info('Foto dihapus');
    }
  }

  // ==========================================
  // PRODUCT SAVE - PERBAIKAN
  // ==========================================
  async saveProduct(event) {
    event.preventDefault();
    const form = event.target;
    
    if (this.isUploading) {
      Notification.warning('Tunggu upload gambar selesai');
      return;
    }

    // Get form data
    const data = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      price: Number(form.price.value),
      stock: Number(form.stock.value),
      image: this.editingProduct.image || ''
    };

    // Validate
    const validation = this.validateProduct(data);
    if (!validation.valid) {
      Notification.error(validation.errors.join('\n'));
      return;
    }

    try {
      if (this.editingProduct.id) {
        // Update existing product
        const changes = this.getChanges(data);
        await updateProduct(this.editingProduct.id, data);
        
        // Track update - dengan error handling
        try {
          if (typeof Analytics !== 'undefined' && Analytics.trackProductUpdated) {
            Analytics.trackProductUpdated(this.editingProduct.id, changes);
          }
        } catch (e) {
          console.warn('Analytics error:', e);
        }
        
        Notification.success('Produk berhasil diperbarui');
        
      } else {
        // Add new product
        const product = await addProduct(data);
        
        // Track add - dengan error handling
        try {
          if (typeof Analytics !== 'undefined' && Analytics.trackProductAdded) {
            Analytics.trackProductAdded(product);
          }
        } catch (e) {
          console.warn('Analytics error:', e);
        }
        
        Notification.success('Produk berhasil ditambahkan');
      }
      
      this.closeEdit();
      
    } catch (error) {
      console.error('Save product error:', error);
      Notification.error('Gagal menyimpan produk: ' + error.message);
      ErrorTracker.logError(error);
    }
  }

  // ==========================================
  // PRODUCT DELETE
  // ==========================================
  async deleteProduct(id) {
    // Find product for confirmation
    const product = this.app.products.find(p => p.id === id);
    if (!product) {
      Notification.error('Produk tidak ditemukan');
      return;
    }

    // Confirmation dialog
    if (!confirm(`Apakah Anda yakin ingin menghapus produk "${product.name}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      // Delete image from storage if exists
      if (product.image) {
        try {
          await Storage.deleteImage(product.image);
        } catch (e) {
          console.warn('Failed to delete image:', e);
        }
      }
      
      // Delete product from Firestore
      await deleteProduct(id);
      
      // Track deletion - dengan error handling
      try {
        if (typeof Analytics !== 'undefined' && Analytics.trackProductDeleted) {
          Analytics.trackProductDeleted(id, product.name);
        }
      } catch (e) {
        console.warn('Analytics error:', e);
      }
      
      Notification.success('Produk berhasil dihapus');
      
      this.closeEdit();
      
    } catch (error) {
      console.error('Delete product error:', error);
      Notification.error('Gagal menghapus produk: ' + error.message);
      ErrorTracker.logError(error);
    }
  }

  // ==========================================
  // VALIDATION & UTILITIES
  // ==========================================
  validateProduct(data) {
    const errors = [];
    
    if (!data.name || data.name.length < 2) {
      errors.push('Nama produk minimal 2 karakter');
    }
    
    if (data.name.length > this.validationRules.maxNameLength) {
      errors.push(`Nama produk maksimal ${this.validationRules.maxNameLength} karakter`);
    }
    
    if (data.description.length > this.validationRules.maxDescriptionLength) {
      errors.push(`Deskripsi maksimal ${this.validationRules.maxDescriptionLength} karakter`);
    }
    
    if (data.price < 0) {
      errors.push('Harga tidak boleh negatif');
    }
    
    if (data.price > 1000000000) {
      errors.push('Harga terlalu tinggi (maks 1 Milyar)');
    }
    
    if (data.stock < 0) {
      errors.push('Stok tidak boleh negatif');
    }
    
    if (data.stock > 100000) {
      errors.push('Stok terlalu tinggi (maks 100.000)');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  getChanges(newData) {
    const oldData = this.app.products.find(p => p.id === this.editingProduct.id);
    const changes = {};
    
    if (!oldData) return changes;
    
    Object.keys(newData).forEach(key => {
      if (newData[key] !== oldData[key]) {
        changes[key] = {
          from: oldData[key],
          to: newData[key]
        };
      }
    });
    
    return changes;
  }

  getStockClass(stock) {
    if (stock <= 0) return 'out';
    if (stock <= 3) return 'low';
    return 'instock';
  }

  renderStars(rating) {
    const stars = '⭐'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '⭐' : '');
    return `<span class="card-rating">${stars}</span>`;
  }

  truncateText(text, length = 50) {
    if (!text) return '-';
    if (text.length <= length) return escapeHtml(text);
    return escapeHtml(text.substring(0, length)) + '...';
  }
}
