import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  TextInput, TouchableOpacity, Alert, ScrollView, Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/supabaseConfig";

// ---- TYPES ----
type Item = {
  id: string;
  serial_number: string;
  status: string;
  model_materiel?: { nom: string } | null;
};

type User = {
  id: string;
  nom: string;
  email: string;
  member_ILIA: boolean;
};

type LocationWithDetails = {
  id: string;
  id_item: string;
  id_lender: string;
  id_borrower: string;
  location_date: string;
  return_date: string;
  effective_return_date?: string;
  return_state?: string;
  item?: {
    serial_number: string;
    model_materiel?: { nom: string } | null;
  } | null;
  lender?: { id: string; nom: string; email: string } | null;
  borrower?: { id: string; nom: string; email: string } | null;
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

  const [locations, setLocations] = useState<LocationWithDetails[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [lenders, setLenders] = useState<User[]>([]);
  const [connectedUser, setConnectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showLenderPicker, setShowLenderPicker] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ locationId: string; itemId: string } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    lenderId: "",
    nomEmprunteur: "",
    emailEmprunteur: "",
    itemId: "",
    locationDate: "",
    returnDate: "",
  });

  // ---- INITIALISATION ----
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await fetchConnectedUser();
      await Promise.all([
        fetchLocations(),
        fetchAvailableItems(params.itemId as string | undefined),
        fetchLenders(),
      ]);
      // ← EN DEHORS du Promise.all, la syntaxe est valide ici
      if (params.itemId) setShowForm(true);
      setLoading(false);
    };

    initializeData();
  }, []);

  // ---- CHARGEMENT DES DONNÉES ----

  const fetchConnectedUser = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, nom, email, member_ILIA")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) return;

      setConnectedUser(profile);
      setFormData((prev) => ({
        ...prev,
        nomEmprunteur: profile.nom,
        emailEmprunteur: profile.email,
      }));
    } catch (err) {
      console.error("Erreur fetchConnectedUser:", err);
    }
  };

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

      const formatted: LocationWithDetails[] = (data || []).map((loc: any) => ({
        ...loc,
        item: Array.isArray(loc.item) ? loc.item[0] : loc.item,
        lender: Array.isArray(loc.lender) ? loc.lender[0] : loc.lender,
        borrower: Array.isArray(loc.borrower) ? loc.borrower[0] : loc.borrower,
      }));

      setLocations(formatted);
    } catch (err) {
      console.error("Erreur fetchLocations:", err);
    }
  };

  const fetchAvailableItems = async (prefillId?: string) => {
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

      // On set l'itemId APRÈS que availableItems soit peuplé
      if (prefillId) {
        setFormData((prev) => ({ ...prev, itemId: prefillId }));
      }
    } catch (err) {
      console.error("Erreur fetchAvailableItems:", err);
    }
  };

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
      let { data: existingUser, error: searchError } = await supabase
        .from("users")
        .select("id")
        .eq("email", formData.emailEmprunteur)
        .maybeSingle();

      if (searchError) throw searchError;

      let borrowerId: string;
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

        if (createError) throw createError;
        if (!newUser) throw new Error("L'utilisateur a été créé mais aucun ID n'a été renvoyé.");
        borrowerId = newUser.id;
      } else {
        borrowerId = existingUser.id;
      }

      const { error: updateItemError } = await supabase
        .from("items")
        .update({ status: "loué" })
        .eq("id", formData.itemId);

      if (updateItemError) throw updateItemError;

      const { error: locationError } = await supabase
        .from("Location")
        .insert([{
          id_item: formData.itemId,
          id_lender: formData.lenderId,
          id_borrower: borrowerId,
          location_date: formData.locationDate,
          return_date: formData.returnDate,
        }]);

      if (locationError) {
        await supabase
          .from("items")
          .update({ status: "disponible" })
          .eq("id", formData.itemId);
        throw locationError;
      }

      Alert.alert("Succès", "Location créée avec succès");

      setFormData({
        lenderId: "",
        nomEmprunteur: connectedUser?.nom || "",
        emailEmprunteur: connectedUser?.email || "",
        itemId: "",
        locationDate: "",
        returnDate: "",
      });
      setShowForm(false);

      await fetchLocations();
      await fetchAvailableItems();
    } catch (err) {
      console.error("Erreur création location:", err);
      Alert.alert("Erreur", "Une erreur est survenue lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- SUPPRESSION ----

  const handleDeleteLocation = (locationId: string, itemId: string) => {
    setItemToDelete({ locationId, itemId });
  };

  const confirmDeletion = () => {
    if (itemToDelete) {
      deleteLocation(itemToDelete.locationId, itemToDelete.itemId);
      setItemToDelete(null);
    }
  };

  const deleteLocation = async (locationId: string, itemId: string) => {
    setDeleting(locationId);
    try {
      const { error: deleteError } = await supabase
        .from("Location")
        .delete()
        .eq("id", locationId);

      if (deleteError) throw deleteError;

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
    const item = availableItems.find((i) => String(i.id) === String(formData.itemId));
    return item
      ? `${item.model_materiel?.nom || "Inconnu"} — N°${item.serial_number}`
      : "Appareil inconnu";
  };

  const getSelectedLenderLabel = (): string => {
    if (!formData.lenderId) return "Sélectionner un prêteur";
    const lender = lenders.find((l) => String(l.id) === String(formData.lenderId));
    return lender ? lender.nom : "Prêteur inconnu";
  };

  // ---- RENDU ----

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Gestion des Locations</Text>

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

          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowLenderPicker(true)}
          >
            <Text style={formData.lenderId ? styles.pickerTextSelected : styles.pickerTextPlaceholder}>
              {getSelectedLenderLabel()}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, styles.inputDisabled]}
            placeholder="Nom de l'emprunteur"
            value={formData.nomEmprunteur}
            editable={false}
          />

          <TextInput
            style={[styles.input, styles.inputDisabled]}
            placeholder="Email de l'emprunteur"
            value={formData.emailEmprunteur}
            editable={false}
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowItemPicker(true)}
          >
            <Text style={formData.itemId ? styles.pickerTextSelected : styles.pickerTextPlaceholder}>
              {getSelectedItemLabel()}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Date de prêt (YYYY-MM-DD)"
            value={formData.locationDate}
            onChangeText={(v) => setFormData((p) => ({ ...p, locationDate: v }))}
          />

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

      {/* ---- MODAL PRÊTEUR ---- */}
      <Modal
        visible={showLenderPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLenderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un prêteur</Text>
              <TouchableOpacity onPress={() => setShowLenderPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {lenders.length === 0 && (
                <Text style={styles.emptyText}>Aucun membre ILIA disponible</Text>
              )}
              {lenders.map((lender) => (
                <TouchableOpacity
                  key={lender.id}
                  style={[
                    styles.modalOption,
                    formData.lenderId === lender.id && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData((p) => ({ ...p, lenderId: lender.id }));
                    setShowLenderPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{lender.nom}</Text>
                  <Text style={styles.modalOptionSubText}>{lender.email}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---- MODAL APPAREIL ---- */}
      <Modal
        visible={showItemPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowItemPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un appareil</Text>
              <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {availableItems.length === 0 && (
                <Text style={styles.emptyText}>Aucun appareil disponible</Text>
              )}
              {availableItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.modalOption,
                    formData.itemId === item.id && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData((p) => ({ ...p, itemId: item.id }));
                    setShowItemPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>
                    {item.model_materiel?.nom || "Modèle inconnu"}
                  </Text>
                  <Text style={styles.modalOptionSubText}>N° {item.serial_number}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---- LISTE DES LOCATIONS ---- */}
      <Text style={styles.subtitle}>Locations en cours</Text>

      <View style={{ marginBottom: 20 }}>
        {locations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucune location en cours</Text>
          </View>
        ) : (
          locations.map((item) => (
            <View key={item.id} style={styles.card}>
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
                <Text style={styles.cardText}>
                  Retour effectif : {item.effective_return_date}
                </Text>
              )}
              <Text style={[styles.cardText, styles.returnState]}>
                État : {item.return_state || "En cours"}
              </Text>

              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  deleting === item.id && styles.deleteButtonDisabled,
                ]}
                onPress={() => handleDeleteLocation(item.id, item.id_item)}
                disabled={deleting === item.id}
              >
                <Text style={styles.deleteButtonText}>
                  {deleting === item.id ? "Suppression..." : "Supprimer"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.navButton} onPress={() => router.push("/")}>
        <Text style={styles.navButtonText}>Voir l'inventaire</Text>
      </TouchableOpacity>

      {/* ---- MODAL CONFIRMATION SUPPRESSION ---- */}
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
              Cette action est irréversible. L'appareil redeviendra immédiatement disponible.
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
  input: { backgroundColor: "white", padding: 14, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: "#cbd5e1", fontSize: 15, color: "#1e293b" },
  inputDisabled: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", color: "#64748b" },

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

  deleteButton: { backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fca5a5", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", marginTop: 15 },
  deleteButtonDisabled: { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb", opacity: 0.6 },
  deleteButtonText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },

  alertOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  alertBox: { backgroundColor: "#ffffff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  alertIconContainer: { backgroundColor: "#fee2e2", width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  alertIcon: { fontSize: 24 },
  alertTitle: { fontSize: 20, fontWeight: "bold", color: "#1f2937", marginBottom: 10, textAlign: "center" },
  alertMessage: { fontSize: 15, color: "#4b5563", textAlign: "center", marginBottom: 24, lineHeight: 22 },
  alertButtonsContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 12 },
  alertCancelButton: { flex: 1, backgroundColor: "#f3f4f6", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  alertCancelText: { color: "#374151", fontSize: 16, fontWeight: "600" },
  alertConfirmButton: { flex: 1, backgroundColor: "#ef4444", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  alertConfirmText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
});

export default LocationScreen;