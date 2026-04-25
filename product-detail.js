function esc(value) {
  return String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

function renderSpecifications(specifications) {
  if (!Array.isArray(specifications) || !specifications.length) {
    return '<p><strong>Machine Specifications:</strong> Not listed</p>';
  }
  return `<div><strong>Machine Specifications</strong><div class="vendor-spec-list">${specifications.map((spec) => `<div class="vendor-spec-item"><strong>${esc(spec.key || 'Specification')}</strong>: ${esc(spec.value || 'Not listed')}</div>`).join('')}</div></div>`;
}

function renderMedia(product) {
  const images = Array.isArray(product.product_gallery_urls) ? product.product_gallery_urls.filter(Boolean) : [];
  const videos = Array.isArray(product.product_video_urls) ? product.product_video_urls.filter(Boolean) : [];
  return `<section class="section"><h3>Media Gallery</h3>${images.length ? `<div class="innovation-media-grid innovation-media-grid-images">${images.map((url) => `<a class="innovation-media-card" href="${esc(url)}" target="_blank" rel="noreferrer"><img class="innovation-gallery-image" src="${esc(url)}" alt="${esc(product.product_name)}" loading="lazy" referrerpolicy="no-referrer" /></a>`).join('')}</div>` : '<p>No images available.</p>'}${videos.length ? `<div class="innovation-media-block"><h4>Videos</h4><div class="innovation-media-grid innovation-media-grid-videos">${videos.map((url, index) => `<article class="innovation-video-card"><iframe class="innovation-video-frame" src="${esc(url)}" title="${esc(`${product.product_name} video ${index + 1}`)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="origin"></iframe><div class="innovation-video-meta"><span class="admin-badge approved">video</span></div></article>`).join('')}</div></div>` : ''}</section>`;
}

async function initProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');
  const root = document.getElementById('product-detail-root');
  if (!productId) {
    root.innerHTML = '<section class="section"><p>Product id is missing.</p></section>';
    return;
  }

  try {
    const { vendors, products } = await InnovationStore.loadDirectory();
    const product = products.find((item) => item.portal_product_id === productId);
    if (!product) {
      root.innerHTML = '<section class="section"><p>Machine not found in the synced Supabase directory.</p></section>';
      return;
    }
    const vendor = vendors.find((item) => item.portal_vendor_id === product.portal_vendor_id);
    document.getElementById('detail-title').textContent = product.product_name;
    document.getElementById('detail-subtitle').textContent = vendor?.vendor_name || 'Innovation Guild machine detail';
    document.getElementById('back-to-vendor').href = vendor ? `./vendor-detail.html?vendor=${encodeURIComponent(vendor.portal_vendor_id)}` : './index.html?restore=1';
    root.innerHTML = `<section class="section"><div class="innovation-detail-hero">${product.product_image_url ? `<img class="innovation-detail-image" src="${esc(product.product_image_url)}" alt="${esc(product.product_name)}" referrerpolicy="no-referrer" />` : ''}<div class="innovation-detail-summary"><div class="vendor-result-top"><div><h3>${esc(product.product_name)}</h3><p>${esc(vendor?.vendor_name || 'Organization not listed')}</p></div><span class="admin-badge approved">${esc((product.product_categories || []).join(', ') || 'Innovation')}</span></div><p>${esc(product.product_description || 'No description available.')}</p><div class="innovation-chip-row">${(product.tags || []).map((tag) => `<span class="innovation-chip innovation-chip-muted">${esc(tag)}</span>`).join('')}</div><div class="vendor-detail-grid"><div><h4>Machine Summary</h4><p><strong>Organization:</strong> ${esc(vendor?.vendor_name || 'Not listed')}</p><p><strong>Categories:</strong> ${esc((product.product_categories || []).join(', ') || 'Not listed')}</p><p><strong>Subcategories:</strong> ${esc((product.product_subcategories || []).join(', ') || 'Not listed')}</p><p><strong>Innovation Guild:</strong> <a href="${esc(product.product_link || '#')}" target="_blank" rel="noreferrer">Open original machine page</a></p></div><div><h4>Organization Contact</h4><p><strong>Email:</strong> ${esc(vendor?.final_contact_email || vendor?.portal_email || 'Not listed')}</p><p><strong>Phone:</strong> ${esc(vendor?.final_contact_phone || vendor?.portal_phone || 'Not listed')}</p><p><strong>Address:</strong> ${esc(vendor?.final_contact_address || 'Not listed')}</p><p><strong>Notes:</strong> ${esc(vendor?.contact_notes || vendor?.website_status || 'Not listed')}</p></div></div>${renderSpecifications(product.product_specifications)}</div></div></section>${renderMedia(product)}`;
  } catch (error) {
    root.innerHTML = `<section class="section"><p>${esc(error.message || 'Machine detail could not be loaded.')}</p></section>`;
  }
}

initProductDetail();
