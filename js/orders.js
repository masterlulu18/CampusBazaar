async function loadOrders() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const ordersList = document.getElementById('orders-list');

  if (!user) {
    ordersList.innerHTML = '<p class="loading">Please login to view your orders.</p>';
    return;
  }

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
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !orders.length) {
    ordersList.innerHTML = '<p class="loading">No orders found.</p>';
    return;
  }

  ordersList.innerHTML = orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <p class="order-date">${new Date(order.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}</p>
          <p class="order-address">📍 ${order.address}, ${order.location}</p>
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
      <div class="order-total">
        Total: ₹${order.order_items.reduce((sum, i) => sum + i.price_at_order * i.quantity, 0)}
      </div>
    </div>
  `).join('');
}

loadOrders();