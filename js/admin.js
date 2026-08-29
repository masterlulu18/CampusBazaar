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
    .select(`*, order_items (quantity, products (name, unit))`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !orders) return [];
  return orders;
}

async function generatePurchaseReport() {
  const orders = await fetchPendingOrders();
  const output = document.getElementById('report-output');

  if (!orders.length) {
    output.innerHTML = '<p style="margin-top:16px;">No pending orders.</p>';
    return;
  }

  const totals = {};
  orders.forEach(order => {
    order.order_items.forEach(item => {
      const key = `${item.products.name} (${item.products.unit})`;
      totals[key] = (totals[key] || 0) + item.quantity;
    });
  });

  const date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  output.innerHTML = `
    <div style="margin-top:24px; font-family:sans-serif;">
      <h3>Purchase Report — ${date}</h3>
      <p>Total pending orders: ${orders.length}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:12px;">
        <thead>
          <tr style="background:#2DB234; color:white;">
            <th style="padding:8px; text-align:left;">Product</th>
            <th style="padding:8px; text-align:right;">Total Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(totals).map(([name, qty], i) => `
            <tr style="background:${i % 2 === 0 ? '#f9f9f9' : 'white'}">
              <td style="padding:8px;">${name}</td>
              <td style="padding:8px; text-align:right;">${qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <br>
      <button onclick="window.print()" style="padding:8px 16px; background:#F5D000; border:none; cursor:pointer; font-weight:bold;">🖨️ Print / Save as PDF</button>
    </div>
  `;
}

async function generatePackingList() {
  const orders = await fetchPendingOrders();
  const output = document.getElementById('report-output');

  if (!orders.length) {
    output.innerHTML = '<p style="margin-top:16px;">No pending orders.</p>';
    return;
  }

  const date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  output.innerHTML = `
    <div style="margin-top:24px; font-family:sans-serif;">
      <h3>Packing List — ${date}</h3>
      ${orders.map((order, i) => `
        <div style="border:1px solid #ddd; padding:12px; margin-bottom:12px; page-break-inside:avoid;">
          <strong>#${i + 1} — ${order.customer_name}</strong> | ${order.phone}<br>
          📍 ${order.address}, ${order.location}
          <ul style="margin:8px 0;">
            ${order.order_items.map(item => `
              <li>${item.products.name} x${item.quantity} (${item.products.unit})</li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
      <br>
      <button onclick="window.print()" style="padding:8px 16px; background:#F5D000; border:none; cursor:pointer; font-weight:bold;">🖨️ Print / Save as PDF</button>
    </div>
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