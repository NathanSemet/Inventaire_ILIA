import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TextInput, TouchableOpacity, Alert, ScrollView, Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/supabaseConfig";

// ---- TYPES ----
type Item = {
  id: number;
  serial_number: string;
  status: string;
  model_materiel?: { nom: string } | null;
};

type User = {
  id: number;
  nom: string;
  email: string;
  member_ILIA: boolean;
};

type LocationWithDetails = {
  id: number;
  id_item: number;
  id_lender: number;
  id_borrower: number;
  location_date: string;
  return_date: string;
  effective_return_date?: string;
  return_state?: string;
  item?: {
    serial_number: string;
    model_materiel?: { nom: string } | null;
  } | null;
  lender?: { id: number; nom: string; email: string } | null;
  borrower?: { id: number; nom: string; email: string } | null;
};

type FormData = {
  lenderId: string;
  nomEmprunteur: string;
  emailEmprunteur: string;
  itemId: string;
  locationDate: string;
  returnDate: string;
};

// ---- COMPOSANT ----
const LocationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // États principaux
  const [locations, setLocations] = useState<LocationWithDetails[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [lenders, setLenders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // États UI
  const [showForm, setShowForm] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showLenderPicker, setShowLenderPicker] = useState(false);

  // Bouton suppression d'une location
  // Nouvel état pour notre alerte personnalisée
  const [itemToDelete, setItemToDelete] = useState<{ locationId: number; itemId: number } | null>(null);
  // Formulaire
  const [formData, setFormData] = useState<FormData>({
    lenderId: "",
    nomEmprunteur: "",
    emailEmprunteur: "",
    itemId: "",
    locationDate: "",
    returnDate: "",
  });

  // Si on arrive depuis index.tsx avec un itemId en paramètre
  useEffect(() => {
    if (params.itemId) {
      setFormData((prev) => ({ ...prev, itemId: params.itemId as string }));
      setShowForm(true);
    }
  }, [params.itemId]);

  useEffect(() => {
    fetchLocations();
    fetchAvailableItems();
    fetchLenders();
  }, []);

  // ---- CHARGEMENT DES DONNÉES ----

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("Location")
        .select(`
          id,
          id_item,
          id_lender,
          id_borrower,
          location_date,
          return_date,
          effective_return_date,
          return_state,
          item:items (
            serial_number,
            model_materiel ( nom )
          ),
          lender:users!Location_id_lender_fkey ( id, nom, email ),
          borrower:users!Location_id_borrower_fkey ( id, nom, email )
        `);

      if (error) {
        console.error("Erreur chargement locations:", error);
        return;
      }

      // Normalise les tableaux retournés par Supabase en objets simples
      const formatted: LocationWithDetails[] = (data || []).map((loc: any) => ({
        ...loc,
        item: Array.isArray(loc.item) ? loc.item[0] : loc.item,
        lender: Array.isArray(loc.lender) ? loc.lender[0] : loc.lender,
        borrower: Array.isArray(loc.borrower) ? loc.borrower[0] : loc.borrower,
      }));

      setLocations(formatted);
    } catch (err) {
      console.error("Erreur fetchLocations:", err);
    } finally {
      setLoading(false);
    }
  };

  // Uniquement les items disponibles pour le formulaire
  const fetchAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("id, serial_number, status, model_materiel(nom)")
        .eq("status", "disponible")
        .order("id");

      if (error) {
        console.error("Erreur chargement items:", error);
        return;
      }

      const formatted: Item[] = (data || []).map((item: any) => ({
        ...item,
        model_materiel: Array.isArray(item.model_materiel)
          ? item.model_materiel[0]
          : item.model_materiel,
      }));

      setAvailableItems(formatted);
    } catch (err) {
      console.error("Erreur fetchAvailableItems:", err);
    }
  };

  // Les prêteurs sont les membres ILIA (member_ILIA = true)
  const fetchLenders = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, nom, email, member_ILIA")
        .eq("member_ILIA", true)
        .order("nom");

      if (error) {
        console.error("Erreur chargement prêteurs:", error);
        return;
      }

      setLenders(data || []);
    } catch (err) {
      console.error("Erreur fetchLenders:", err);
    }
  };

  // ---- VALIDATION ----

  const validateForm = (): boolean => {
    if (!formData.lenderId) {
      Alert.alert("Erreur", "Veuillez sélectionner un prêteur");
      return false;
    }
    if (!formData.nomEmprunteur.trim()) {
      Alert.alert("Erreur", "Le nom de l'emprunteur est requis");
      return false;
    }
    if (!formData.emailEmprunteur.trim()) {
      Alert.alert("Erreur", "L'email de l'emprunteur est requis");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.emailEmprunteur)) {
      Alert.alert("Erreur", "L'email n'est pas valide");
      return false;
    }
    if (!formData.itemId) {
      Alert.alert("Erreur", "Veuillez sélectionner un appareil");
      return false;
    }
    if (!formData.locationDate.trim()) {
      Alert.alert("Erreur", "La date de prêt est requise");
      return false;
    }
    if (!formData.returnDate.trim()) {
      Alert.alert("Erreur", "La date de retour prévue est requise");
      return false;
    }
    return true;
  };

  // ---- CRÉATION D'UNE LOCATION ----

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      // 1. Cherche si l'emprunteur existe déjà
      let { data: existingUser, error: searchError } = await supabase
        .from("users")
        .select("id")
        .eq("email", formData.emailEmprunteur)
        .maybeSingle();

      if (searchError) throw searchError;

      // 2. Si l'emprunteur n'existe pas, on le crée
      let borrowerId: number;
      if (!existingUser) {
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert([{
            nom: formData.nomEmprunteur,
            email: formData.emailEmprunteur,
            member_ILIA: false,
          }])
          .select("id")
          .single();

        if (createError) {
          console.error("Erreur technique lors de la création de l'utilisateur:", createError);
          throw createError;
        }

        if (!newUser) {
          throw new Error("L'utilisateur a été créé mais aucun ID n'a été renvoyé.");
        }
        borrowerId = newUser.id;
      } else {
        borrowerId = existingUser.id;
      }

      // 3. Passe le statut de l'item à "loué"
      const { error: updateItemError } = await supabase
        .from("items")
        .update({ status: "loué" })
        .eq("id", parseInt(formData.itemId));

      if (updateItemError) throw updateItemError;

      // 4. Crée la location
      const { error: locationError } = await supabase
        .from("Location")
        .insert([{
          id_item: parseInt(formData.itemId),
          id_lender: parseInt(formData.lenderId),
          id_borrower: borrowerId,
          location_date: formData.locationDate,
          return_date: formData.returnDate,
        }]);

      if (locationError) {
        // Annule le changement de statut si la location échoue
        await supabase
          .from("items")
          .update({ status: "disponible" })
          .eq("id", parseInt(formData.itemId));
        throw locationError;
      }

      Alert.alert("Succès", "Location créée avec succès");

      // Reset formulaire
      setFormData({
        lenderId: "", nomEmprunteur: "", emailEmprunteur: "",
        itemId: "", locationDate: "", returnDate: "",
      });
      setShowForm(false);

      // Recharge les données
      await fetchLocations();
      await fetchAvailableItems();

    } catch (err) {
      console.error("Erreur création location:", err);
      Alert.alert("Erreur", "Une erreur est survenue lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- SUPPRESSION D'UNE LOCATION ----

  const handleDeleteLocation = (locationId: number, itemId: number) => {
    // Ouvre le modal et garde en mémoire les IDs
    setItemToDelete({ locationId, itemId });
  };

  const confirmDeletion = () => {
    if (itemToDelete) {
      deleteLocation(itemToDelete.locationId, itemToDelete.itemId);
      setItemToDelete(null); // Ferme le modal
    }
  };

  const deleteLocation = async (locationId: number, itemId: number) => {
    setDeleting(locationId);
    try {
      // 1. Supprime la location
      const { error: deleteError } = await supabase
        .from("Location")
        .delete()
        .eq("id", locationId);

      if (deleteError) throw deleteError;

      // 2. Remet l'item en "disponible"
      const { error: updateError } = await supabase
        .from("items")
        .update({ status: "disponible" })
        .eq("id", itemId);

      if (updateError) throw updateError;

      Alert.alert("Succès", "Location supprimée. L'appareil est de nouveau disponible.");
      await fetchLocations();
      await fetchAvailableItems();

    } catch (err) {
      console.error("Erreur suppression:", err);
      Alert.alert("Erreur", "Impossible de supprimer cette location");
    } finally {
      setDeleting(null);
    }
  };

  // ---- HELPERS ----

  const getSelectedItemLabel = (): string => {
    if (!formData.itemId) return "Sélectionner un appareil";
    const item = availableItems.find((i) => i.id.toString() === formData.itemId);
    return item
      ? `${item.model_materiel?.nom || "Inconnu"} — N°${item.serial_number}`
      : "Appareil inconnu";
  };

  const getSelectedLenderLabel = (): string => {
    if (!formData.lenderId) return "Sélectionner un prêteur";
    const lender = lenders.find((l) => l.id.toString() === formData.lenderId);
    return lender ? lender.nom : "Prêteur inconnu";
  };

  // ---- RENDU D'UNE CARTE LOCATION ----

  const renderLocation = ({ item }: { item: LocationWithDetails }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {item.item?.model_materiel?.nom || "Appareil inconnu"}
      </Text>
      <Text style={styles.cardText}>N° série : {item.item?.serial_number || "—"}</Text>
      <Text style={styles.cardText}>Emprunteur : {item.borrower?.nom || "—"}</Text>
      <Text style={styles.cardText}>Email : {item.borrower?.email || "—"}</Text>
      <Text style={styles.cardText}>Prêteur : {item.lender?.nom || "—"}</Text>
      <Text style={styles.cardText}>Date de prêt : {item.location_date}</Text>
      <Text style={styles.cardText}>Retour prévu : {item.return_date}</Text>
      {item.effective_return_date && (
        <Text style={styles.cardText}>Retour effectif : {item.effective_return_date}</Text>
      )}
      <Text style={[styles.cardText, styles.returnState]}>
        État : {item.return_state || "En cours"}
      </Text>

      <TouchableOpacity
        style={[styles.deleteButton, deleting === item.id && styles.deleteButtonDisabled]}
        onPress={() => handleDeleteLocation(item.id, item.id_item)}
        disabled={deleting === item.id}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteButtonText}>
          {deleting === item.id ? "Suppression en cours..." : "Supprimer la location"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ---- RENDU PRINCIPAL ----

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Gestion des Locations</Text>

      {/* Bouton toggle formulaire */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowForm(!showForm)}
      >
        <Text style={styles.toggleButtonText}>
          {showForm ? "Masquer le formulaire" : "Nouvelle location"}
        </Text>
      </TouchableOpacity>

      {/* ---- FORMULAIRE ---- */}
      {showForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Nouvelle location</Text>

          {/* Picker Prêteur */}
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowLenderPicker(true)}
          >
            <Text style={formData.lenderId ? styles.pickerTextSelected : styles.pickerTextPlaceholder}>
              {getSelectedLenderLabel()}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Nom emprunteur */}
          <TextInput
            style={styles.input}
            placeholder="Nom de l'emprunteur"
            value={formData.nomEmprunteur}
            onChangeText={(v) => setFormData((p) => ({ ...p, nomEmprunteur: v }))}
          />

          {/* Email emprunteur */}
          <TextInput
            style={styles.input}
            placeholder="Email de l'emprunteur"
            value={formData.emailEmprunteur}
            onChangeText={(v) => setFormData((p) => ({ ...p, emailEmprunteur: v }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Picker Item */}
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowItemPicker(true)}
          >
            <Text style={formData.itemId ? styles.pickerTextSelected : styles.pickerTextPlaceholder}>
              {getSelectedItemLabel()}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Date de prêt */}
          <TextInput
            style={styles.input}
            placeholder="Date de prêt (YYYY-MM-DD)"
            value={formData.locationDate}
            onChangeText={(v) => setFormData((p) => ({ ...p, locationDate: v }))}
          />

          {/* Date de retour prévue */}
          <TextInput
            style={styles.input}
            placeholder="Date de retour prévue (YYYY-MM-DD)"
            value={formData.returnDate}
            onChangeText={(v) => setFormData((p) => ({ ...p, returnDate: v }))}
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? "Création en cours..." : "Créer la location"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---- MODALS (Inchangés mais gardés ici pour la structure) ---- */}
      <Modal visible={showLenderPicker} transparent animationType="slide" onRequestClose={() => setShowLenderPicker(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionner un prêteur</Text>
            <TouchableOpacity onPress={() => setShowLenderPicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {lenders.length === 0 && <Text style={styles.emptyText}>Aucun membre ILIA disponible</Text>}
            {lenders.map((lender) => (
              <TouchableOpacity key={lender.id} style={[styles.modalOption, formData.lenderId === lender.id.toString() && styles.modalOptionSelected]} onPress={() => { setFormData((p) => ({ ...p, lenderId: lender.id.toString() })); setShowLenderPicker(false); }}>
                <Text style={styles.modalOptionText}>{lender.nom}</Text>
                <Text style={styles.modalOptionSubText}>{lender.email}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={showItemPicker} transparent animationType="slide" onRequestClose={() => setShowItemPicker(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionner un appareil</Text>
            <TouchableOpacity onPress={() => setShowItemPicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {availableItems.length === 0 && <Text style={styles.emptyText}>Aucun appareil disponible</Text>}
            {availableItems.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.modalOption, formData.itemId === item.id.toString() && styles.modalOptionSelected]} onPress={() => { setFormData((p) => ({ ...p, itemId: item.id.toString() })); setShowItemPicker(false); }}>
                <Text style={styles.modalOptionText}>{item.model_materiel?.nom || "Modèle inconnu"}</Text>
                <Text style={styles.modalOptionSubText}>N° {item.serial_number}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>


      {/* ---- LISTE DES LOCATIONS OPTIMISÉE (PLUS DE FLATLIST) ---- */}
      <Text style={styles.subtitle}>Locations en cours</Text>
      
      <View style={{ marginBottom: 20 }}>
        {locations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucune location en cours</Text>
          </View>
        ) : (
          locations.map((item) => (
            <View key={item.id.toString()} style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.item?.model_materiel?.nom || "Appareil inconnu"}
              </Text>
              <Text style={styles.cardText}>N° série : {item.item?.serial_number || "—"}</Text>
              <Text style={styles.cardText}>Emprunteur : {item.borrower?.nom || "—"}</Text>
              <Text style={styles.cardText}>Email : {item.borrower?.email || "—"}</Text>
              <Text style={styles.cardText}>Prêteur : {item.lender?.nom || "—"}</Text>
              <Text style={styles.cardText}>Date de prêt : {item.location_date}</Text>
              <Text style={styles.cardText}>Retour prévu : {item.return_date}</Text>
              {item.effective_return_date && (
                <Text style={styles.cardText}>Retour effectif : {item.effective_return_date}</Text>
              )}
              <Text style={[styles.cardText, styles.returnState]}>
                État : {item.return_state || "En cours"}
              </Text>

              <TouchableOpacity
                style={[styles.deleteButton, deleting === item.id && styles.deleteButtonDisabled]}
                onPress={() => handleDeleteLocation(item.id, item.id_item)}
              >
                <Text style={styles.deleteButtonText}>
                  {deleting === item.id ? "Suppression..." : "Supprimer"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => router.push("/")}
      >
        <Text style={styles.navButtonText}>Voir l'inventaire</Text>
      </TouchableOpacity>

      {/* ---- MODAL DE CONFIRMATION DE SUPPRESSION ---- */}
      <Modal
        visible={itemToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setItemToDelete(null)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertIconContainer}>
              <Text style={styles.alertIcon}>⚠️</Text>
            </View>
            <Text style={styles.alertTitle}>Supprimer cette location ?</Text>
            <Text style={styles.alertMessage}>
              Cette action est irréversible. L'appareil redeviendra immédiatement disponible dans l'inventaire.
            </Text>
            
            <View style={styles.alertButtonsContainer}>
              <TouchableOpacity 
                style={styles.alertCancelButton} 
                onPress={() => setItemToDelete(null)}
              >
                <Text style={styles.alertCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.alertConfirmButton} 
                onPress={confirmDeletion}
              >
                <Text style={styles.alertConfirmText}>Oui, supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ---- STYLES ----
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#ffffff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#1e293b" },
  subtitle: { fontSize: 20, fontWeight: "bold", marginTop: 24, marginBottom: 12, color: "#1e293b" },

  toggleButton: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginBottom: 20 },
  toggleButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },

  formContainer: { backgroundColor: "#f8fafc", padding: 20, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" },
  formTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16, textAlign: "center", color: "#1e293b" },
  input: { backgroundColor: "white", padding: 14, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: "#cbd5e1", fontSize: 15 },

  pickerButton: { backgroundColor: "white", padding: 14, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: "#cbd5e1", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerTextSelected: { fontSize: 15, color: "#1e293b", flex: 1 },
  pickerTextPlaceholder: { fontSize: 15, color: "#94a3b8", flex: 1 },
  pickerArrow: { color: "#64748b", fontSize: 12 },

  submitButton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  submitButtonDisabled: { backgroundColor: "#93c5fd" },
  submitButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },

  card: { backgroundColor: "#f0f9ff", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#bae6fd" },
  cardTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8, color: "#0c4a6e" },
  cardText: { fontSize: 14, color: "#334155", marginBottom: 2 },
  returnState: { marginTop: 6, fontWeight: "600", color: "#0369a1" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "white", borderRadius: 12, width: "90%", maxHeight: "70%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#1e293b" },
  modalClose: { fontSize: 20, color: "#64748b", padding: 4 },
  modalOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalOptionSelected: { backgroundColor: "#eff6ff" },
  modalOptionText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  modalOptionSubText: { fontSize: 13, color: "#64748b", marginTop: 2 },

  navButton: { backgroundColor: "#059669", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginVertical: 24 },
  navButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },

  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyText: { color: "#64748b", fontSize: 15, textAlign: "center", padding: 20 },
  // --- STYLES DU BOUTON DE LA CARTE ---
  deleteButton: {
    backgroundColor: "#fee2e2", // Rouge très clair
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  deleteButtonDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    opacity: 0.6,
  },
  deleteButtonText: {
    color: "#dc2626", // Texte rouge foncé
    fontSize: 15,
    fontWeight: "600",
  },

  // --- STYLES DE LA NOUVELLE ALERTE MODAL ---
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Fond noir semi-transparent
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertBox: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  alertIconContainer: {
    backgroundColor: "#fee2e2",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  alertIcon: {
    fontSize: 24,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 10,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12, // Espace entre les deux boutons
  },
  alertCancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  alertCancelText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  alertConfirmButton: {
    flex: 1,
    backgroundColor: "#ef4444", // Rouge vif
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  alertConfirmText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default LocationScreen;