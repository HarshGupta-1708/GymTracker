import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ThemePickerModal from "../components/ThemePickerModal";
import { useTheme } from "../context/ThemeContext";
import { getThemeById } from "../constants/themes";
import { getDefaultProfileId } from "../utils/athletes";
import { getActiveProfileId } from "../utils/profileScope";
import { ProfilesSection, SecuritySection } from "./SecurityAthletesPanel";

/**
 * Settings hub: theme, backup, security, profiles, sign out.
 */
export default function SettingsModal({
  visible,
  onClose,
  user,
  themeId,
  currentTheme,
  onThemeSelect,
  onExport,
  onImport,
  backupBusy,
  onProfileSwitched,
  onSignOut,
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [isOnPrimary, setIsOnPrimary] = useState(true);
  const theme = currentTheme || getThemeById(themeId || "midnightIron");
  const isGoogleLogin = Boolean(user?.email && !user?.isAnonymous);

  const refreshPrimaryState = useCallback(async () => {
    const active = getActiveProfileId();
    const primary = await getDefaultProfileId();
    setIsOnPrimary(active === primary);
  }, []);

  useEffect(() => {
    if (visible) refreshPrimaryState();
  }, [visible, refreshPrimaryState]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>SETTINGS</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.section}>APPEARANCE</Text>
            <TouchableOpacity style={styles.rowBtn} onPress={() => setShowThemeModal(true)}>
              <MaterialCommunityIcons name="palette" size={18} color={C.accent} />
              <Text style={styles.rowText}>
                Theme · {theme.emoji} {theme.name}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={C.muted} />
            </TouchableOpacity>

            <Text style={styles.section}>BACKUP</Text>
            <Text style={styles.hint}>
              {isOnPrimary
                ? "Primary: export/import includes your account and all added profiles."
                : "This profile only: export/import covers the profile you’re using now."}
            </Text>
            <TouchableOpacity
              style={[styles.rowBtn, backupBusy && { opacity: 0.6 }]}
              onPress={onExport}
              disabled={backupBusy}
            >
              <MaterialCommunityIcons name="export" size={18} color={C.accent} />
              <Text style={styles.rowText}>
                {isOnPrimary ? "Export backup (all profiles)" : "Export backup (this profile)"}
              </Text>
              {backupBusy ? <ActivityIndicator color={C.accent} /> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rowBtn, backupBusy && { opacity: 0.6 }]}
              onPress={onImport}
              disabled={backupBusy}
            >
              <MaterialCommunityIcons name="import" size={18} color={C.accent} />
              <Text style={styles.rowText}>
                {isOnPrimary ? "Import backup (all profiles)" : "Import backup (this profile)"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.section}>SECURITY</Text>
            <SecuritySection />

            <Text style={styles.section}>PROFILES</Text>
            <ProfilesSection
              refreshToken={visible}
              onProfileSwitched={async (id) => {
                if (typeof onProfileSwitched === "function") await onProfileSwitched(id);
                await refreshPrimaryState();
              }}
              ownerName={
                user?.displayName && !/^demo athlete$/i.test(user.displayName)
                  ? user.displayName
                  : ""
              }
              ownerPhoto=""
              ownerEmail={user?.email || ""}
              isGoogleLogin={isGoogleLogin}
            />

            <Text style={styles.section}>ACCOUNT</Text>
            <TouchableOpacity
              style={[styles.rowBtn, styles.signOutBtn]}
              onPress={onSignOut}
            >
              <MaterialCommunityIcons name="logout" size={18} color={C.error} />
              <Text style={[styles.rowText, { color: C.error }]}>
                {isOnPrimary ? "Sign out" : "Exit to primary profile"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.hint}>
              {isOnPrimary
                ? "Signs out of FitTrack completely."
                : "Leaves this profile and returns to your primary profile (stays signed in)."}
            </Text>
          </ScrollView>
        </View>
      </View>

      <ThemePickerModal
        visible={showThemeModal}
        currentThemeId={themeId}
        onSelect={(id) => {
          onThemeSelect?.(id);
          setShowThemeModal(false);
        }}
        onClose={() => setShowThemeModal(false)}
      />
    </Modal>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: C.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      maxHeight: "92%",
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    title: {
      fontSize: 16,
      fontWeight: "900",
      color: C.text,
      letterSpacing: 1,
    },
    section: {
      fontSize: 11,
      fontWeight: "800",
      color: C.muted,
      letterSpacing: 0.8,
      marginTop: 12,
      marginBottom: 8,
    },
    hint: {
      fontSize: 11,
      color: C.muted,
      lineHeight: 16,
      marginBottom: 8,
      fontWeight: "600",
    },
    rowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    signOutBtn: {
      borderColor: `${C.error}55`,
    },
    rowText: {
      flex: 1,
      color: C.text,
      fontWeight: "700",
      fontSize: 13,
    },
  });
