let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let isShopOpen = true;
let activeCategory = 'All';
let searchQuery = '';

// Check if shop is open based on shop_open flag and cutoff time
async function checkShopStatus() {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('*');

  if (!error && data) {
    let shopOpenFlag = false;
    let cutoffTime = '17:00';

    data.forEach(row => {
      if (row.key === 'shop_open') shopOpenFlag = row.value === 'true';
      if (row.key === 'cutoff_time') cutoffTime = row.value;
    });

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const pastCutoff = currentTime >= cutoffTime;

    isShopOpen = shopOpenFlag && !pastCutoff;

    if (!isShopOpen) {
      const banner = document.getElementById('shop-closed-banner');
      if (banner) banner.style.display = 'block';
    }
  }
}

// Load products from supabaseClient
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .eq('available', true);

  if (error) {
    document.getElementById('products-grid').innerHTML = '<p>Error loading products.</p>';
    return;
  }

  allProducts = data;
  applyFilters();
  updateCartCount();
}

// Normalize a category label so singular/plural and casing differences still
// match (e.g. a "Vegetables" value from the DB matches the "Vegetable" tab).
function normCat(c) {
  return (c || '').trim().toLowerCase().replace(/s$/, '');
}

// Render product cards
function renderProducts(products) {
  const grid = document.getElementById('products-grid');

  if (products.length === 0) {
    const msg = searchQuery.trim()
      ? 'No products match your search.'
      : 'No products found.';
    grid.innerHTML = `<p class="loading">${msg}</p>`;
    return;
  }

  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-category">${p.category}</div>
      <h3 class="product-name">${p.name}</h3>
      <div class="product-footer">
        <div class="product-price">₹${p.price} <span class="unit">${p.unit}</span></div>
        ${isShopOpen
          ? `<button class="add-btn" onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.unit}')">+ Add</button>`
          : `<span class="shop-closed-label">Orders Closed</span>`
        }
      </div>
    </div>
  `).join('');
}

// Apply the active category + live search query, then re-render.
function applyFilters() {
  let list = allProducts;

  if (activeCategory !== 'All') {
    list = list.filter(p => normCat(p.category) === normCat(activeCategory));
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }

  renderProducts(list);
}

// Filter by category
function filterCategory(category) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  activeCategory = category;
  applyFilters();
}

// Add to cart
function addToCart(id, name, price, unit) {
  if (!isShopOpen) {
    alert('Orders are closed. Please order before the cutoff time.');
    return;
  }
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name, price, unit, quantity: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  localStorage.setItem('cartDate', new Date().toDateString());
  updateCartCount();
}

// Update cart count in header
function updateCartCount() {
  const total = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-count').textContent = total;
}

// Logout
async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

// Clear cart if date has changed
function clearCartIfStale() {
  const cartDate = localStorage.getItem('cartDate');
  const today = new Date().toDateString();
  if (cartDate && cartDate !== today) {
    localStorage.removeItem('cart');
    localStorage.removeItem('lastAddress');
    cart = [];
  }
  if (cart.length > 0) {
    localStorage.setItem('cartDate', today);
  }
}

// Live product search
const searchInput = document.getElementById('product-search');
if (searchInput) {
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    applyFilters();
  });
}

// Run on page load
clearCartIfStale();
checkShopStatus().then(() => loadProducts());