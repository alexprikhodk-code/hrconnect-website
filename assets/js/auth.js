// HRconnect — auth helpers
async function currentUser() {
  const { data: { user } } = await window.sb.auth.getUser();
  return user;
}

async function requireAuth(redirectTo = "/login.html") {
  const user = await currentUser();
  if (!user) {
    window.location.href = redirectTo + "?next=" + encodeURIComponent(window.location.pathname);
    return null;
  }
  return user;
}

async function signOut() {
  await window.sb.auth.signOut();
  window.location.href = "/";
}



// === Google OAuth ===
async function signInWithGoogle(redirectAfter = '/app/') {
  const { data, error } = await window.sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback.html?next=' + encodeURIComponent(redirectAfter),
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
  if (error) {
    console.error('Google OAuth error:', error);
    alert('Помилка входу через Google: ' + error.message);
    return null;
  }
  return data;
}

async function getMyProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await window.sb.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

async function getMySubscription() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await window.sb.from("subscriptions").select("*").eq("user_id", user.id).single();
  return data;
}

// Brand logo SVG inline (reusable)
function brandLogoSvg(size = 36) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" rx="14" fill="#1f4e78"/>
    <text x="32" y="29" font-family="Arial, sans-serif" font-weight="800" font-size="22" fill="white" text-anchor="middle" letter-spacing="-1">HR</text>
    <circle cx="32" cy="42" r="3" fill="#2e7d8f"/>
    <text x="32" y="56" font-family="Arial, sans-serif" font-weight="500" font-size="9" fill="#a3c4dc" text-anchor="middle" letter-spacing="2">CONNECT</text>
  </svg>`;
}
