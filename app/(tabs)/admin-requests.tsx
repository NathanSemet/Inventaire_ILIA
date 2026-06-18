import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/supabaseConfig";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type PendingRequest = {
  id: number;
  location_date: string;
  return_date: string;
  item?: {
    id: number;
    serial_number: string;
    model_materiel?: { nom: string } | null;
  } | null;
  borrower?: { nom: string; email: string } | null;
  lender?: { nom: string; email: string } | null;
};

export default function AdminRequestsScreen() {
  const { currentUser, loadingUser } = useCurrentUser();
  const router = useRouter();

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!loadingUser && !currentUser?.member_ILIA) {
        Alert.alert("Accès refusé", "Cette page est réservée aux membres ILIA.");
        router.replace("/");
        return;
      }
      fetchPendingRequests();
    }, [loadingUser, currentUser])
  );

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("Location")
        .select(`
          id, location_date, return_date,
          item:items ( id, serial_number, model_materiel ( nom ) ),
          borrower:users!Location_id_borrower_fkey ( nom, email ),
          lender:users!Location_id_lender_fkey ( nom, email )
        `)
        .eq("statut", "en_attente")
        .order("id", { ascending: true });

      if (error) throw error;

      const formatted: PendingRequest[] = (data || []).map((r: any) => ({
        ...r,
        item: Array.isArray(r.item) ? r.item[0] : r.item,
        borrower: Array.isArray(r.borrower) ? r.borrower[0] : r.borrower,
        lender: Array.isArray(r.lender) ? r.lender[0] : r.lender,
      }));

      setRequests(formatted);
    } catch (err) {
      console.error("fetchPendingRequests:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateRequest = async (req: PendingRequest) => {
    if (!req.item) return;
    setProcessingId(req.id);
    try {
      // 1. Valider la location
      const { data: locData, error: locError } = await supabase
        .from("Location")
        .update({ statut: "active" })
        .eq("id", req.id)
        .select()
        .maybeSingle();

      if (locError) throw locError;
      if (!locData) throw new Error("Impossible de mettre à jour la demande (RLS ?)");

      // 2. Passer l'item en 'loué'
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .update({ status: "loué" })
        .eq("id", req.item.id)
        .select()
        .maybeSingle();

      if (itemError) throw itemError;
      if (!itemData) throw new Error("Impossible de mettre à jour le statut de l'item (RLS ?)");

      Alert.alert(
        "✅ Demande validée",
        `La location de "${req.item.model_materiel?.nom || req.item.serial_number}" pour ${req.borrower?.nom || "l'emprunteur"} est maintenant active.`
      );
      await fetchPendingRequests();
    } catch (err: any) {
      console.error("validateRequest:", err);
      Alert.alert("Erreur", err?.message || "Impossible de valider la demande");
    } finally {
      setProcessingId(null);
    }
  };

  const refuseRequest = async (req: PendingRequest) => {
    if (!req.item) return;

    Alert.alert(
      "Refuser la demande ?",
      `Refuser la demande de ${req.borrower?.nom || "l'emprunteur"} pour "${req.item.model_materiel?.nom || req.item.serial_number}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Refuser",
          style: "destructive",
          onPress: async () => {
            setProcessingId(req.id);
            try {
              // 1. Marquer la demande comme refusée
              const { data: locData, error: locError } = await supabase
                .from("Location")
                .update({ statut: "refusée" })
                .eq("id", req.id)
                .select()
                .maybeSingle();

              if (locError) throw locError;
              if (!locData) throw new Error("Impossible de refuser la demande (RLS ?)");

              // 2. Remettre l'item en 'disponible'
              const { data: itemData, error: itemError } = await supabase
                .from("items")
                .update({ status: "disponible" })
                .eq("id", req.item!.id)
                .select()
                .maybeSingle();

              if (itemError) throw itemError;
              if (!itemData) throw new Error("Impossible de restaurer le statut de l'item (RLS ?)");

              await fetchPendingRequests();
            } catch (err: any) {
              console.error("refuseRequest:", err);
              Alert.alert("Erreur", err?.message || "Impossible de refuser la demande");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  if (loadingUser || loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 80 }} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Demandes de location</Text>
      <Text style={styles.subtitle}>{requests.length} demande(s) en attente de validation</Text>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>Aucune demande en attente</Text>
          <Text style={styles.emptySubtitle}>Toutes les demandes ont été traitées</Text>
        </View>
      ) : (
        requests.map((req) => {
          const isProcessing = processingId === req.id;
          return (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>
                  {req.item?.model_materiel?.nom || "Modèle inconnu"}
                </Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>⏳ En attente</Text>
                </View>
              </View>

              <Text style={styles.cardSerial}>N° {req.item?.serial_number || "—"}</Text>

              <View style={styles.infoBlock}>
                <Text style={styles.infoRow}>👤 Emprunteur : {req.borrower?.nom || "—"}</Text>
                <Text style={styles.infoRow}>✉️ {req.borrower?.email || "—"}</Text>
                <Text style={styles.infoRow}>🔑 Prêteur désigné : {req.lender?.nom || "—"}</Text>
                <Text style={styles.infoRow}>📅 Date de prêt : {req.location_date}</Text>
                <Text style={styles.infoRow}>🔄 Retour prévu : {req.return_date}</Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.validateBtn, isProcessing && styles.btnDisabled]}
                  onPress={() => validateRequest(req)}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? <ActivityIndicator color="#166534" size="small" />
                    : <Text style={styles.validateBtnText}>✅ Valider</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.refuseBtn, isProcessing && styles.btnDisabled]}
                  onPress={() => refuseRequest(req)}
                  disabled={isProcessing}
                >
                  <Text style={styles.refuseBtnText}>❌ Refuser</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: "#64748b" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", flex: 1 },
  cardSerial: { fontSize: 13, color: "#64748b", fontFamily: "monospace", marginBottom: 10 },
  pendingBadge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  pendingBadgeText: { color: "#92400e", fontSize: 11, fontWeight: "700" },
  infoBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 2,
  },
  infoRow: { fontSize: 13, color: "#475569", marginBottom: 2 },
  actionRow: { flexDirection: "row", gap: 8 },
  validateBtn: {
    flex: 1,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  validateBtnText: { color: "#166534", fontWeight: "700", fontSize: 14 },
  refuseBtn: {
    flex: 1,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  refuseBtnText: { color: "#dc2626", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});