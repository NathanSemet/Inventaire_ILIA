// ─────────────────────────────────────────────────────────────
// data.js — Chargement des données et rendu des cartes QR
// Dépend de : config.js, utils.js
// ─────────────────────────────────────────────────────────────

// ── Chargement des données depuis Supabase ──

async function loadData() {
  showState('loading');

  const [
    { data: items,      error: itemsError      },
    { data: models,     error: modelsError     },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    db.from('items')
      .select('id, serial_number, status, id_model, model_materiel(nom)')
      .order('id'),
    db.from('model_materiel')
      .select('id, nom')
      .order('nom'),
    db.from('Category')
      .select('id, nom')
      .order('nom'),
  ]);

  if (itemsError || modelsError || categoriesError) {
    console.error('Erreur chargement données:',
      itemsError || modelsError || categoriesError);
    showState('empty');
    return;
  }

  // Normalise les jointures Supabase (tableau ou objet selon la version)
  allItems = (items || []).map(item => ({
    ...item,
    model_materiel: Array.isArray(item.model_materiel)
      ? item.model_materiel[0]
      : item.model_materiel,
  }));

  allModels     = models     || [];
  allCategories = categories || [];

  // Remplit les <select> du modal "Ajouter un item"
  document.getElementById('add-model-existing').innerHTML =
    allModels.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');

  document.getElementById('add-model-category').innerHTML =
    allCategories.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('');

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

    const card = document.createElement('div');
    card.className      = 'qr-card';
    card.dataset.nom    = nom.toLowerCase();
    card.dataset.serial = serial.toLowerCase();

    // Zone QR code (injectée après insertion dans le DOM)
    const qrWrap = document.createElement('div');
    qrWrap.className = 'qr-wrap';
    card.appendChild(qrWrap);

    // Infos + boutons d'action
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

    // QR code généré APRÈS insertion dans le DOM
    new QRCode(qrWrap, {
      text: APP_SCHEME + item.id,
      width: 140,
      height: 140,
      correctLevel: QRCode.CorrectLevel.M,
    });
  });
}

// ── Filtrage en temps réel ──

function filterCards() {
  const query = document.getElementById('search-input').value.toLowerCase();

  const filtered = allItems.filter(item =>
    (item.model_materiel?.nom || '').toLowerCase().includes(query) ||
    (item.serial_number || '').toLowerCase().includes(query)
  );

  renderCards(filtered);
}