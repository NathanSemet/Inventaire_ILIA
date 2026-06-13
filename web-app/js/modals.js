// ─────────────────────────────────────────────────────────────
// modals.js — Logique des modals (modifier, supprimer, ajouter)
// Dépend de : config.js, utils.js, data.js (via loadData)
// ─────────────────────────────────────────────────────────────

// ══════════════════════════════════════════
// MODIFIER LE STATUT
// ══════════════════════════════════════════

function openEditModal(id, nom, serial, currentStatus) {
  pendingEditId = id;
  document.getElementById('edit-item-label').textContent = `${nom} — ${serial}`;
  document.getElementById('edit-status').value = currentStatus;
  document.getElementById('edit-error').style.display = 'none';
  openModal('modal-edit');
}

async function saveStatus() {
  const btn    = document.getElementById('btn-save-edit');
  const errEl  = document.getElementById('edit-error');
  const status = document.getElementById('edit-status').value;

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  const { error } = await db
    .from('items')
    .update({ status })
    .eq('id', pendingEditId);

  btn.disabled = false;
  btn.textContent = 'Enregistrer';

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  closeModal('modal-edit');
  await loadData();
}

// ══════════════════════════════════════════
// SUPPRIMER UN ITEM
// ══════════════════════════════════════════

function openDeleteModal(id, nom, serial) {
  pendingDeleteId = id;
  document.getElementById('delete-item-label').textContent =
    `Vous allez supprimer : ${nom} — N° ${serial}`;
  document.getElementById('delete-error').style.display = 'none';
  openModal('modal-delete');
}

async function confirmDelete() {
  const btn   = document.getElementById('btn-confirm-delete');
  const errEl = document.getElementById('delete-error');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Suppression…';

  const { error } = await db
    .from('items')
    .delete()
    .eq('id', pendingDeleteId);

  btn.disabled = false;
  btn.textContent = 'Supprimer définitivement';

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  closeModal('modal-delete');
  await loadData();
}

// ══════════════════════════════════════════
// AJOUTER UN ITEM
// ══════════════════════════════════════════

function openAddModal() {
  document.getElementById('add-serial').value = '';
  document.getElementById('add-error').style.display   = 'none';
  document.getElementById('add-success').style.display = 'none';
  openModal('modal-add');
}

async function saveNewItem() {
  const btn     = document.getElementById('btn-save-add');
  const errEl   = document.getElementById('add-error');
  const succEl  = document.getElementById('add-success');
  const modelId = parseInt(document.getElementById('add-model').value);
  const serial  = document.getElementById('add-serial').value.trim();
  const status  = document.getElementById('add-status').value;

  errEl.style.display  = 'none';
  succEl.style.display = 'none';

  if (!serial) {
    errEl.textContent = 'Le numéro de série est requis.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Ajout…';

  const { error } = await db.from('items').insert([{
    id_model:      modelId,
    serial_number: serial,
    status,
  }]);

  btn.disabled = false;
  btn.textContent = 'Ajouter';

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  // Réinitialise le champ série et affiche le message de succès
  document.getElementById('add-serial').value = '';
  succEl.textContent = 'Item ajouté avec succès !';
  succEl.style.display = 'block';

  // Recharge la grille pour afficher le nouvel item
  await loadData();
}