import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { supabase } from "../../supabaseConfig";

type ScanState = "scanning" | "loading" | "error";

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Réinitialise le scanner après une erreur
  const resetScanner = () => {
    setIsProcessing(false);
    setErrorMessage("");
    setScanState("scanning");
  };

  // Extrait le materielId depuis l'URL du QR code
  const parseMaterielId = (rawValue: string): string | null => {
    try {
      const url = new URL(rawValue);
      const id = url.searchParams.get("materielId");
      return id ? id.trim() : null;
    } catch {
      return null;
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    // Évite les scans multiples pendant le traitement
    if (isProcessing) return;
    setIsProcessing(true);
    setScanState("loading");

    // Vérifie que c'est bien un QR code de l'application
    if (!data.startsWith("myapp://location")) {
      setErrorMessage("Ce QR code ne correspond pas à un matériel de l'application.");
      setScanState("error");
      return;
    }

    const materielId = parseMaterielId(data);
    if (!materielId) {
      setErrorMessage("QR code invalide — identifiant du matériel introuvable.");
      setScanState("error");
      return;
    }

    // Récupère les infos de l'item en base
    try {
      const { data: item, error } = await supabase
        .from("items")
        .select(`
          id,
          status,
          serial_number,
          model_materiel!id_model ( nom )
        `)
        .eq("id", materielId)
        .single() as any;

      if (error || !item) {
        setErrorMessage("Ce matériel n'existe pas ou a été supprimé.");
        setScanState("error");
        return;
      }

      const status = item.status?.toLowerCase();
      const nomMateriel = Array.isArray(item.model_materiel)
        ? item.model_materiel[0]?.nom
        : item.model_materiel?.nom;

      // Selon le statut, on navigue ou on affiche un message
      if (status === "disponible") {
        router.push({
          pathname: "/location",
          params: { itemId: item.id },
        });
        // Réinitialise pour le prochain scan si l'utilisateur revient
        setTimeout(() => resetScanner(), 1000);
      } else {
        let message = `"${nomMateriel || "Ce matériel"}" n'est pas disponible à la location.`;

        if (status === "maintenance") {
          message += "\n\nRaison : en cours de maintenance.";
        } else if (status === "endommagé" || status === "endommage") {
          message += "\n\nRaison : matériel endommagé.";
        } else {
          message += `\n\nStatut actuel : ${item.status}.`;
        }

        setErrorMessage(message);
        setScanState("error");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Une erreur est survenue lors de la vérification du matériel.");
      setScanState("error");
    }
  };

  // Pas encore de réponse sur les permissions
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Permission refusée
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
        <Text style={styles.permissionText}>
          L'application a besoin d'accéder à votre caméra pour scanner les QR codes.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Caméra toujours active en arrière-plan */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanState === "scanning" ? handleBarCodeScanned : undefined}
      />

      {/* Overlay avec le viseur */}
      <View style={styles.overlay}>
        <Text style={styles.instructionText}>
          Pointez vers le QR code du matériel
        </Text>

        {/* Viseur */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        {/* Zone de statut sous le viseur */}
        <View style={styles.statusBox}>
          {scanState === "scanning" && (
            <Text style={styles.statusText}>🔍 Prêt à scanner</Text>
          )}

          {scanState === "loading" && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.statusText}>  Vérification en cours...</Text>
            </View>
          )}

          {scanState === "error" && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>⚠️ Matériel indisponible</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={resetScanner}>
                <Text style={styles.retryButtonText}>Scanner un autre QR</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = "#ffffff";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  instructionText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 32,
    textAlign: "center",
    paddingHorizontal: 32,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Viseur avec 4 coins
  viewfinder: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  // Zone de statut
  statusBox: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorBox: {
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    maxWidth: 300,
  },
  errorTitle: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#f1f5f9",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  // Permissions
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});