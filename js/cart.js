let cart = JSON.parse(localStorage.getItem('cart')) || [];

function loadCart() {
  const cartItems = document.getElementById('cart-items');
  const cartSummary = document.getElementById('cart-summary');
  const emptyCart = document.getElementById('empty-cart');

  if (cart.length === 0) {
    emptyCart.style.display = 'block';
    return;
  }

  cartSummary.style.display = 'block';

  let total = 0;
  cartItems.innerHTML = cart.map(item => {
    total += item.price * item.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>₹${item.price} ${item.unit}</p>
        </div>
        <div class="cart-item-controls">
          <button onclick="changeQty('${item.id}', -1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty('${item.id}', 1)">+</button>
          <button class="remove-btn" onclick="removeItem('${item.id}')">🗑</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cart-total').textContent = '₹' + total;
}

function changeQty(id, change) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  location.reload();
}

function removeItem(id) {
  cart = cart.filter(i => i.id !== id);
  localStorage.setItem('cart', JSON.stringify(cart));
  location.reload();
}

async function placeOrder() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const location = document.getElementById('cust-location').value.trim();
  const msg = document.getElementById('order-message');

  if (!name || !phone || !address || !location) {
    msg.textContent = 'Please fill in all delivery details.';
    return;
  }

  // Ensure user has a session before proceeding
  let { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (error) {
      msg.textContent = 'Authentication error. Try again.';
      return;
    }
    user = data.user;
  }

  const { data: order, error: orderError } = await supabaseClient
    .from('orders')
    .insert({
      customer_name: name,
      phone: phone,
      address: address,
      location: location,
      user_id: user ? user.id : null,
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) {
    msg.textContent = 'Error placing order. Try again.';
    return;
  }

  const orderItems = cart.map(item => ({
    order_id: order.id,
    product_id: item.id,
    quantity: item.quantity,
    price_at_order: item.price
  }));

  const { error: itemsError } = await supabaseClient
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    msg.textContent = 'Error saving order items. Try again.';
    return;
  }

  localStorage.setItem('lastAddress', JSON.stringify({
  name, phone, address, location
  }));

  localStorage.removeItem('cart');
  msg.style.color = 'green';
  msg.textContent = 'Order placed successfully! Final delivery subject to market availability.';
  setTimeout(() => window.location.href = 'orders.html', 2000);
}

const last = JSON.parse(localStorage.getItem('lastAddress'));
if (last) {
  document.getElementById('cust-name').value = last.name;
  document.getElementById('cust-phone').value = last.phone;
  document.getElementById('cust-address').value = last.address;
  document.getElementById('cust-location').value = last.location;
}

loadCart();