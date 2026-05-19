import React, { useState, useEffect } from "react";
import { 
  View, Text, TextInput, FlatList, TouchableOpacity, 
  ActivityIndicator, StyleSheet, StatusBar, Alert, ScrollView 
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../supabaseConfig"; // Ajuste le chemin selon ton projet

// Types TypeScript pour sécuriser ton code
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
  
  // États de données
  const [items, setItems] = useState<Item[]>([]);
  const [Categories, setCategory] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour les filtres et la recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  useEffect(() => {
    chargerDonnees();
  }, []);

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

      const { data: CategoryData, error: catError } = await supabase
        .from("Category")
        .select("*");

      if (itemsError || catError) {
        console.error("Erreur Supabase:", itemsError || catError);
        Alert.alert("Erreur", "Impossible de récupérer les données");
        return;
      }

      const itemsFormates: Item[] = (itemsData || []).map((item: any) => {
        return {
          ...item,
          model_materiel: Array.isArray(item.model_materiel) && item.model_materiel.length > 0 
            ? item.model_materiel[0] 
            : item.model_materiel || null
        };
      });

      setItems(itemsFormates);
      setCategory(CategoryData || []);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const itemsFiltrés = items.filter((item) => {
    const correspondNom = item.model_materiel?.nom?.toLowerCase().includes(searchQuery.toLowerCase());
    const correspondCategorie = selectedCategoryId === null || item.model_materiel?.id_category === selectedCategoryId;
    return correspondNom && correspondCategorie;
  });

  const renderMateriel = ({ item }: { item: Item }) => {
    const statusLower = item.status?.toLowerCase();
    
    // Configuration visuelle du badge selon l'état
    let badgeStyle = styles.unavailableBadge;
    let statusTexte = item.status;

    if (statusLower === "disponible") {
      badgeStyle = styles.availableBadge;
      statusTexte = "Disponible";
    } else if (statusLower === "maintenance") {
      badgeStyle = styles.maintenanceBadge;
      statusTexte = "En Maintenance";
    } else if (statusLower === "endommagé" || statusLower === "endommage") {
      badgeStyle = styles.damagedBadge;
      statusTexte = "Endommagé";
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.model_materiel?.nom || "Modèle inconnu"}</Text>
          <View style={[styles.statusIndicator, badgeStyle]}>
            <Text style={styles.statusText}>{statusTexte}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Numéro de série</Text>
          <Text style={styles.serialNumberText}>{item.serial_number}</Text>
        </View>

        {/* Bouton conditionnel : Uniquement si disponible */}
        {statusLower === "disponible" && (
          <TouchableOpacity
            style={styles.rentButton}
            onPress={() => {
              // Redirige vers la page de location en passant l'ID de cet appareil précis !
              router.push({ pathname: "/location", params: { itemId: item.id } });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.rentButtonText}>🔑 Louer ce matériel</Text>
          </TouchableOpacity>
        )}
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

      {/* En-tête de la page */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventaire du Laboratoire</Text>
        <Text style={styles.subtitle}>{itemsFiltrés.length} appareils trouvés</Text>
      </View>

      {/* 🔍 BARRE DE RECHERCHE PAR NOM */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Rechercher un appareil par nom..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* 🏷️ FILTRE HORIZONTAL PAR CATÉGORIE */}
      <View style={styles.CategoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.CategoryScroll}>
          <TouchableOpacity
            style={[styles.categoryTab, selectedCategoryId === null && styles.activeCategoryTab]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text style={[styles.categoryTabText, selectedCategoryId === null && styles.activeCategoryTabText]}>
              Tous
            </Text>
          </TouchableOpacity>

          {Categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTab, selectedCategoryId === cat.id && styles.activeCategoryTab]}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text style={[styles.categoryTabText, selectedCategoryId === cat.id && styles.activeCategoryTabText]}>
                {cat.nom}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTE DES APPAREILS FILTRÉS */}
      <FlatList
        data={itemsFiltrés}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMateriel}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun matériel ne correspond à vos critères</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, backgroundColor: "#ffffff", borderBottomWidth: 1, borderColor: "#e2e8f0" },
  title: { fontSize: 22, fontWeight: "bold", color: "#1e293b" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  
  // Styles Recherche & Catégories
  searchContainer: { paddingHorizontal: 16, marginTop: 12 },
  searchInput: { backgroundColor: "#ffffff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", fontSize: 15, color: "#334155" },
  CategoryContainer: { marginTop: 10, marginBottom: 5 },
  CategoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#e2e8f0" },
  activeCategoryTab: { backgroundColor: "#2563eb" },
  categoryTabText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  activeCategoryTabText: { color: "#ffffff" },

  // Liste et Cartes
  listContainer: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: "#ffffff", borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", flex: 1, marginRight: 10 },
  
  // Badges de Statut
  statusIndicator: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "700" },
  availableBadge: { backgroundColor: "#dcfce7" }, // Vert
  maintenanceBadge: { backgroundColor: "#fef3c7" }, // Jaune
  damagedBadge: { backgroundColor: "#fee2e2" }, // Rouge
  unavailableBadge: { backgroundColor: "#f1f5f9" }, // Gris par défaut (Ex: loué)

  infoSection: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12 },
  infoLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: "600" },
  serialNumberText: { fontSize: 14, fontWeight: "bold", color: "#334155", marginTop: 2, fontFamily: "monospace" },
  
  // Bouton Louer
  rentButton: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 4 },
  rentButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#64748b", fontSize: 15 }
});