declare module "react-native-qrcode-svg";

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../supabaseConfig";
import QRCode from "react-native-qrcode-svg";

interface Category {
  id: number;
  nom: string;
}

interface Item {
  id: number;
  serial_number: string;
  status: string;
  id_model: number;
  model_materiel?: {
    nom: string;
    description: string;
    id_category: number;
  } | null;
}

export default function InventoryScreen() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMateriel, setSelectedMateriel] = useState<Item | null>(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  useEffect(() => {
    chargerDonnees();
  }, []);

  useEffect(() => {
    if (selectedMateriel) {
      fetchAvailableStock(selectedMateriel.id_model);
    }
  }, [selectedMateriel]);

  const fetchAvailableStock = async (modelId: number) => {
    setIsLoadingStock(true);
    try {
      const { count, error } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("id_model", modelId)
        .eq("status", "disponible");

      if (error) throw error;
      setAvailableCount(count || 0);
    } catch (error: any) {
      console.error("Erreur lors du calcul du stock :", error.message);
      setAvailableCount(0);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select(`
          id,
          serial_number,
          status,
          id_model,
          model_materiel ( nom, description, id_category )
        `);

      const { data: categoryData, error: catError } = await supabase
        .from("Category")
        .select("*");

      if (itemsError || catError) {
        Alert.alert("Erreur", "Impossible de récupérer les données");
        return;
      }

      const itemsFormates: Item[] = (itemsData || []).map((item: any) => ({
        ...item,
        model_materiel:
          Array.isArray(item.model_materiel) && item.model_materiel.length > 0
            ? item.model_materiel[0]
            : item.model_materiel || null,
      }));

      setItems(itemsFormates);
      setCategories(categoryData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const itemsFiltres = items.filter((item) => {
    const correspondNom = item.model_materiel?.nom
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const correspondCategorie =
      selectedCategoryId === null ||
      item.model_materiel?.id_category === selectedCategoryId;
    return correspondNom && correspondCategorie;
  });

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "disponible":
        return { badge: styles.availableBadge, label: "Disponible" };
      case "maintenance":
        return { badge: styles.maintenanceBadge, label: "En Maintenance" };
      case "endommagé":
      case "endommage":
        return { badge: styles.damagedBadge, label: "Endommagé" };
      default:
        return { badge: styles.unavailableBadge, label: status };
    }
  };

  const renderMateriel = ({ item }: { item: Item }) => {
    const { badge, label } = getStatusStyle(item.status);
    const estDisponible = item.status?.toLowerCase() === "disponible";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {item.model_materiel?.nom || "Modèle inconnu"}
          </Text>
          <View style={[styles.statusIndicator, badge]}>
            <Text style={styles.statusText}>{label}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Numéro de série</Text>
          <Text style={styles.serialNumberText}>{item.serial_number}</Text>
        </View>

        {estDisponible && (
          <TouchableOpacity
            style={styles.rentButton}
            onPress={() =>
              router.push({ pathname: "/location", params: { itemId: item.id } })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.rentButtonText}>🔑 Louer ce matériel</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => {
            setSelectedMateriel(item);
            setShowQRModal(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.qrButtonText}>📷 Voir QR Code</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <Text style={styles.title}>Inventaire du Laboratoire</Text>
        <Text style={styles.subtitle}>{itemsFiltres.length} appareils trouvés</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Rechercher un appareil par nom..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoryTab,
              selectedCategoryId === null && styles.activeCategoryTab,
            ]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategoryId === null && styles.activeCategoryTabText,
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryTab,
                selectedCategoryId === cat.id && styles.activeCategoryTab,
              ]}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategoryId === cat.id && styles.activeCategoryTabText,
                ]}
              >
                {cat.nom}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={itemsFiltres}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMateriel}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Aucun matériel ne correspond à vos critères
            </Text>
          </View>
        }
      />

      {/* Modal QR Code — un seul, placé à la racine */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedMateriel?.model_materiel?.nom || "Matériel"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Scannez ce QR code pour lancer une location
            </Text>

            {selectedMateriel && (
              <View style={styles.qrContainer}>
                <QRCode
                  value={`myapp://location?materielId=${selectedMateriel.id}`}
                  size={200}
                />
              </View>
            )}

            <Text style={styles.modalStock}>
              {isLoadingStock
                ? "Calcul du stock..."
                : `Stock disponible : ${availableCount} unité(s)`}
            </Text>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e293b" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  searchContainer: { paddingHorizontal: 16, marginTop: 12 },
  searchInput: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    fontSize: 15,
    color: "#334155",
  },
  categoryContainer: { marginTop: 10, marginBottom: 5 },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  activeCategoryTab: { backgroundColor: "#2563eb" },
  categoryTabText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  activeCategoryTabText: { color: "#ffffff" },
  listContainer: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
    marginRight: 10,
  },
  statusIndicator: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "700" },
  availableBadge: { backgroundColor: "#dcfce7" },
  maintenanceBadge: { backgroundColor: "#fef3c7" },
  damagedBadge: { backgroundColor: "#fee2e2" },
  unavailableBadge: { backgroundColor: "#f1f5f9" },
  infoSection: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  serialNumberText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 2,
    fontFamily: "monospace",
  },
  rentButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  rentButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  qrButton: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#eff6ff",
    alignItems: "center",
  },
  qrButtonText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#64748b", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    width: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 24,
    textAlign: "center",
  },
  qrContainer: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 16,
  },
  modalStock: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 20,
    fontWeight: "500",
  },
  closeButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  closeButtonText: { color: "#ffffff", fontWeight: "500", fontSize: 16 },
});