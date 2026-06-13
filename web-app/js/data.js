// ─────────────────────────────────────────────────────────────
// data.js — Chargement des données et rendu des cartes QR
// Dépend de : config.js, utils.js
// ─────────────────────────────────────────────────────────────

// ── Chargement des données depuis Supabase ──

async function loadData() {
  showState('loading');

  const [
    { data: items,  error: itemsError  },
    { data: models, error: modelsError },
  ] = await Promise.all([
    db.from('items')
      .select('id, serial_number, status, id_model, model_materiel(nom)')
      .order('id'),
    db.from('model_materiel')
      .select('id, nom')
      .order('nom'),
  ]);

  if (itemsError || modelsError) {
    console.error('Erreur chargement données:', itemsError || modelsError);
    showState('empty');
    return;
  }

  // Normalise les jointures Supabase (peut renvoyer un tableau ou un objet)
  allItems = (items || []).map(item => ({
    ...item,
    model_materiel: Array.isArray(item.model_materiel)
      ? item.model_materiel[0]
      : item.model_materiel,
  }));

  allModels = models || [];

  // Remplit le <select> du modal "Ajouter un item"
  const modelSelect = document.getElementById('add-model');
  modelSelect.innerHTML = allModels
    .map(m => `<option value="${m.id}">${esc(m.nom)}</option>`)
    .join('');

  renderCards(allItems);
}

// ── Rendu de la grille de cartes ──

function renderCards(items) {
  const grid       = document.getElementById('qr-grid');
  const countLabel = document.getElementById('count-label');

  grid.innerHTML = '';

  if (items.length === 0) {
    showState('empty');
    return;
  }

  showState('none');
  countLabel.textContent = `${items.length} item${items.length > 1 ? 's' : ''}`;

  items.forEach(item => {
    const nom    = item.model_materiel?.nom || 'Modèle inconnu';
    const serial = item.serial_number || '—';
    const status = (item.status || '').toLowerCase();
    const { cls, label } = statusMeta(status);

    // ── Construction de la carte ──
    const card = document.createElement('div');
    card.className       = 'qr-card';
    card.dataset.nom     = nom.toLowerCase();
    card.dataset.serial  = serial.toLowerCase();

    // Zone QR code (le QR sera injecté dedans après)
    const qrWrap = document.createElement('div');
    qrWrap.className = 'qr-wrap';
    card.appendChild(qrWrap);

    // Infos textuelles + boutons d'action
    card.insertAdjacentHTML('beforeend', `
      <div class="qr-info">
        <div class="qr-model">${esc(nom)}</div>
        <div class="qr-serial">${esc(serial)}</div>
        <span class="status-pill ${cls}">${label}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-outline btn-sm"
          onclick="openEditModal(${item.id}, '${esc(nom)}', '${esc(serial)}', '${esc(item.status)}')">
          ✏️ Statut
        </button>
        <button class="btn btn-danger btn-sm"
          onclick="openDeleteModal(${item.id}, '${esc(nom)}', '${esc(serial)}')">
          🗑
        </button>
      </div>
    `);

    grid.appendChild(card);

    // Génère le QR code APRÈS insertion dans le DOM
    new QRCode(qrWrap, {
      text: APP_SCHEME + item.id,
      width: 140,
      height: 140,
      correctLevel: QRCode.CorrectLevel.M,
    });
  });
}

// ── Filtrage en temps réel par nom ou numéro de série ──

function filterCards() {
  const query = document.getElementById('search-input').value.toLowerCase();

  const filtered = allItems.filter(item =>
    (item.model_materiel?.nom || '').toLowerCase().includes(query) ||
    (item.serial_number || '').toLowerCase().includes(query)
  );

  renderCards(filtered);
}