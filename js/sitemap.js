export function generateSitemap(products) {
    const baseUrl = window.location.origin;
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc>${baseUrl}/</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
            <priority>1.0</priority>
        </url>`;
    
    products.forEach(p => {
        sitemap += `
        <url>
            <loc>${baseUrl}/product/${p.id}</loc>
            <lastmod>${new Date(p.updatedAt).toISOString()}</lastmod>
            <priority>0.8</priority>
        </url>`;
    });
    
    sitemap += `</urlset>`;
    return sitemap;
}