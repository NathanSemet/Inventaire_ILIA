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
 *   - 'loading' : spinner visible
 *   - 'empty'   : message "aucun item"
 *   - 'none'    : grille visible
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
 * @param {string} status - Valeur brute du statut (ex: "disponible")
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
 * À utiliser avant toute insertion de texte dans du HTML via innerHTML.
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
 * Cache les boutons de carte, lance l'impression, puis les restaure.
 * Nécessaire car @media print ne peut pas masquer des éléments
 * ajoutés dynamiquement avec display:flex inline.
 */
function printAll() {
  document.querySelectorAll('.card-actions').forEach(el => {
    el.style.display = 'none';
  });

  window.print();

  document.querySelectorAll('.card-actions').forEach(el => {
    el.style.display = 'flex';
  });
}