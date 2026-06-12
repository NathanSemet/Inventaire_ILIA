import { Stack, useRouter, Href } from "expo-router";
import { Platform, TouchableOpacity, Text, View, Modal, StyleSheet } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/supabaseConfig";

export default function StackLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const { currentUser } = useCurrentUser();

  const theme = colorScheme === "dark" ? "dark" : "light";
  const themeColors = Colors[theme];
  const isILIA = currentUser?.member_ILIA === true;

  const navigateTo = (route: Href) => {
    setMenuVisible(false);
    router.push(route);
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    await supabase.auth.signOut();
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: themeColors.background },
          headerTitleStyle: { fontWeight: "bold", fontSize: 22, color: themeColors.text },
          headerTintColor: themeColors.tint,
          animation: Platform.OS === "ios" ? "default" : "fade_from_bottom",
          headerRight: () => (
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.burgerButton} activeOpacity={0.6}>
              <Text style={[styles.burgerIcon, { color: themeColors.text }]}>☰</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: "Inventaire" }} />
        <Stack.Screen name="location" options={{ title: "Gestion des locations" }} />
        <Stack.Screen name="admin-inventory" options={{ title: "Gestion Inventaire" }} />
        <Stack.Screen name="admin-returns" options={{ title: "Retours Matériel" }} />
        <Stack.Screen name="profile" options={{ title: "Mon Profil" }} />
      </Stack>

      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuCard, { backgroundColor: themeColors.background }]}>

            {/* Infos utilisateur */}
            {currentUser && (
              <>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: themeColors.text }]} numberOfLines={1}>
                    {currentUser.nom}
                  </Text>
                  {isILIA && <Text style={styles.iliaBadge}>⭐ Membre ILIA</Text>}
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Navigation commune */}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/")}>
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Inventaire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/location")}>
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Locations</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/profile")}>
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Mon Profil</Text>
            </TouchableOpacity>

            {/* Navigation ILIA uniquement */}
            {isILIA && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>Administration ILIA</Text>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/admin-inventory")}>
                  <Text style={[styles.menuItemText, { color: themeColors.text }]}>Gérer l'inventaire</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/admin-returns")}>
                  <Text style={[styles.menuItemText, { color: themeColors.text }]}>Retours matériel</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>🚪 Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  burgerButton: { paddingHorizontal: 12, paddingVertical: 6 },
  burgerIcon: { fontSize: 26, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.05)" },
  menuCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 60,
    right: 16,
    width: 220,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "rgba(156, 163, 175, 0.2)",
  },
  userInfo: { paddingVertical: 10, paddingHorizontal: 16 },
  userName: { fontSize: 14, fontWeight: "700" },
  iliaBadge: { fontSize: 11, color: "#d97706", marginTop: 2, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "rgba(156,163,175,0.2)", marginHorizontal: 8, marginVertical: 4 },
  sectionLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2, letterSpacing: 0.5 },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  menuItemText: { fontSize: 15, fontWeight: "500" },
});