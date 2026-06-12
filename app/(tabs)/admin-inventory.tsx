import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/supabaseConfig";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Model = { id: number; nom: string; description: string; id_category: number };
type Category = { id: number; nom: string };
type Item = {
  id: number;
  serial_number: string;
  status: string;
  id_model: number;
  model_materiel?: { nom: string } | null;
};

const STATUS_OPTIONS = ["disponible", "maintenance", "endommagé"];

export default function AdminInventoryScreen() {
  const { currentUser, loadingUser } = useCurrentUser();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "add">("list");

  // Formulaire
  const [createNewModel, setCreateNewModel] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [newModelNom, setNewModelNom] = useState("");
  const [newModelDesc, setNewModelDesc] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [itemStatus, setItemStatus] = useState("disponible");
  const [submitting, setSubmitting] = useState(false);

  // Pickers & modals
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loadingUser && !currentUser?.member_ILIA) {
      Alert.alert("Accès refusé", "Cette page est réservée aux membres ILIA.");
      router.replace("/");
    }
  }, [currentUser, loadingUser]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, modelsRes, catsRes] = await Promise.all([
        supabase.from("items")
          .select("id, serial_number, status, id_model, model_materiel(nom)")
          .order("id"),
        supabase.from("model_materiel")
          .select("id, nom, description, id_category")
          .order("nom"),
        supabase.from("Category").select("id, nom").order("nom"),
      ]);
      const formattedItems: Item[] = (itemsRes.data || []).map((i: any) => ({
        ...i,
        model_materiel: Array.isArray(i.model_materiel) ? i.model_materiel[0] : i.model_materiel,
      }));
      setItems(formattedItems);
      setModels(modelsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!serialNumber.trim()) {
      Alert.alert("Erreur", "Le numéro de série est requis");
      return;
    }
    setSubmitting(true);
    let modelId: number;

    try {
      if (createNewModel) {
        if (!newModelNom.trim() || !selectedCategoryId) {
          Alert.alert("Erreur", "Le nom du modèle et la catégorie sont requis");
          return;
        }
        const { data: newModel, error } = await supabase
          .from("model_materiel")
          .insert({ nom: newModelNom.trim(), description: newModelDesc.trim(), id_category: parseInt(selectedCategoryId) })
          .select("id").single();
        if (error || !newModel) throw error || new Error("Modèle non créé");
        modelId = newModel.id;
      } else {
        if (!selectedModelId) { Alert.alert("Erreur", "Sélectionnez un modèle"); return; }
        modelId = parseInt(selectedModelId);
      }

      const { error } = await supabase.from("items").insert({
        serial_number: serialNumber.trim(),
        status: itemStatus,
        id_model: modelId,
      });
      if (error) throw error;

      Alert.alert("✅ Succès", "Appareil ajouté à l'inventaire !");
      setSerialNumber(""); setSelectedModelId(""); setNewModelNom("");
      setNewModelDesc(""); setSelectedCategoryId(""); setItemStatus("disponible");
      setCreateNewModel(false); setActiveTab("list");
      await fetchAll();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible d'ajouter l'appareil");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("items").delete().eq("id", itemToDelete.id);
    if (error) {
      Alert.alert("Erreur", "Impossible de supprimer. L'appareil est peut-être en location active.");
    } else {
      Alert.alert("✅ Supprimé", "L'appareil a été retiré de l'inventaire.");
      await fetchAll();
    }
    setItemToDelete(null);
    setDeleting(false);
  };

  const getStatusStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case "disponible": return styles.badgeAvailable;
      case "loué": return styles.badgeRented;
      case "maintenance": return styles.badgeMaintenance;
      case "en attente de retour": return styles.badgePending;
      default: return styles.badgeDamaged;
    }
  };

  if (loadingUser || loading) return <ActivityIndicator size="large" style={{ marginTop: 80 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Gestion de l'Inventaire</Text>
      <Text style={styles.subtitle}>{items.length} appareil(s) au total</Text>

      {/* Onglets */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === "list" && styles.tabActive]} onPress={() => setActiveTab("list")}>
          <Text style={[styles.tabText, activeTab === "list" && styles.tabTextActive]}>📦 Liste ({items.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "add" && styles.tabActive]} onPress={() => setActiveTab("add")}>
          <Text style={[styles.tabText, activeTab === "add" && styles.tabTextActive]}>➕ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* ---- LISTE ---- */}
      {activeTab === "list" && (
        items.length === 0
          ? <Text style={styles.emptyText}>Aucun appareil dans l'inventaire</Text>
          : items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.model_materiel?.nom || "Modèle inconnu"}</Text>
                <View style={[styles.badge, getStatusStyle(item.status)]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.cardSerial}>N° {item.serial_number}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => setItemToDelete(item)}>
                <Text style={styles.deleteBtnText}>🗑 Supprimer</Text>
              </TouchableOpacity>
            </View>
          ))
      )}

      {/* ---- FORMULAIRE AJOUT ---- */}
      {activeTab === "add" && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Nouvel appareil</Text>

          {/* Toggle modèle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleOpt, !createNewModel && styles.toggleOptActive]} onPress={() => setCreateNewModel(false)}>
              <Text style={[styles.toggleText, !createNewModel && styles.toggleTextActive]}>Modèle existant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleOpt, createNewModel && styles.toggleOptActive]} onPress={() => setCreateNewModel(true)}>
              <Text style={[styles.toggleText, createNewModel && styles.toggleTextActive]}>Nouveau modèle</Text>
            </TouchableOpacity>
          </View>

          {!createNewModel ? (
            <TouchableOpacity style={styles.picker} onPress={() => setShowModelPicker(true)}>
              <Text style={selectedModelId ? styles.pickerSelected : styles.pickerPlaceholder}>
                {selectedModelId ? (models.find(m => m.id.toString() === selectedModelId)?.nom || "?") : "Sélectionner un modèle *"}
              </Text>
              <Text>▼</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="Nom du modèle *" value={newModelNom} onChangeText={setNewModelNom} />
              <TextInput style={styles.input} placeholder="Description (optionnel)" value={newModelDesc} onChangeText={setNewModelDesc} multiline />
              <TouchableOpacity style={styles.picker} onPress={() => setShowCategoryPicker(true)}>
                <Text style={selectedCategoryId ? styles.pickerSelected : styles.pickerPlaceholder}>
                  {selectedCategoryId ? (categories.find(c => c.id.toString() === selectedCategoryId)?.nom || "?") : "Catégorie *"}
                </Text>
                <Text>▼</Text>
              </TouchableOpacity>
            </>
          )}

          <TextInput style={styles.input} placeholder="Numéro de série *" value={serialNumber} onChangeText={setSerialNumber} />

          <TouchableOpacity style={styles.picker} onPress={() => setShowStatusPicker(true)}>
            <Text style={styles.pickerSelected}>{itemStatus}</Text>
            <Text>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleAddItem} disabled={submitting}>
            <Text style={styles.submitBtnText}>{submitting ? "Ajout..." : "Ajouter l'appareil"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Modèle */}
      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionner un modèle</Text>
            <TouchableOpacity onPress={() => setShowModelPicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>{models.map(m => (
            <TouchableOpacity key={m.id} style={[styles.modalOption, selectedModelId === m.id.toString() && styles.modalOptionSelected]}
              onPress={() => { setSelectedModelId(m.id.toString()); setShowModelPicker(false); }}>
              <Text style={styles.modalOptionText}>{m.nom}</Text>
              {m.description ? <Text style={styles.modalOptionSub}>{m.description}</Text> : null}
            </TouchableOpacity>
          ))}</ScrollView>
        </View></View>
      </Modal>

      {/* Modal Catégorie */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Catégorie</Text>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>{categories.map(c => (
            <TouchableOpacity key={c.id} style={[styles.modalOption, selectedCategoryId === c.id.toString() && styles.modalOptionSelected]}
              onPress={() => { setSelectedCategoryId(c.id.toString()); setShowCategoryPicker(false); }}>
              <Text style={styles.modalOptionText}>{c.nom}</Text>
            </TouchableOpacity>
          ))}</ScrollView>
        </View></View>
      </Modal>

      {/* Modal Statut */}
      <Modal visible={showStatusPicker} transparent animationType="slide" onRequestClose={() => setShowStatusPicker(false)}>
        <View style={styles.modalOverlay}><View style={[styles.modalContent, { maxHeight: 250 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Statut initial</Text>
            <TouchableOpacity onPress={() => setShowStatusPicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          {STATUS_OPTIONS.map(s => (
            <TouchableOpacity key={s} style={[styles.modalOption, itemStatus === s && styles.modalOptionSelected]}
              onPress={() => { setItemStatus(s); setShowStatusPicker(false); }}>
              <Text style={styles.modalOptionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View></View>
      </Modal>

      {/* Modal Suppression */}
      <Modal visible={itemToDelete !== null} transparent animationType="fade" onRequestClose={() => setItemToDelete(null)}>
        <View style={styles.alertOverlay}><View style={styles.alertBox}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <Text style={styles.alertTitle}>Supprimer cet appareil ?</Text>
          <Text style={styles.alertMessage}>
            {`"${itemToDelete?.model_materiel?.nom || "Appareil"}" (N° ${itemToDelete?.serial_number}) sera définitivement supprimé de l'inventaire.`}
          </Text>
          <View style={styles.alertButtons}>
            <TouchableOpacity style={styles.alertCancel} onPress={() => setItemToDelete(null)}>
              <Text style={styles.alertCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.alertConfirm} onPress={confirmDelete} disabled={deleting}>
              <Text style={styles.alertConfirmText}>{deleting ? "..." : "Supprimer"}</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  tabBar: { flexDirection: "row", backgroundColor: "#e2e8f0", borderRadius: 10, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  tabText: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  tabTextActive: { color: "#1e293b", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", flex: 1, marginRight: 8 },
  cardSerial: { fontSize: 13, color: "#64748b", fontFamily: "monospace", marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeAvailable: { backgroundColor: "#dcfce7" },
  badgeRented: { backgroundColor: "#dbeafe" },
  badgeMaintenance: { backgroundColor: "#fef3c7" },
  badgePending: { backgroundColor: "#fde68a" },
  badgeDamaged: { backgroundColor: "#fee2e2" },
  deleteBtn: { backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fca5a5", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  deleteBtnText: { color: "#dc2626", fontWeight: "600" },
  formContainer: { backgroundColor: "#fff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#e2e8f0" },
  formTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b", marginBottom: 16, textAlign: "center" },
  toggleRow: { flexDirection: "row", backgroundColor: "#e2e8f0", borderRadius: 8, padding: 4, marginBottom: 16 },
  toggleOpt: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  toggleOptActive: { backgroundColor: "#2563eb" },
  toggleText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  toggleTextActive: { color: "#fff", fontWeight: "700" },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 13, marginBottom: 12, fontSize: 15, color: "#1e293b" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 13, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerSelected: { fontSize: 15, color: "#1e293b" },
  pickerPlaceholder: { fontSize: 15, color: "#94a3b8" },
  submitBtn: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  submitBtnDisabled: { backgroundColor: "#93c5fd" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  emptyText: { color: "#64748b", textAlign: "center", marginTop: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", borderRadius: 12, width: "90%", maxHeight: "70%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#1e293b" },
  modalClose: { fontSize: 20, color: "#64748b" },
  modalOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalOptionSelected: { backgroundColor: "#eff6ff" },
  modalOptionText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  modalOptionSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  alertOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  alertBox: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, alignItems: "center" },
  alertIcon: { fontSize: 32, marginBottom: 12 },
  alertTitle: { fontSize: 20, fontWeight: "bold", color: "#1f2937", marginBottom: 8, textAlign: "center" },
  alertMessage: { fontSize: 14, color: "#4b5563", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  alertButtons: { flexDirection: "row", gap: 12, width: "100%" },
  alertCancel: { flex: 1, backgroundColor: "#f3f4f6", paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  alertCancelText: { color: "#374151", fontWeight: "600" },
  alertConfirm: { flex: 1, backgroundColor: "#ef4444", paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  alertConfirmText: { color: "#fff", fontWeight: "bold" },
});