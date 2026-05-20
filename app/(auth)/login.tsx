import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { supabase } from "@/supabaseConfig";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // 👈 Nouveau champ de sécurité
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");

  const handleLogin = async () => {
    console.log("=== Tentative de connexion ===");
    if (!email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      console.log("Retour Supabase Connexion:", { data, error });

      if (error) {
        Alert.alert("Erreur de connexion", error.message);
      }
    } catch (err) {
      console.error("Erreur critique lors de la connexion:", err);
      Alert.alert("Erreur technique", "Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log("=== Tentative d'inscription ===");
    console.log("Données saisies :", { email: email.trim(), username: username.trim() });

    if (!email.trim() || !password.trim() || !username.trim() || !confirmPassword.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: username.trim() },
        },
      });

      console.log("Retour Supabase Inscription:", { data, error });

      if (error) {
        console.log("Supabase a renvoyé une erreur d'inscription:", error.message);
        Alert.alert("Erreur d'inscription", error.message);
      } else {
        console.log("Inscription réussie dans l'Auth !");
        Alert.alert(
          "Compte créé",
          "Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter."
        );
        setIsSignUp(false);
      }
    } catch (err) {
      console.error("Crash critique lors de l'inscription:", err);
      Alert.alert("Erreur réseau", "La requête a échoué avant d'atteindre Supabase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Gestion du matériel</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? "Créer un compte" : "Connexion"}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom d'utilisateur</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Jean Dupont"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: votre@email.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            {/* 🛠️ Le label s'adapte à l'action en cours */}
            <Text style={styles.label}>
              {isSignUp ? "Créer un mot de passe" : "Mot de passe"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </View>

          {/* 🛠️ APPARITION DU DEUXIÈME CHAMP UNIQUEMENT POUR L'INSCRIPTION */}
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? "Créer le compte" : "Se connecter"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setEmail("");
              setPassword("");
              setConfirmPassword(""); 
              setUsername("");
            }}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? "Déjà un compte ? Se connecter"
                : "Pas encore de compte ? S'inscrire"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
  },
  form: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchText: {
    color: "#2563eb",
    fontSize: 14,
  },
});