// Tab switching
function showAdminTab(tab) {
  document.getElementById('admin-orders').style.display = tab === 'orders' ? 'block' : 'none';
  document.getElementById('admin-products').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('admin-settings').style.display = tab === 'settings' ? 'block' : 'none';
  document.getElementById('admin-reports').style.display = tab === 'reports' ? 'block' : 'none';
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  if (tab === 'products') loadAdminProducts();
  if (tab === 'settings') loadSettings();
}

// ===== Incoming Orders: compact, filterable, expandable table =====

let adminOrders = [];
const aoState = { search: '', status: 'all', from: '', to: '', expanded: new Set() };
let aoPrintOnly = null; // when set, only this order id prints

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Load all orders (real Supabase query), then (re)build the table UI while
// keeping the current search / status / date filters and expanded rows.
async function loadAdminOrders() {
  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select(`
      *,
      order_items (
        quantity,
        price_at_order,
        products (name, unit)
      )
    `)
    .order('created_at', { ascending: false });

  const list = document.getElementById('admin-orders-list');

  if (error) {
    list.innerHTML = '<p class="loading">Error loading orders.</p>';
    return;
  }

  adminOrders = orders || [];
  renderAdminOrdersShell();
}

// Mark order as disposed
async function markDisposed(orderId) {
  const { error } = await supabaseClient
    .from('orders')
    .update({ status: 'disposed' })
    .eq('id', orderId);

  if (error) {
    alert('Error updating order status.');
    return;
  }
  loadAdminOrders();
}

// Toolbar + status chips + table scaffold. Rebuilt on every load; the row
// list itself is re-rendered separately so the search box keeps focus.
function renderAdminOrdersShell() {
  const list = document.getElementById('admin-orders-list');
  const chips = ['all', 'pending', 'disposed', 'cancelled'];

  list.innerHTML = `
    <div class="ao-head oa-noprint">
      <h2>Incoming Orders</h2>
      <div class="ao-controls">
        <input type="text" id="ao-search" class="ao-search" placeholder="Search by name, phone, address…" autocomplete="off" />
        <div class="ao-daterange">
          <span>From</span>
          <input type="date" id="ao-from" />
          <span>To</span>
          <input type="date" id="ao-to" />
        </div>
        <button id="ao-print" class="ao-printbtn" type="button">🖨️ Print list</button>
      </div>
    </div>

    <div class="ao-chips oa-noprint">
      ${chips.map(s => `
        <button type="button" class="ao-chip${s === aoState.status ? ' active' : ''}" data-status="${s}">
          ${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
        </button>
      `).join('')}
    </div>

    <div class="ao-table">
      <div class="ao-scroll">
        <div class="ao-thead">
          <div></div>
          <div>Customer</div>
          <div>Address</div>
          <div>Time</div>
          <div class="ao-c">Items</div>
          <div class="ao-r">Total</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div id="ao-rows"></div>
      </div>
    </div>
  `;

  list.querySelector('#ao-search').value = aoState.search;
  list.querySelector('#ao-from').value = aoState.from;
  list.querySelector('#ao-to').value = aoState.to;

  list.querySelector('#ao-search').addEventListener('input', e => {
    aoState.search = e.target.value;
    renderOrderRows();
  });
  list.querySelector('#ao-from').addEventListener('input', e => {
    aoState.from = e.target.value;
    renderOrderRows();
  });
  list.querySelector('#ao-to').addEventListener('input', e => {
    aoState.to = e.target.value;
    renderOrderRows();
  });
  list.querySelector('#ao-print').addEventListener('click', onPrintOrdersList);
  list.querySelectorAll('.ao-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      aoState.status = btn.dataset.status;
      list.querySelectorAll('.ao-chip').forEach(b => b.classList.toggle('active', b === btn));
      renderOrderRows();
    });
  });

  renderOrderRows();
}

// Apply the three filters (search AND status AND date range).
function getFilteredOrders() {
  const q = aoState.search.trim().toLowerCase();
  const from = aoState.from ? new Date(aoState.from + 'T00:00:00') : null;
  const to = aoState.to ? new Date(aoState.to + 'T23:59:59') : null;

  return adminOrders.filter(o => {
    const status = o.status || 'pending';
    if (aoState.status !== 'all' && status !== aoState.status) return false;

    const d = new Date(o.created_at);
    if (from && d < from) return false;
    if (to && d > to) return false;

    if (!q) return true;
    const hay = `${o.customer_name || ''} ${o.phone || ''} ${o.address || ''} ${o.location || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderOrderRows() {
  const rowsEl = document.getElementById('ao-rows');
  if (!rowsEl) return;

  const filtered = getFilteredOrders();

  if (!filtered.length) {
    const msg = adminOrders.length ? 'No orders match your search.' : 'No orders yet.';
    rowsEl.innerHTML = `<div class="ao-empty">${msg}</div>`;
    return;
  }

  rowsEl.innerHTML = filtered.map(renderOrderRow).join('');

  rowsEl.querySelectorAll('.ao-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.ao-actions')) return;
      const id = row.dataset.id;
      if (aoState.expanded.has(id)) aoState.expanded.delete(id);
      else aoState.expanded.add(id);
      renderOrderRows();
    });
  });
  rowsEl.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { act, id } = btn.dataset;
      if (act === 'dispose') markDisposed(id);
      else if (act === 'print') printSingleOrder(id);
      else if (act === 'edit') alert('Editing orders is not available yet.');
    });
  });
}

function renderOrderRow(o) {
  const items = (o.order_items || []).map(it => ({
    name: it.products ? it.products.name : 'Item',
    qty: it.quantity,
    price: (it.price_at_order || 0) * it.quantity,
  }));
  const total = items.reduce((s, it) => s + it.price, 0);
  const status = o.status || 'pending';
  const time = new Date(o.created_at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const expanded = aoState.expanded.has(o.id);
  const address = [o.address, o.location].filter(Boolean).join(', ');
  const dial = (o.phone || '').replace(/[^\d+]/g, '');
  const hide = aoPrintOnly && aoPrintOnly !== o.id ? ' ao-print-hide' : '';

  return `
    <div class="ao-order${hide}">
      <div class="ao-row${expanded ? ' expanded' : ''}" data-id="${esc(o.id)}">
        <div class="ao-chev">▶</div>
        <div>
          <div class="ao-name">${esc(o.customer_name || '—')}</div>
          <div class="ao-phone">${esc(o.phone || '')}</div>
        </div>
        <div class="ao-addr">${esc(address)}</div>
        <div class="ao-time">${time}</div>
        <div class="ao-items">${items.length}</div>
        <div class="ao-total">₹${total}</div>
        <div><span class="order-status ${status}">${status}</span></div>
        <div class="ao-actions oa-noprint">
          <a class="ao-icon" title="Call" href="tel:${dial}">📞</a>
          <button type="button" class="ao-icon" title="Print" data-act="print" data-id="${esc(o.id)}">🖨️</button>
          <button type="button" class="ao-icon" title="Edit" data-act="edit" data-id="${esc(o.id)}">✎</button>
          ${status === 'pending'
            ? `<button type="button" class="ao-dispose" data-act="dispose" data-id="${esc(o.id)}">Dispose</button>`
            : ''}
        </div>
      </div>
      ${expanded ? `
        <div class="ao-panel">
          ${items.map(it => `
            <div class="ao-panel-row">
              <span>${esc(it.name)}</span>
              <span class="ao-panel-qty">×${it.qty}</span>
              <span>₹${it.price}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Print list: expand every currently-filtered order, then print.
function onPrintOrdersList() {
  aoPrintOnly = null;
  getFilteredOrders().forEach(o => aoState.expanded.add(o.id));
  renderOrderRows();
  setTimeout(() => window.print(), 50);
}

// Print one order: temporarily hide the others, print, then restore.
function printSingleOrder(id) {
  aoState.expanded.add(id);
  aoPrintOnly = id;
  renderOrderRows();
  setTimeout(() => {
    window.print();
    aoPrintOnly = null;
    renderOrderRows();
  }, 50);
}

// ===== Manage Products: category-grouped table, search, inline price edit =====

let adminProducts = [];
let apSearch = '';

// Load products, (re)build the tab UI, keep the search box and its focus.
async function loadAdminProducts() {
  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('category')
    .order('name');

  const list = document.getElementById('admin-products-list');

  if (error) {
    list.innerHTML = '<p class="loading">Error loading products.</p>';
    return;
  }

  adminProducts = products || [];

  if (!document.getElementById('ap-search')) {
    renderProductsShell();
  }
  refreshCategoryOptions();
  renderProductRows();
}

// One-time scaffold: single-row Add form + search + table header.
function renderProductsShell() {
  const list = document.getElementById('admin-products-list');

  list.innerHTML = `
    <div class="ap-form">
      <div class="ap-form-row">
        <input type="text" id="new-product-name" class="ap-in ap-in-name" placeholder="Product name" autocomplete="off" />
        <select id="new-product-category" class="ap-in ap-in-cat" onchange="onNewCategoryMode()">
          <option value="" disabled selected>Category</option>
          <option value="__add_new__">+ Add new category…</option>
        </select>
        <input type="text" id="new-product-category-new" class="ap-in ap-in-cat ap-in-newcat" placeholder="New category name" autocomplete="off" hidden />
        <input type="text" id="new-product-unit" class="ap-in ap-in-unit" placeholder="Unit (kg, dozen…)" autocomplete="off" />
        <input type="number" id="new-product-price" class="ap-in ap-in-price" placeholder="₹" min="0" />
        <button type="button" class="ap-add-btn" onclick="addProduct()">Add Product</button>
      </div>
      <p id="add-product-message" class="message ap-msg"></p>
    </div>

    <div class="ap-searchwrap">
      <input type="text" id="ap-search" class="ap-search" placeholder="Search products…" autocomplete="off"
        oninput="filterAdminProducts(this.value)" />
    </div>

    <div class="ap-table">
      <div class="ap-scroll">
        <div class="ap-thead">
          <div>Product</div>
          <div>Unit</div>
          <div>Price</div>
          <div>Status</div>
          <div>Action</div>
          <div></div>
        </div>
        <div id="ap-rows"></div>
      </div>
    </div>
  `;

  document.getElementById('ap-search').value = apSearch;
}

// Rebuild the category <select> from the distinct categories currently in the
// products table, preserving the active selection.
function refreshCategoryOptions() {
  const sel = document.getElementById('new-product-category');
  if (!sel) return;

  const current = sel.value;
  const cats = [...new Set(adminProducts.map(p => (p.category || '').trim()).filter(Boolean))];
  const placeholderSelected = current === '' || current === '__add_new__';

  sel.innerHTML =
    `<option value="" disabled${placeholderSelected ? ' selected' : ''}>Category</option>` +
    cats.map(c => `<option value="${esc(c)}"${c === current ? ' selected' : ''}>${esc(c)}</option>`).join('') +
    `<option value="__add_new__">+ Add new category…</option>`;
}

// "+ Add new category…" -> reveal a text input styled to signal the new mode.
function onNewCategoryMode() {
  const sel = document.getElementById('new-product-category');
  const newInput = document.getElementById('new-product-category-new');
  const adding = sel.value === '__add_new__';
  newInput.hidden = !adding;
  if (adding) {
    newInput.value = '';
    newInput.focus();
  }
}

// Effective category string for addProduct(): the new-category input when it is
// showing, otherwise the <select> value.
function getNewCategory() {
  const newInput = document.getElementById('new-product-category-new');
  if (newInput && !newInput.hidden) return newInput.value.trim();
  const sel = document.getElementById('new-product-category');
  const v = sel ? sel.value : '';
  return v === '__add_new__' ? '' : v.trim();
}

function filterAdminProducts(value) {
  apSearch = value;
  renderProductRows();
}

// Group the (search-filtered) products by category, in first-seen order.
function renderProductRows() {
  const rowsEl = document.getElementById('ap-rows');
  if (!rowsEl) return;

  const q = apSearch.trim().toLowerCase();
  const filtered = adminProducts.filter(p => !q || (p.name || '').toLowerCase().includes(q));

  if (!filtered.length) {
    const msg = adminProducts.length ? 'No products match your search.' : 'No products found.';
    rowsEl.innerHTML = `<div class="ap-empty">${msg}</div>`;
    return;
  }

  const groups = [];
  const idx = {};
  filtered.forEach(p => {
    const raw = (p.category || '').trim();
    const key = raw || ' uncat';
    if (idx[key] === undefined) {
      idx[key] = groups.length;
      groups.push({ raw, label: raw || 'Uncategorized', items: [] });
    }
    groups[idx[key]].items.push(p);
  });

  rowsEl.innerHTML = groups.map(g => `
    <div class="ap-cat">
      <span>${esc(g.label)}</span>
      <button type="button" class="ap-delcat" data-cat="${esc(g.raw)}"
        onclick="deleteCategory(this.dataset.cat)">Delete category</button>
    </div>
    ${g.items.map(renderProductRow).join('')}
  `).join('');
}

function renderProductRow(p) {
  const avail = !!p.available;
  return `
    <div class="ap-row${avail ? '' : ' ap-dim'}">
      <div class="ap-name">${esc(p.name)}</div>
      <div class="ap-unit">${esc(p.unit || '')}</div>
      <div class="ap-price">
        <span class="ap-rupee">₹</span>
        <input type="number" id="price-${p.id}" class="ap-price-in" value="${p.price}" min="0" />
        <button type="button" class="ap-save" onclick="updatePrice('${p.id}')">Save</button>
      </div>
      <div><span class="ap-status ${avail ? 'ok' : 'no'}">${avail ? 'Available' : 'Unavailable'}</span></div>
      <div>
        <button type="button" class="ap-toggle" onclick="toggleAvailability('${p.id}', ${avail})">
          ${avail ? 'Mark Unavailable' : 'Mark Available'}
        </button>
      </div>
      <div>
        <button type="button" class="ap-del" title="Delete product"
          data-id="${p.id}" data-name="${esc(p.name)}"
          onclick="deleteProduct(this.dataset.id, this.dataset.name)">✕</button>
      </div>
    </div>
  `;
}

// Delete one product after a native confirm.
async function deleteProduct(id, name) {
  if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

  const { error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Error deleting product.');
    return;
  }
  loadAdminProducts();
}

// Delete every product in a category after a native confirm.
async function deleteCategory(category) {
  const count = adminProducts.filter(p => (p.category || '').trim() === category).length;
  if (!window.confirm(`Delete category "${category}" and all ${count} product(s) in it? This cannot be undone.`)) return;

  const { error } = await supabaseClient
    .from('products')
    .delete()
    .eq('category', category);

  if (error) {
    alert('Error deleting category.');
    return;
  }
  loadAdminProducts();
}

// Update product price
async function updatePrice(productId) {
  const newPrice = parseFloat(document.getElementById('price-' + productId).value);

  if (isNaN(newPrice) || newPrice <= 0) {
    alert('Please enter a valid price.');
    return;
  }

  const { error } = await supabaseClient
    .from('products')
    .update({ price: newPrice })
    .eq('id', productId);

  if (error) {
    alert('Error updating price.');
    return;
  }

  alert('Price updated successfully.');
}

// Toggle product availability
async function toggleAvailability(productId, current) {
  const { error } = await supabaseClient
    .from('products')
    .update({ available: !current })
    .eq('id', productId);

  if (error) {
    alert('Error updating product.');
    return;
  }
  loadAdminProducts();
}

// Load all settings
async function loadSettings() {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('*');

  if (error || !data) return;

  data.forEach(row => {
    if (row.key === 'cutoff_time') {
      document.getElementById('cutoff-time-input').value = row.value;
    }
    if (row.key === 'shop_open') {
      updateShopToggleBtn(row.value === 'true');
    }
  });
}

// Update shop toggle button appearance
function updateShopToggleBtn(isOpen) {
  const btn = document.getElementById('shop-toggle-btn');
  if (isOpen) {
    btn.textContent = 'Shop is OPEN — Click to Close';
    btn.style.background = '#2DB234';
    btn.style.color = 'white';
  } else {
    btn.textContent = 'Shop is CLOSED — Click to Open';
    btn.style.background = '#e74c3c';
    btn.style.color = 'white';
  }
}

// Toggle shop open/closed
async function toggleShop() {
  const btn = document.getElementById('shop-toggle-btn');
  const msg = document.getElementById('shop-status-message');
  const currentlyOpen = btn.textContent.includes('OPEN');
  const newValue = (!currentlyOpen).toString();

  const { error } = await supabaseClient
    .from('settings')
    .update({ value: newValue })
    .eq('key', 'shop_open');

  if (error) {
    msg.textContent = 'Error updating shop status.';
    return;
  }

  updateShopToggleBtn(!currentlyOpen);
  msg.style.color = 'green';
  msg.textContent = !currentlyOpen ? 'Shop is now open.' : 'Shop is now closed.';
}

// Save cutoff time
async function saveCutoffTime() {
  const time = document.getElementById('cutoff-time-input').value;
  const msg = document.getElementById('settings-message');

  if (!time) {
    msg.textContent = 'Please select a time.';
    return;
  }

  const { error } = await supabaseClient
    .from('settings')
    .update({ value: time })
    .eq('key', 'cutoff_time');

  if (error) {
    msg.textContent = 'Error saving cutoff time.';
    return;
  }

  msg.style.color = 'green';
  msg.textContent = 'Cutoff time saved successfully.';
}

// Ensure session exists
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    await supabaseClient.auth.signInAnonymously();
  }
  loadAdminOrders();
})();

async function fetchPendingOrders() {
  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select(`*, order_items (quantity, price_at_order, products (name, unit, category))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !orders) return [];
  return orders;
}

// --- Purchase list helpers -------------------------------------------------

// Fixed category sections from the design handoff, in print order.
const PR_SECTION_ORDER = ['VEGETABLES', 'FRUITS', 'MEAT & POULTRY', 'DAIRY', 'GROCERY/STAPLES', 'OTHER'];
const PR_SECTION_MAP = {
  vegetable: 'VEGETABLES',
  fruit: 'FRUITS',
  meat: 'MEAT & POULTRY',
  poultry: 'MEAT & POULTRY',
  chicken: 'MEAT & POULTRY',
  dairy: 'DAIRY',
  milk: 'DAIRY',
  grocery: 'GROCERY/STAPLES',
  staple: 'GROCERY/STAPLES',
  spice: 'GROCERY/STAPLES',
  grain: 'GROCERY/STAPLES',
};

// Map a raw product.category string onto one of the fixed sections.
function sectionFor(category) {
  const key = (category || '').trim().toLowerCase().replace(/s$/, '');
  return PR_SECTION_MAP[key] || 'OTHER';
}

// kg contained in one ordered unit of a product, or null for count-based
// units (dozen, piece, bunch, packet, ml, ...). "500g" -> 0.5, "kg" -> 1.
function unitWeightKg(unit) {
  const u = (unit || '').toLowerCase().trim();
  let m = u.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (m) return parseFloat(m[1]);
  m = u.match(/(\d+(?:\.\d+)?)\s*g(?:m|ms|ram|rams)?\b/);
  if (m) return parseFloat(m[1]) / 1000;
  if (/^(kgs?|kilo|kilogram|per\s*kg)$/.test(u)) return 1;
  if (/^g(m|ms|ram|rams)?$/.test(u)) return 0.001;
  return null;
}

// Trim trailing zeros: 18 -> "18", 0.25 -> "0.25", 1.5 -> "1.5".
function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString();
}

// Volume units (ml / litre) are listed per item but never rolled into a
// category subtotal.
function isVolumeUnit(unit) {
  const u = (unit || '').toLowerCase();
  return /ml\b/.test(u) || /(^|[\d\s])l$/.test(u) || /lit(re|er)/.test(u) || /\bltr\b/.test(u);
}

async function generatePurchaseReport() {
  const orders = await fetchPendingOrders();
  const output = document.getElementById('report-output');

  if (!orders.length) {
    output.innerHTML = '<p style="margin-top:16px;">No pending orders.</p>';
    return;
  }

  const date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Aggregate ordered quantity per product across all pending orders, keyed by
  // product name, preserving first-seen order (same aggregation as before).
  const byName = {};
  const seen = [];
  orders.forEach(o => {
    o.order_items.forEach(it => {
      const p = it.products || {};
      const name = p.name || 'Unknown';
      if (!byName[name]) {
        byName[name] = { name, unit: p.unit || '', category: p.category || '', qty: 0 };
        seen.push(name);
      }
      byName[name].qty += it.quantity;
    });
  });

  // Bucket products into sections and compute the "needed" requirement string.
  const sections = {};
  seen.forEach(name => {
    const p = byName[name];
    const perUnitKg = unitWeightKg(p.unit);
    const entry = { name };
    if (perUnitKg != null) {
      entry.kg = perUnitKg * p.qty;
      entry.needed = `${fmtNum(entry.kg)} kg`;
    } else {
      entry.count = p.qty;
      entry.unit = (p.unit || 'pc').trim();
      entry.needed = `${p.qty} ${entry.unit}`.trim();
    }
    const sec = sectionFor(p.category);
    (sections[sec] = sections[sec] || []).push(entry);
  });

  const GRID = 'grid-template-columns: 26px 1.5fr 100px 80px 70px 90px 100px 40px 70px;';

  const body = PR_SECTION_ORDER.filter(s => sections[s]).map(sec => {
    const items = sections[sec];

    // Category subtotal: kg sum for weight items, plus each count unit summed.
    let kgSum = 0;
    const countSums = {};
    items.forEach(x => {
      if (x.kg) kgSum += x.kg;
      else if (!isVolumeUnit(x.unit)) countSums[x.unit] = (countSums[x.unit] || 0) + x.count;
    });
    const parts = [];
    if (kgSum) parts.push(`${fmtNum(kgSum)} kg`);
    Object.entries(countSums).forEach(([u, q]) => parts.push(`${fmtNum(q)} ${u}`));
    const subtotal = parts.join(' + ') || '—';

    const rows = items.map(x => `
      <div class="pr-row pr-item">
        <div class="c"><span class="pr-box"></span></div>
        <div>${x.name}</div>
        <div class="r pr-need">${x.needed}</div>
        <div class="r"><span class="pr-blank" style="width:50px;">&nbsp;</span></div>
        <div class="r"><span class="pr-blank" style="width:44px;">&nbsp;</span></div>
        <div class="r"><span class="pr-blank" style="width:60px;">&nbsp;</span></div>
        <div class="r"><span class="pr-blank" style="width:64px;">&nbsp;</span></div>
        <div class="c"><span class="pr-box"></span></div>
        <div class="c"><span class="pr-blank" style="width:44px;">&nbsp;</span></div>
      </div>
    `).join('');

    return `
      <div class="pr-catlabel">${sec}</div>
      ${rows}
      <div class="pr-row pr-sub">
        <div></div>
        <div>Subtotal</div>
        <div class="r">${subtotal}</div>
        <div class="r"><span class="pr-blank" style="width:44px;">&nbsp;</span></div>
        <div></div>
        <div class="r"><span class="pr-blank" style="width:60px;">&nbsp;</span></div>
        <div class="r"><span class="pr-blank" style="width:64px;">&nbsp;</span></div>
        <div></div>
        <div></div>
      </div>
    `;
  }).join('');

  output.innerHTML = `
    <style>
      @page { size: A4 portrait; margin: 0.5in; }

      #report-output .pr-sheet {
        --pr-ink: #333;     --pr-ink: oklch(0.2 0 0);
        --pr-rule: #e0e0e0; --pr-rule: oklch(0.88 0 0);
        --pr-mut: #737373;  --pr-mut: oklch(0.45 0 0);
        --pr-mut2: #666;    --pr-mut2: oklch(0.4 0 0);
        font-family: Helvetica, Arial, sans-serif;
        color: var(--pr-ink);
        font-size: 11px;
        margin-top: 16px;
      }
      #report-output .pr-head {
        display: flex; justify-content: space-between; align-items: baseline;
        border-bottom: 2px solid var(--pr-ink); padding-bottom: 6px; margin-bottom: 4px;
      }
      #report-output .pr-title { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; }
      #report-output .pr-meta { font-size: 11px; }
      #report-output .pr-instr { font-size: 9.5px; color: var(--pr-mut); margin-bottom: 8px; }
      #report-output .pr-blank { border-bottom: 1px solid #999; display: inline-block; }

      #report-output .pr-row { display: grid; ${GRID} align-items: center; }
      #report-output .pr-row .c { text-align: center; }
      #report-output .pr-row .r { text-align: right; }
      #report-output .pr-hrow { border-bottom: 2px solid var(--pr-ink); font-weight: 700; font-size: 10px; padding: 4px 0; }
      #report-output .pr-catlabel { font-weight: 700; font-size: 11px; padding: 6px 0 2px; break-after: avoid; }
      #report-output .pr-item { border-bottom: 1px solid var(--pr-rule); padding: 4px 0; }
      #report-output .pr-need { font-weight: 600; }
      #report-output .pr-sub { font-weight: 600; font-size: 10px; color: var(--pr-mut2); padding: 4px 0 2px; }
      #report-output .pr-box { width: 12px; height: 12px; border: 1.3px solid var(--pr-ink); display: block; margin: 0 auto; }
      #report-output .pr-summary {
        display: flex; justify-content: space-between;
        margin-top: 12px; padding-top: 8px; border-top: 2px solid var(--pr-ink); font-size: 11px;
      }

      @media print {
        .shop-header, .admin-tabs, .admin-container h2, #report-output .pr-noprint { display: none !important; }
        .admin-section { padding: 0 !important; }
        .admin-container { max-width: none !important; }
        #report-output .pr-sheet { margin-top: 0; }
        #report-output .pr-row { break-inside: avoid; }
      }
    </style>
    <div class="pr-sheet">
      <div class="pr-head">
        <div class="pr-title">PURCHASE LIST &mdash; ${date}</div>
        <div class="pr-meta">Orders covered: <strong>${orders.length}</strong></div>
      </div>
      <div class="pr-instr">Tick &ldquo;Bought&rdquo; as purchased. On return, admin re-measures into &ldquo;Received&rdquo; and initials each row.</div>
      <div style="margin-bottom:10px;">
        <button class="pr-noprint" onclick="window.print()" style="padding:8px 16px; background:#F5D000; border:none; cursor:pointer; font-weight:bold;">🖨️ Print / Save as PDF</button>
      </div>
      <div class="pr-row pr-hrow">
        <div class="c">&#10003;</div>
        <div>Product</div>
        <div class="r">Requirement</div>
        <div class="r">Bought</div>
        <div class="r">Rate</div>
        <div class="r">Spent</div>
        <div class="r">Received</div>
        <div class="c">&#10003;</div>
        <div class="c">Init.</div>
      </div>
      ${body}
      <div class="pr-summary">
        <div>Grand total spent: <span class="pr-blank" style="width:110px;">&nbsp;</span></div>
        <div>Purchased by: <span class="pr-blank" style="width:140px;">&nbsp;</span></div>
        <div>Checked by: <span class="pr-blank" style="width:140px;">&nbsp;</span></div>
      </div>
    </div>
  `;
}

// "7 per kg" / "7 kg" -> "7/kg" so the Qty column never wraps.
function shortQty(qty, unit) {
  const u = (unit || '').replace(/^per\s+/i, '').trim();
  return u ? `${qty}/${u}` : `${qty}`;
}

async function generatePackingList() {
  const orders = await fetchPendingOrders();
  const output = document.getElementById('report-output');

  if (!orders.length) {
    output.innerHTML = '<p style="margin-top:16px;">No pending orders.</p>';
    return;
  }

  const cards = orders.map((order, i) => {
    const total = order.order_items.reduce(
      (sum, it) => sum + (it.price_at_order || 0) * it.quantity, 0
    );

    const itemRows = order.order_items.map(it => `
      <div class="pl-row">
        <div class="pl-check"><span class="pl-box"></span></div>
        <div>${it.products.name}</div>
        <div class="pl-qty">${shortQty(it.quantity, it.products.unit)}</div>
        <div class="pl-rate">${it.price_at_order != null ? '&#8377;' + it.price_at_order : '&mdash;'}</div>
      </div>
    `).join('');

    return `
      <div class="order-block">
        <div class="pl-cardhead">
          <div>Order #${i + 1}</div>
          <div>${order.customer_name}</div>
          <div class="pl-phone">${order.phone}</div>
        </div>
        <div class="pl-addr">${order.address}, ${order.location}</div>
        <div class="pl-table">
          <div class="pl-row pl-thead">
            <div class="pl-check">&#10003;</div>
            <div>Item</div>
            <div class="pl-qty">Qty</div>
            <div class="pl-rate">Rate</div>
          </div>
          ${itemRows}
        </div>
        <div class="pl-foot">
          <div>Items: <strong>${order.order_items.length}</strong> &nbsp; COD: <strong>&#8377;${total}</strong></div>
          <div>Collected: <span class="pl-blank" style="width:44px;">&nbsp;</span></div>
          <div>Packed by: <span class="pl-blank" style="width:60px;">&nbsp;</span></div>
          <div>Notes: <span class="pl-blank" style="width:70px;">&nbsp;</span></div>
        </div>
      </div>
    `;
  }).join('');

  output.innerHTML = `
    <style>
      @page { size: A4 portrait; margin: 0.5in; }

      #report-output .pl-sheet {
        --pl-ink: #333;        --pl-ink: oklch(0.2 0 0);
        --pl-rule: #bfbfbf;    --pl-rule: oklch(0.75 0 0);
        --pl-rule-lt: #e0e0e0; --pl-rule-lt: oklch(0.88 0 0);
        --pl-fill: #f0f0f0;    --pl-fill: oklch(0.94 0 0);
        --pl-muted: #737373;   --pl-muted: oklch(0.45 0 0);
        width: 100%;
        border-collapse: collapse;
        font-family: Helvetica, Arial, sans-serif;
        color: var(--pl-ink);
        margin-top: 16px;
      }
      #report-output .pl-runhead {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-bottom: 2px solid var(--pl-ink);
        padding-bottom: 6px;
        margin-bottom: 4px;
      }
      #report-output .pl-runhead .pl-title { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; }
      #report-output .pl-runhead .pl-meta { font-size: 11px; }
      #report-output .pl-instructions { font-size: 10px; color: var(--pl-muted); margin: 6px 0 10px; }
      #report-output .pl-blank { border-bottom: 1px solid #999; display: inline-block; }

      #report-output .pl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      #report-output .order-block { border: 1px solid var(--pl-ink); margin-bottom: 10px; font-size: 10px; }
      #report-output .pl-cardhead {
        background: var(--pl-fill);
        border-bottom: 1px solid var(--pl-ink);
        padding: 4px 6px;
        font-weight: 700;
      }
      #report-output .pl-cardhead .pl-phone { font-weight: 400; }
      #report-output .pl-addr { padding: 4px 6px; border-bottom: 1px solid var(--pl-rule); }
      #report-output .pl-row {
        display: grid;
        grid-template-columns: 20px minmax(0, max-content) max-content max-content;
        border-bottom: 1px solid var(--pl-rule-lt);
        align-items: center;
      }
      #report-output .pl-row > div { padding: 3px 4px; }
      #report-output .pl-thead { border-bottom: 1px solid var(--pl-rule); font-weight: 600; }
      #report-output .pl-check { text-align: center; }
      #report-output .pl-qty,
      #report-output .pl-rate { text-align: right; white-space: nowrap; }
      #report-output .pl-box {
        width: 11px;
        height: 11px;
        border: 1.5px solid var(--pl-ink);
        display: block;
        margin: 0 auto;
      }
      #report-output .pl-foot { padding: 4px 6px; border-top: 1px solid var(--pl-rule); }

      @media print {
        .shop-header, .admin-tabs, .admin-container h2, #report-output .pl-noprint { display: none !important; }
        .admin-section { padding: 0 !important; }
        .admin-container { max-width: none !important; }
        #report-output .pl-sheet { margin-top: 0; }
        .order-block { break-inside: avoid; }
      }
    </style>
    <table class="pl-sheet">
      <thead>
        <tr><td>
          <div class="pl-runhead">
            <div class="pl-title">CAMPUS BAZAAR &mdash; PACKING CHECKLIST</div>
            <div class="pl-meta">Date: <span class="pl-blank" style="width:90px;">&nbsp;</span> Shift: <span class="pl-blank" style="width:60px;">&nbsp;</span></div>
          </div>
        </td></tr>
      </thead>
      <tbody>
        <tr><td>
          <div class="pl-instructions">Tick each item as it goes into the bag. Confirm COD amount collected. Sign before handing to rider.</div>
          <div style="margin-bottom:10px;">
            <button class="pl-noprint" onclick="window.print()" style="padding:8px 16px; background:#F5D000; border:none; cursor:pointer; font-weight:bold;">🖨️ Print / Save as PDF</button>
          </div>
          <div class="pl-grid">
            ${cards}
          </div>
        </td></tr>
      </tbody>
    </table>
  `;
}

// Add new product
async function addProduct() {
  const name = document.getElementById('new-product-name').value.trim();
  const category = getNewCategory();
  const unit = document.getElementById('new-product-unit').value.trim();
  const price = parseFloat(document.getElementById('new-product-price').value);
  const msg = document.getElementById('add-product-message');

  if (!name || !category || !unit || isNaN(price) || price <= 0) {
    msg.style.color = 'red';
    msg.textContent = 'Please fill in all fields with valid values.';
    return;
  }

  const { error } = await supabaseClient
    .from('products')
    .insert({ name, category, unit, price, available: true });

  if (error) {
    msg.style.color = 'red';
    msg.textContent = 'Error adding product.';
    return;
  }

  msg.style.color = 'green';
  msg.textContent = `${name} added successfully.`;

  // Clear form
  document.getElementById('new-product-name').value = '';
  document.getElementById('new-product-unit').value = '';
  document.getElementById('new-product-price').value = '';
  const catSel = document.getElementById('new-product-category');
  const catNew = document.getElementById('new-product-category-new');
  if (catSel) catSel.value = '';
  if (catNew) { catNew.value = ''; catNew.hidden = true; }

  loadAdminProducts();
}