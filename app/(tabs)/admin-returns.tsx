import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "@/supabaseConfig";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type LoanItem = {
  locationId: number;
  itemId: number;
  serial_number: string;
  modelNom: string;
  borrowerNom: string;
  borrowerEmail: string;
  lenderNom: string;
  return_date: string;
  location_date: string;
};

const RETURN_STATES = [
  { value: "bon état", label: "✅ Bon état" },
  { value: "abîmé", label: "⚠️ Abîmé" },
  { value: "perdu", label: "❌ Perdu / Introuvable" },
];

export default function AdminReturnsScreen() {
  const { currentUser, loadingUser } = useCurrentUser();
  const router = useRouter();

  const [overdueItems, setOverdueItems] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Scan QR
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Recherche manuelle
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Modal de retour
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [returnState, setReturnState] = useState("bon état");
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Recharge à chaque focus de l'écran
  useFocusEffect(
    useCallback(() => {
      if (!loadingUser && !currentUser?.member_ILIA) {
        Alert.alert("Accès refusé", "Cette page est réservée aux membres ILIA.");
        router.replace("/");
        return;
      }
      checkAndUpdateOverdue();
    }, [loadingUser, currentUser])
  );

  const checkAndUpdateOverdue = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("Location")
        .select(`
          id, location_date, return_date,
          item:items(id, serial_number, status, model_materiel(nom)),
          borrower:users!Location_id_borrower_fkey(nom, email),
          lender:users!Location_id_lender_fkey(nom)
        `)
        .lt("return_date", today)
        .is("effective_return_date", null)
        .eq("statut", "active");

      if (error) throw error;

      const formatted: LoanItem[] = [];

      for (const loc of (data || [])) {
        const item = Array.isArray(loc.item) ? loc.item[0] : loc.item;
        const borrower = Array.isArray(loc.borrower) ? loc.borrower[0] : loc.borrower;
        const lender = Array.isArray(loc.lender) ? loc.lender[0] : loc.lender;
        const model = item
          ? (Array.isArray(item.model_materiel) ? item.model_materiel[0] : item.model_materiel)
          : null;

        if (!item) continue;

        // Met à jour le statut si besoin
        if (item.status !== "en attente de retour") {
          await supabase
            .from("items")
            .update({ status: "en attente de retour" })
            .eq("id", item.id);
        }

        formatted.push({
          locationId: loc.id,
          itemId: item.id,
          serial_number: item.serial_number,
          modelNom: model?.nom || "Modèle inconnu",
          borrowerNom: borrower?.nom || "—",
          borrowerEmail: borrower?.email || "—",
          lenderNom: lender?.nom || "—",
          return_date: loc.return_date,
          location_date: loc.location_date,
        });
      }

      setOverdueItems(formatted);
    } catch (err) {
      console.error("checkAndUpdateOverdue:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchBySerial = async (rawSerial: string) => {
    if (!rawSerial.trim()) {
      Alert.alert("Erreur", "Entrez un numéro de série");
      return;
    }
    setSearching(true);
    try {
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, serial_number, status, model_materiel(nom)")
        .eq("serial_number", rawSerial.trim())

        .maybeSingle();

      if (itemError) throw itemError;
      if (!itemData) {
        Alert.alert("Non trouvé", `Aucun appareil avec le numéro de série "${rawSerial.trim()}"`);
        return;
      }

      const model = Array.isArray(itemData.model_materiel)
        ? itemData.model_materiel[0]
        : itemData.model_materiel;

      // Cherche la location active
      const { data: loc, error: locError } = await supabase
        .from("Location")
        .select(`
          id, location_date, return_date,
          borrower:users!Location_id_borrower_fkey(nom, email),
          lender:users!Location_id_lender_fkey(nom)
        `)
        .eq("id_item", itemData.id)
        .is("effective_return_date", null)
        .eq("statut", "active")   
        .maybeSingle();

      if (locError) throw locError;

      if (!loc) {
        Alert.alert(
          "Appareil disponible",
          `"${model?.nom || rawSerial}" n'est actuellement pas en location active.`
        );
        return;
      }

      const borrower = Array.isArray(loc.borrower) ? loc.borrower[0] : loc.borrower;
      const lender = Array.isArray(loc.lender) ? loc.lender[0] : loc.lender;

      openReturnModal({
        locationId: loc.id,
        itemId: itemData.id,
        serial_number: itemData.serial_number,
        modelNom: model?.nom || "Modèle inconnu",
        borrowerNom: borrower?.nom || "—",
        borrowerEmail: borrower?.email || "—",
        lenderNom: lender?.nom || "—",
        return_date: loc.return_date,
        location_date: loc.location_date,
      });
    } catch (err) {
      console.error(err);
      Alert.alert("Erreur", "Impossible de rechercher cet appareil");
    } finally {
      setSearching(false);
    }
  };

  const handleQRScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setTimeout(() => setScanned(false), 3000);

    let serial = data.trim();

    // Format URL avec paramètre serial ou serial_number
    try {
      const url = new URL(data);
      const s = url.searchParams.get("serial_number") || url.searchParams.get("serial");
      if (s) serial = s;
    } catch {}

    // Format JSON
    try {
      const parsed = JSON.parse(data);
      if (parsed.serial_number) serial = parsed.serial_number;
      else if (parsed.serial) serial = parsed.serial;
    } catch {}

    searchBySerial(serial);
  };

  const openReturnModal = (loan: LoanItem) => {
    setSelectedLoan(loan);
    setReturnState("bon état");
    setShowReturnModal(true);
  };

  // ---- Valider le retour ----
  const validateReturn = async () => {
    if (!selectedLoan) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { error: locError } = await supabase
        .from("Location")
        .update({ effective_return_date: today, return_state: returnState })
        .eq("id", selectedLoan.locationId);
      if (locError) throw locError;

      // Si perdu → endommagé, sinon → disponible
      const newStatus = returnState === "perdu" ? "endommagé" : "disponible";
      const { error: itemError } = await supabase
        .from("items")
        .update({ status: newStatus })
        .eq("id", selectedLoan.itemId);
      if (itemError) throw itemError;

      Alert.alert(
        "Retour validé",
        newStatus === "disponible"
          ? `"${selectedLoan.modelNom}" est de nouveau disponible dans l'inventaire.`
          : `"${selectedLoan.modelNom}" est marqué comme endommagé.`
      );

      setShowReturnModal(false);
      setSelectedLoan(null);
      setSearchQuery("");
      await checkAndUpdateOverdue();
    } catch (err) {
      console.error(err);
      Alert.alert("Erreur", "Impossible de valider le retour");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Vue caméra QR ----
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleQRScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        {/* Cadre visuel */}
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Pointez vers le QR code de l'appareil</Text>
        </View>
        <TouchableOpacity style={styles.scanCancel} onPress={() => setScanning(false)}>
          <Text style={styles.scanCancelText}>✕ Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingUser || loading) return <ActivityIndicator size="large" style={{ marginTop: 80 }} />;

  const today = new Date().toISOString().split("T")[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Retours Matériel</Text>
      <Text style={styles.subtitle}>{overdueItems.length} retour(s) en attente</Text>

      {/* Barre recherche + QR */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Numéro de série..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => searchBySerial(searchQuery)}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => searchBySerial(searchQuery)}
          disabled={searching}
        >
          <Text style={styles.searchBtnText}>{searching ? "⏳" : "🔍"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.qrBtn}
          onPress={async () => {
            if (!permission?.granted) {
              const res = await requestPermission();
              if (!res.granted) {
                Alert.alert("Permission refusée", "La caméra est nécessaire pour scanner les QR codes.");
                return;
              }
            }
            setScanning(true);
          }}
        >
          <Text style={styles.qrBtnText}>📷</Text>
        </TouchableOpacity>
      </View>

      {/* Liste des retards */}
      {overdueItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>Aucun retour en attente</Text>
          <Text style={styles.emptySubtitle}>Tous les appareils sont dans les délais</Text>
        </View>
      ) : (
        overdueItems.map((loan) => {
          const daysLate = Math.floor(
            (new Date(today).getTime() - new Date(loan.return_date).getTime()) / 86400000
          );
          return (
            <View key={loan.locationId} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{loan.modelNom}</Text>
                <View style={styles.lateBadge}>
                  <Text style={styles.lateBadgeText}>+{daysLate}j</Text>
                </View>
              </View>
              <Text style={styles.cardSerial}>N° {loan.serial_number}</Text>
              <Text style={styles.cardInfo}>👤 {loan.borrowerNom}</Text>
              <Text style={styles.cardInfo}>✉️ {loan.borrowerEmail}</Text>
              <Text style={styles.cardInfo}>📅 Retour prévu le {loan.return_date}</Text>
              <TouchableOpacity style={styles.returnBtn} onPress={() => openReturnModal(loan)}>
                <Text style={styles.returnBtnText}>✅ Valider le retour</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Modal de validation de retour */}
      <Modal visible={showReturnModal} transparent animationType="slide" onRequestClose={() => setShowReturnModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Valider le retour</Text>
              <TouchableOpacity onPress={() => setShowReturnModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedLoan && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>{selectedLoan.modelNom}</Text>
                  <Text style={styles.summarySub}>N° {selectedLoan.serial_number}</Text>
                  <Text style={styles.summarySub}>Emprunté par : {selectedLoan.borrowerNom}</Text>
                  <Text style={styles.summarySub}>Prêteur : {selectedLoan.lenderNom}</Text>
                  <Text style={styles.summarySub}>Retour prévu : {selectedLoan.return_date}</Text>
                </View>

                <Text style={styles.fieldLabel}>État de retour *</Text>
                <TouchableOpacity style={styles.picker} onPress={() => setShowStatePicker(true)}>
                  <Text style={styles.pickerText}>
                    {RETURN_STATES.find(s => s.value === returnState)?.label || returnState}
                  </Text>
                  <Text>▼</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
                  onPress={validateReturn}
                  disabled={submitting}
                >
                  <Text style={styles.confirmBtnText}>
                    {submitting ? "Validation en cours..." : "✅ Confirmer le retour"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal choix état */}
      <Modal visible={showStatePicker} transparent animationType="slide" onRequestClose={() => setShowStatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 280 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>État de retour</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            {RETURN_STATES.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.modalOption, returnState === s.value && styles.modalOptionSelected]}
                onPress={() => { setReturnState(s.value); setShowStatePicker(false); }}
              >
                <Text style={styles.modalOptionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  searchRow: { flexDirection: "row", marginBottom: 20, gap: 8 },
  searchInput: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, fontSize: 15, color: "#1e293b" },
  searchBtn: { backgroundColor: "#2563eb", borderRadius: 8, width: 46, alignItems: "center", justifyContent: "center" },
  searchBtnText: { fontSize: 18 },
  qrBtn: { backgroundColor: "#0f172a", borderRadius: 8, width: 46, alignItems: "center", justifyContent: "center" },
  qrBtnText: { fontSize: 20 },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: "#64748b" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", flex: 1 },
  cardSerial: { fontSize: 13, color: "#64748b", fontFamily: "monospace", marginBottom: 4 },
  cardInfo: { fontSize: 13, color: "#475569", marginBottom: 2 },
  lateBadge: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  lateBadgeText: { color: "#92400e", fontSize: 12, fontWeight: "700" },
  returnBtn: { backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 12 },
  returnBtnText: { color: "#166534", fontWeight: "700", fontSize: 14 },
  // Caméra
  scanOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  scanFrame: { width: 230, height: 230, borderWidth: 3, borderColor: "#fff", borderRadius: 14, backgroundColor: "transparent" },
  scanHint: { color: "#fff", marginTop: 24, fontSize: 14, textAlign: "center", backgroundColor: "rgba(0,0,0,0.55)", padding: 10, borderRadius: 8, overflow: "hidden" },
  scanCancel: { position: "absolute", top: 56, right: 20, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  scanCancelText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  modalClose: { fontSize: 22, color: "#64748b", padding: 4 },
  modalBody: { padding: 16 },
  summaryBox: { backgroundColor: "#f0f9ff", borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#bae6fd" },
  summaryTitle: { fontSize: 16, fontWeight: "700", color: "#0c4a6e", marginBottom: 6 },
  summarySub: { fontSize: 13, color: "#334155", marginBottom: 3 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 13, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { fontSize: 15, color: "#1e293b" },
  confirmBtn: { backgroundColor: "#059669", borderRadius: 10, padding: 15, alignItems: "center", marginBottom: 24 },
  confirmBtnDisabled: { backgroundColor: "#6ee7b7" },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalOptionSelected: { backgroundColor: "#eff6ff" },
  modalOptionText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
});