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

// Load all orders
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

  if (error || !orders || !orders.length) {
    list.innerHTML = '<p class="loading">No orders yet.</p>';
    return;
  }

  list.innerHTML = orders.map(order => {
    const total = order.order_items.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
    return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <p class="order-date">${order.customer_name} — ${order.phone}</p>
            <p class="order-address">📍 ${order.address}, ${order.location}</p>
            <p class="order-address">${new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
          <span class="order-status ${order.status}">${order.status}</span>
        </div>
        <div class="order-items">
          ${order.order_items.map(item => `
            <div class="order-item-row">
              <span>${item.products.name}</span>
              <span>x${item.quantity}</span>
              <span>₹${item.price_at_order * item.quantity}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-footer">
          <strong>Total: ₹${total}</strong>
          ${order.status === 'pending' ? `
            <button onclick="markDisposed('${order.id}')" class="btn-dispose">Mark as Disposed</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
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

// Load products
async function loadAdminProducts() {
  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('category');

  const list = document.getElementById('admin-products-list');

  if (error || !products.length) {
    list.innerHTML = '<p class="loading">No products found.</p>';
    return;
  }

  list.innerHTML = products.map(p => `
    <div class="product-admin-card">
      <div>
        <strong>${p.name}</strong> (${p.category})
        <p>${p.unit} — ${p.available ? 'Available' : 'Unavailable'}</p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
          <span>₹</span>
          <input type="number" id="price-${p.id}" value="${p.price}" min="0" style="width:80px; padding:4px;">
          <button onclick="updatePrice('${p.id}')">Save Price</button>
        </div>
      </div>
      <div>
        <button onclick="toggleAvailability('${p.id}', ${p.available})">
          ${p.available ? 'Mark Unavailable' : 'Mark Available'}
        </button>
      </div>
    </div>
  `).join('');
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
  const category = document.getElementById('new-product-category').value.trim();
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
  document.getElementById('new-product-category').value = '';
  document.getElementById('new-product-unit').value = '';
  document.getElementById('new-product-price').value = '';

  loadAdminProducts();
}