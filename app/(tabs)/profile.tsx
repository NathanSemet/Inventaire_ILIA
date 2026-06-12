import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal, // 👈 Ajout du Modal de React Native
} from "react-native";
import { supabase } from "@/supabaseConfig";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");
  const [userId, setUserId] = useState<string>(""); 

  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentEmail(user.email ?? "");
      setCurrentUsername(user.user_metadata?.username ?? "");
      setNewUsername(user.user_metadata?.username ?? "");
      setUserId(user.id); 
    }
  };

  const [loadingUsername, setLoadingUsername] = useState(false);
  const [loadingEmail, setLoadingEmail]       = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert("Erreur", "Le nom d'utilisateur ne peut pas être vide");
      return;
    }
    setLoadingUsername(true);
    try {
      // 1. Met à jour les métadonnées auth
      const { error: authError } = await supabase.auth.updateUser({
        data: { username: newUsername.trim() },
      });
      if (authError) throw authError;

      // 2. Synchronise public.users.nom ← FIX CRITIQUE
      const { error: dbError } = await supabase
        .from("users")
        .update({ nom: newUsername.trim() })
        .eq("id", userId);
      if (dbError) throw dbError;

      setCurrentUsername(newUsername.trim());
      Alert.alert("✅ Succès", "Nom d'utilisateur mis à jour");
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de mettre à jour le nom");
    } finally {
      setLoadingUsername(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert("Erreur", "L'email ne peut pas être vide");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      Alert.alert("Erreur", "L'email n'est pas valide");
      return;
    }
    setLoadingEmail(true);
    try {
      const { error: dbError } = await supabase
        .from("users")
        .update({ email: newEmail.trim() })
        .eq("id", userId);
      if (dbError) throw dbError;

      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (authError) {
        await supabase
          .from("users")
          .update({ email: currentEmail })
          .eq("id", userId);
        throw authError;
      }

      setCurrentEmail(newEmail.trim());
      setNewEmail("");
      Alert.alert(
        " Confirmation requise",
        "Un lien de confirmation a été envoyé à votre NOUVELLE adresse email.\n\n" +
        "Si la sécurité renforcée est activée sur votre compte, vous recevrez " +
        "aussi un email sur votre ANCIENNE adresse. Les deux doivent être confirmés."
      );
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de mettre à jour l'email");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Erreur", "Veuillez remplir les deux champs");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }
    setLoadingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert("Succès", "Mot de passe mis à jour");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de mettre à jour le mot de passe");
    } finally {
      setLoadingPassword(false);
    }
  };

  // 👈 1. Ouvre le modal personnalisé au clic sur le bouton rouge
  const handleOpenLogoutModal = () => {
    setIsLogoutModalVisible(true);
  };

  // 👈 2. Exécute la déconnexion si l'utilisateur valide dans le modal
  const confirmLogout = async () => {
    setIsLogoutModalVisible(false); // Ferme le modal d'abord
    try {
      await supabase.auth.signOut();
      router.replace("/login"); // Redirection forcée
    } catch (error) {
      console.error("Erreur déconnexion:", error);
      Alert.alert("Erreur", "Impossible de vous déconnecter");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <ScrollView style={styles.container}>
        {/* Infos actuelles */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Compte actuel</Text>
          <Text style={styles.infoValue}>👤 {currentUsername || "Sans nom"}</Text>
          <Text style={styles.infoValue}>✉️ {currentEmail}</Text>
        </View>

        {/* Changer le nom d'utilisateur */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nom d'utilisateur</Text>
          <TextInput
            style={styles.input}
            placeholder="Nouveau nom d'utilisateur"
            placeholderTextColor="#9ca3af"
            value={newUsername}
            onChangeText={setNewUsername}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, loadingUsername && styles.buttonDisabled]}
            onPress={handleUpdateUsername}
            disabled={loadingUsername}
          >
            {loadingUsername ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mettre à jour le nom</Text>}
          </TouchableOpacity>
        </View>

        {/* Changer l'email */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse email</Text>
          <TextInput
            style={styles.input}
            placeholder="Nouvel email"
            placeholderTextColor="#9ca3af"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, loadingEmail && styles.buttonDisabled]}
            onPress={handleUpdateEmail}
            disabled={loadingEmail}
          >
            {loadingEmail ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mettre à jour l'email</Text>}
          </TouchableOpacity>
        </View>

        {/* Changer le mot de passe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Nouveau mot de passe"
            placeholderTextColor="#9ca3af"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Confirmer le mot de passe"
            placeholderTextColor="#9ca3af"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, loadingPassword && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={loadingPassword}
          >
            {loadingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mettre à jour le mot de passe</Text>}
          </TouchableOpacity>
        </View>

        {/* Bouton Déconnexion */}
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={handleOpenLogoutModal} // 👈 Appelle l'ouverture du Modal
        >
          <Text style={styles.buttonText}>Se déconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 👈 MODAL DE CONFIRMATION DE DECONNEXION */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Déconnexion</Text>
            <Text style={styles.modalMessage}>Voulez-vous vraiment vous déconnecter ?</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmLogout}
              >
                <Text style={styles.modalButtonConfirmText}>Déconnecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 15,
    color: "#1e3a8a",
    marginBottom: 4,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonPrimary: {
    backgroundColor: "#2563eb",
  },
  buttonDanger: {
    backgroundColor: "#dc2626",
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  // 👈 NOUVEAUX STYLES POUR LE MODAL CUSTOM
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalButtonCancelText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
  modalButtonConfirm: {
    backgroundColor: "#dc2626",
  },
  modalButtonConfirmText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});