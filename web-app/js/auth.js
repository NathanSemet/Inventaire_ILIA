// ─────────────────────────────────────────────────────────────
// auth.js — Authentification et gestion de session
// Dépend de : config.js, utils.js, data.js (via showApp → loadData)
// ─────────────────────────────────────────────────────────────

// ── Connexion ──

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('btn-login');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Connexion…';

  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Vérifie que l'utilisateur est bien membre ILIA
    const { data: userRow } = await db
      .from('users')
      .select('member_ILIA')
      .eq('email', email)
      .maybeSingle();

    if (!userRow?.member_ILIA) {
      await db.auth.signOut();
      throw new Error("Accès refusé : vous n'êtes pas membre ILIA.");
    }

    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
}

// ── Déconnexion ──

async function logout() {
  await db.auth.signOut();
  document.getElementById('app-screen').style.display    = 'none';
  document.getElementById('login-screen').style.display  = 'flex';
  document.getElementById('header-actions').style.display = 'none';
  document.getElementById('qr-grid').innerHTML = '';
  allItems = [];
}

// ── Affichage de l'app après connexion ──

function showApp() {
  document.getElementById('login-screen').style.display    = 'none';
  document.getElementById('app-screen').style.display      = 'block';
  document.getElementById('header-actions').style.display  = 'flex';
  loadData(); // défini dans data.js
}

// ── Auto-login si une session est déjà active ──
// Exécuté immédiatement au chargement de la page.
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;

  const { data: userRow } = await db
    .from('users')
    .select('member_ILIA')
    .eq('email', session.user.email)
    .maybeSingle();

  if (userRow?.member_ILIA) {
    showApp();
  } else {
    await db.auth.signOut();
  }
})();