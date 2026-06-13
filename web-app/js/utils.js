// ─────────────────────────────────────────────────────────────
// utils.js — Fonctions utilitaires partagées
// Dépend de : config.js
// ─────────────────────────────────────────────────────────────

// ── Gestion des modals ──

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Fermer un modal en cliquant sur le fond sombre
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => {
      if (e.target === bg) bg.classList.remove('open');
    });
  });
});

// ── Gestion des états de l'interface ──

/**
 * Affiche l'état courant de la grille.
 * @param {'loading' | 'empty' | 'none'} state
 */
function showState(state) {
  document.getElementById('loading-state').style.display =
    state === 'loading' ? 'flex' : 'none';
  document.getElementById('empty-state').style.display =
    state === 'empty' ? 'flex' : 'none';
  document.getElementById('qr-grid').style.display =
    state === 'none' ? 'grid' : 'none';

  if (state !== 'none') {
    document.getElementById('count-label').textContent = '—';
  }
}

// ── Métadonnées des statuts ──

/**
 * Retourne la classe CSS et le label d'affichage pour un statut donné.
 * @param {string} status
 * @returns {{ cls: string, label: string }}
 */
function statusMeta(status) {
  switch (status) {
    case 'disponible':  return { cls: 's-disponible',  label: 'Disponible' };
    case 'loué':        return { cls: 's-loue',         label: 'Loué' };
    case 'maintenance': return { cls: 's-maintenance',  label: 'Maintenance' };
    case 'endommagé':
    case 'endommage':   return { cls: 's-endommage',    label: 'Endommagé' };
    default:            return { cls: 's-default',      label: status || 'Inconnu' };
  }
}

// ── Sécurité HTML ──

/**
 * Échappe les caractères spéciaux HTML pour éviter les injections XSS.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Impression ──

/**
 * Cache les boutons de carte, déclenche l'impression, puis les restaure
 * via l'événement afterprint — plus fiable que de restaurer après window.print()
 * car certains navigateurs traitent window.print() de façon asynchrone.
 */
function printAll() {
  const actions = document.querySelectorAll('.card-actions');

  // Masque les boutons avant d'imprimer
  actions.forEach(el => el.style.display = 'none');

  // Restaure les boutons APRÈS que l'impression soit terminée ou annulée
  window.addEventListener('afterprint', function handler() {
    actions.forEach(el => el.style.display = 'flex');
    window.removeEventListener('afterprint', handler);
  });

  window.print();
}