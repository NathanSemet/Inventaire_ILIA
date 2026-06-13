// ─────────────────────────────────────────────────────────────
// modals.js — Logique des modals (modifier, supprimer, ajouter)
// Dépend de : config.js, utils.js, data.js
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

/**
 * Bascule entre "Modèle existant" et "Nouveau modèle".
 * @param {'existing' | 'new'} mode
 */
function switchAddMode(mode) {
  addMode = mode;

  document.getElementById('mode-btn-existing').classList.toggle('active', mode === 'existing');
  document.getElementById('mode-btn-new').classList.toggle('active', mode === 'new');
  document.getElementById('section-existing').style.display = mode === 'existing' ? 'block' : 'none';
  document.getElementById('section-new').style.display      = mode === 'new'      ? 'block' : 'none';
}

function openAddModal() {
  // Réinitialise tous les champs
  document.getElementById('add-serial').value            = '';
  document.getElementById('add-model-nom').value         = '';
  document.getElementById('add-model-description').value = '';
  document.getElementById('add-error').style.display     = 'none';
  document.getElementById('add-success').style.display   = 'none';

  // Remet sur le mode "modèle existant" par défaut
  switchAddMode('existing');

  openModal('modal-add');
}

async function saveNewItem() {
  const btn    = document.getElementById('btn-save-add');
  const errEl  = document.getElementById('add-error');
  const succEl = document.getElementById('add-success');
  const serial = document.getElementById('add-serial').value.trim();
  const status = document.getElementById('add-status').value;

  errEl.style.display  = 'none';
  succEl.style.display = 'none';

  // ── Validation commune ──
  if (!serial) {
    errEl.textContent = 'Le numéro de série est requis.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  try {
    let modelId;

    if (addMode === 'existing') {
      // ── Mode modèle existant ──
      modelId = parseInt(document.getElementById('add-model-existing').value);

      if (!modelId) {
        errEl.textContent = 'Veuillez sélectionner un modèle.';
        errEl.style.display = 'block';
        return;
      }

    } else {
      // ── Mode nouveau modèle ──
      const nomModele   = document.getElementById('add-model-nom').value.trim();
      const description = document.getElementById('add-model-description').value.trim();
      const categoryId  = parseInt(document.getElementById('add-model-category').value);

      if (!nomModele) {
        errEl.textContent = 'Le nom du modèle est requis.';
        errEl.style.display = 'block';
        return;
      }
      if (!categoryId) {
        errEl.textContent = 'Veuillez sélectionner une catégorie.';
        errEl.style.display = 'block';
        return;
      }

      // 1. Crée le nouveau modèle
      const { data: newModel, error: modelError } = await db
        .from('model_materiel')
        .insert([{
          nom:         nomModele,
          description: description || null,
          id_category: categoryId,
        }])
        .select('id')
        .single();

      if (modelError) throw new Error(`Erreur création modèle : ${modelError.message}`);

      modelId = newModel.id;
    }

    // 2. Crée l'item avec le modelId obtenu (existant ou nouveau)
    const { error: itemError } = await db
      .from('items')
      .insert([{
        id_model:      modelId,
        serial_number: serial,
        status,
      }]);

    if (itemError) throw new Error(`Erreur création item : ${itemError.message}`);

    // Succès
    document.getElementById('add-serial').value            = '';
    document.getElementById('add-model-nom').value         = '';
    document.getElementById('add-model-description').value = '';

    succEl.textContent   = addMode === 'new'
      ? 'Nouveau modèle et item créés avec succès !'
      : 'Item ajouté avec succès !';
    succEl.style.display = 'block';

    // Recharge la grille pour afficher le nouvel item
    await loadData();

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ajouter';
  }
}