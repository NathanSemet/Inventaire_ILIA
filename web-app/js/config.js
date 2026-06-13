// ─────────────────────────────────────────────────────────────
// config.js — Configuration Supabase et état partagé global
// Doit être chargé EN PREMIER avant tous les autres scripts.
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://vgppozxbvlkskgnbdiui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncHBvenhidmxrc2tnbmJkaXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjg1ODIsImV4cCI6MjA5NDYwNDU4Mn0.LtuVrXhdw9dIIpIKnuuLtx_0LLh4U-0r0WtKalrTlMM';

// Schéma d'URL encodé dans chaque QR code
// Format final : myapp://location?materielId=<id>
const APP_SCHEME = 'myapp://location?materielId=';

// Client Supabase — accessible par tous les autres fichiers JS
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── État partagé entre les modules ──
let allItems      = [];   // Items chargés depuis Supabase
let allModels     = [];   // Modèles de matériel
let allCategories = [];   // Catégories (pour le formulaire nouveau modèle)

// IDs en attente d'action dans les modals
let pendingEditId   = null;
let pendingDeleteId = null;

// Mode actif du formulaire d'ajout : 'existing' ou 'new'
let addMode = 'existing';