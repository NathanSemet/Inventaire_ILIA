import { Stack, useRouter, Href } from "expo-router"; 
import { Platform, TouchableOpacity, Text, View, Modal, StyleSheet } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

export default function StackLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  const theme = colorScheme === "dark" ? "dark" : "light";
  const themeColors = Colors[theme];

  const navigateTo = (routeName: Href) => {
    setMenuVisible(false);
    router.push(routeName);
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: themeColors.background,
          },
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 22,
            color: themeColors.text,
          },
          headerTintColor: themeColors.tint,
          animation: Platform.OS === "ios" ? "default" : "fade_from_bottom",
          
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setMenuVisible(true)} 
              style={styles.burgerButton}
              activeOpacity={0.6}
            >
              <Text style={[styles.burgerIcon, { color: themeColors.text }]}>☰</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: "Inventaire" }} />
        <Stack.Screen
          name="location"
          options={{ title: "Gestion des locations" }}
        />
      </Stack>

      {/* ---- MENU DÉROULANT SUBTIL ---- */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuCard, { backgroundColor: themeColors.background }]}>
            
            {/* Si ton index est dans (tabs), utilise "/(tabs)" ou "/" selon ton architecture */}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/")}>
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Inventaire</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/location")}>
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Locations</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo("/profile")}>
              <Text style={[styles.menuItemText, { color: themeColors.text }]}>Profil</Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ---- STYLES STABLES ----
const styles = StyleSheet.create({
  burgerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  burgerIcon: {
    fontSize: 26,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  menuCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 60,
    right: 16,
    width: 180,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "rgba(156, 163, 175, 0.2)",
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
});