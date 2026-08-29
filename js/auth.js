// Show login or signup tab
function showTab(tab) {
  document.getElementById('login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signup').style.display = tab === 'signup' ? 'block' : 'none';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

// Login
async function loginUser() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('auth-message');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    msg.textContent = error.message;
  } else {
    window.location.href = 'shop.html';
  }
}

// Signup
async function signupUser() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const msg = document.getElementById('auth-message');

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    msg.textContent = error.message;
  } else {
    msg.style.color = 'green';
    msg.textContent = 'Account created! You can now login.';
  }
}

// Guest
async function continueAsGuest() {
  const { error } = await supabaseClient.auth.signInAnonymously();
  if (error) {
    document.getElementById('auth-message').textContent = error.message;
  } else {
    window.location.href = 'shop.html';
  }
}