import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/** Device icon: MaterialIcons is reliable on Expo Go Android/iOS; keep laptop look on web. */
function DeviceIcon({ platform, size = 22, color }) {
  if (platform === "web" || (!platform && Platform.OS === "web")) {
    return <MaterialCommunityIcons name="laptop" size={size} color={color} />;
  }
  if (platform === "ios") {
    return <MaterialIcons name="phone-iphone" size={size} color={color} />;
  }
  if (platform === "android") {
    return <MaterialIcons name="phone-android" size={size} color={color} />;
  }
  // Fallback for unknown / older session records
  if (Platform.OS === "ios") {
    return <MaterialIcons name="phone-iphone" size={size} color={color} />;
  }
  if (Platform.OS === "android") {
    return <MaterialIcons name="phone-android" size={size} color={color} />;
  }
  return <MaterialCommunityIcons name="laptop" size={size} color={color} />;
}
import { useTheme } from "../context/ThemeContext";
import {
  disableDeviceLock,
  disablePinLock,
  enableDeviceLock,
  getLockConfig,
  setAppPin,
} from "../utils/appLock";
import {
  checkEmailForLink,
  createAthlete,
  deleteAthlete,
  getAccountOwnerMeta,
  getDefaultProfileId,
  linkAthleteEmail,
  listAthletes,
  listMemberships,
  removeMembership,
  setDefaultProfileId,
  updateAthletePin,
  verifyAthletePin,
} from "../utils/athletes";
import {
  getActiveProfileId,
  SELF_PROFILE,
  setActiveProfileId,
} from "../utils/profileScope";
import {
  listDeviceSessions,
  removeDeviceSession,
  touchDeviceSession,
} from "../utils/deviceSessions";
import { sendVerifyEmail } from "../utils/sendVerifyEmail";

function confirmAction(title, message) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

function Avatar({ uri, name, size = 40, C }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.accent, fontWeight: "900", fontSize: size * 0.4 }}>{letter}</Text>
    </View>
  );
}

/** SECURITY card only — phone lock or app PIN (no pattern). */
export function SecuritySection() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [lockCfg, setLockCfg] = useState(null);
  const [setupMode, setSetupMode] = useState(null);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");

  const reload = useCallback(async () => {
    setLockCfg(await getLockConfig());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const phoneOn = Boolean(lockCfg?.deviceEnabled);
  const pinOn = Boolean(lockCfg?.pinEnabled && lockCfg?.pinHash);

  const handlePhoneLock = async () => {
    if (phoneOn) {
      if (await confirmAction("Turn off phone lock?", "Fingerprint / face unlock will be disabled.")) {
        await disableDeviceLock();
        await reload();
      }
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("Phone only", "Device lock works on the Android/iOS app.");
      return;
    }
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!has || !enrolled) {
      Alert.alert("Unavailable", "Set up fingerprint / face / phone lock first.");
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm to enable FitTrack device lock",
      disableDeviceFallback: false,
    });
    if (!result.success) return;
    await enableDeviceLock();
    await reload();
    Alert.alert("Enabled", "Phone unlock is on. You can also enable App PIN.");
  };

  /** Always open PIN modal — set when off, change when on. */
  const handlePinLock = () => {
    setPin1("");
    setPin2("");
    setSetupMode("pin");
  };

  const savePinSetup = async () => {
    if (pin1.length < 4) {
      Alert.alert("PIN too short", "Use at least 4 digits.");
      return;
    }
    if (pin1 !== pin2) {
      Alert.alert("Mismatch", "PINs do not match. Re-enter both.");
      return;
    }
    await setAppPin(pin1);
    setSetupMode(null);
    setPin1("");
    setPin2("");
    await reload();
    Alert.alert("Saved", pinOn ? "PIN updated." : "App PIN lock is on.");
  };

  const turnOffPin = async () => {
    if (await confirmAction("Turn off App PIN?", "PIN unlock will be removed.")) {
      await disablePinLock();
      setSetupMode(null);
      await reload();
    }
  };

  const statusParts = [];
  if (phoneOn) statusParts.push("Phone");
  if (pinOn) statusParts.push("PIN");
  const statusLabel = statusParts.length ? statusParts.join(" + ") : "Off";

  return (
    <View style={styles.card}>
      <Text style={styles.status}>Status: {statusLabel}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, phoneOn && styles.chipOn]}
          onPress={handlePhoneLock}
        >
          <MaterialCommunityIcons
            name="fingerprint"
            size={16}
            color={phoneOn ? "#000" : C.accent}
          />
          <Text style={[styles.chipText, phoneOn && styles.chipTextOn]}>Phone lock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, pinOn && styles.chipOn]} onPress={handlePinLock}>
          <MaterialCommunityIcons name="dialpad" size={16} color={pinOn ? "#000" : C.accent} />
          <Text style={[styles.chipText, pinOn && styles.chipTextOn]}>App PIN</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={setupMode === "pin"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>{pinOn ? "CHANGE PIN" : "APP PIN"}</Text>
            <Text style={styles.hint}>Enter PIN, then re-enter to confirm.</Text>
            <TextInput
              style={styles.input}
              placeholder="New PIN"
              placeholderTextColor={C.muted}
              value={pin1}
              onChangeText={(t) => setPin1(t.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Re-enter PIN"
              placeholderTextColor={C.muted}
              value={pin2}
              onChangeText={(t) => setPin2(t.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              secureTextEntry
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.chip} onPress={() => setSetupMode(null)}>
                <Text style={styles.chipText}>Cancel</Text>
              </TouchableOpacity>
              {pinOn ? (
                <TouchableOpacity style={[styles.chip, styles.chipDanger]} onPress={turnOffPin}>
                  <Text style={[styles.chipText, { color: C.error }]}>Turn off</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={savePinSetup}>
                <Text style={styles.primaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** PROFILES — this device / other profiles / where shared */
export function ProfilesSection({
  onProfileSwitched,
  ownerName,
  ownerPhoto,
  ownerEmail,
  isGoogleLogin,
  refreshToken,
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [athletes, setAthletes] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [activeId, setActiveId] = useState(getActiveProfileId());
  const [defaultId, setDefaultId] = useState(SELF_PROFILE);
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhoto, setNewPhoto] = useState("");
  const [switchTarget, setSwitchTarget] = useState(null);
  const [switchPin, setSwitchPin] = useState("");
  const [pwdTarget, setPwdTarget] = useState(null);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [gmailTarget, setGmailTarget] = useState(null);
  const [gmailInput, setGmailInput] = useState("");
  const [linkFallback, setLinkFallback] = useState(null);
  const [devices, setDevices] = useState([]);
  const [accountOwner, setAccountOwner] = useState({
    name: ownerName || "You",
    photo: ownerPhoto || "",
  });
  const [busy, setBusy] = useState(false);

  const ownerLabel = accountOwner.name || ownerName || "You";
  const ownerAvatar = accountOwner.photo || ownerPhoto || "";
  /** Add / edit / set-primary only while using the primary profile */
  const canManageProfiles = activeId === defaultId;

  const resolveProfile = useCallback(
    (id) => {
      if (!id || id === SELF_PROFILE) {
        return { id: SELF_PROFILE, name: ownerLabel, photo: ownerAvatar };
      }
      const a = athletes.find((x) => x.id === id);
      return {
        id,
        name: a?.name || "Profile",
        photo: a?.photo || "",
      };
    },
    [athletes, ownerLabel, ownerAvatar],
  );

  const reload = useCallback(async () => {
    const list = await listAthletes();
    setAthletes(list);
    setMemberships(await listMemberships());
    setActiveId(getActiveProfileId());
    const def = await getDefaultProfileId();
    setDefaultId(def);
    const meta = await getAccountOwnerMeta({
      name: ownerName,
      photo: ownerPhoto,
    });
    setAccountOwner(meta);
    try {
      await touchDeviceSession({ ownerName: meta.name, athletes: list });
      setDevices(await listDeviceSessions());
    } catch {
      setDevices(await listDeviceSessions().catch(() => []));
    }
  }, [ownerName, ownerPhoto]);

  useEffect(() => {
    reload();
  }, [reload, refreshToken]);

  const primaryProfile = resolveProfile(defaultId);
  const usingProfile = resolveProfile(activeId);

  const doSwitch = async (profileId, athlete) => {
    const needsPass = athlete?.pinHash || athlete?.passwordHash || athlete?.linkedEmail;
    if (needsPass && profileId !== SELF_PROFILE) {
      setSwitchTarget(athlete);
      setSwitchPin("");
      return;
    }
    setActiveProfileId(profileId);
    setActiveId(profileId);
    if (typeof onProfileSwitched === "function") await onProfileSwitched(profileId);
    await reload();
  };

  const confirmSwitchPin = async () => {
    const ok = await verifyAthletePin(switchTarget, switchPin);
    if (!ok) {
      Alert.alert("Wrong password", "Try again, or reset via their verified Gmail.");
      return;
    }
    const id = switchTarget.id;
    setSwitchTarget(null);
    setSwitchPin("");
    setActiveProfileId(id);
    setActiveId(id);
    if (typeof onProfileSwitched === "function") await onProfileSwitched(id);
    await reload();
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const uri = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    setNewPhoto(uri);
  };

  const autoSendVerify = async ({ name, email, url }) => {
    try {
      await sendVerifyEmail({
        to: email,
        name,
        verifyUrl: url,
        hostName: ownerName || ownerEmail || "FitTrack",
      });
      Alert.alert(
        "Email sent",
        `Verification link sent to ${email}. Check Inbox and Spam (From: FitTrack notify Gmail).`,
      );
      return true;
    } catch (e) {
      console.warn("[verify email]", e?.message);
      setLinkFallback({ name, email, url, error: e?.message || "Send failed" });
      return false;
    }
  };

  const addMember = async () => {
    if (!canManageProfiles) {
      Alert.alert(
        "Primary only",
        `Switch to primary profile (${primaryProfile.name}) to add or edit profiles.`,
      );
      return;
    }
    try {
      setBusy(true);
      if (newEmail.trim()) {
        const check = await checkEmailForLink(newEmail, null);
        if (!check.canSend) {
          Alert.alert("Cannot use this Gmail", check.message);
          return;
        }
        const ok = await (Platform.OS === "web" && typeof window !== "undefined"
          ? Promise.resolve(window.confirm(`${check.status === "existing" ? "Gmail already known" : "Add & send verify?"}\n\n${check.message}`))
          : new Promise((resolve) => {
              Alert.alert(
                check.status === "existing" ? "Gmail already known" : "Add & send verify?",
                check.message,
                [
                  { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                  { text: "Continue", onPress: () => resolve(true) },
                ],
              );
            }));
        if (!ok) return;
      }

      const created = await createAthlete({
        name: newName,
        pin: newPin || null,
        pinConfirm: newPin2 || null,
        email: newEmail || null,
        photo: newPhoto || null,
      });
      setAddOpen(false);
      setNewName("");
      setNewPin("");
      setNewPin2("");
      setNewEmail("");
      setNewPhoto("");
      await reload();
      if (created.verifyUrl && created.linkedEmail) {
        await autoSendVerify({
          name: created.name,
          email: created.linkedEmail,
          url: created.verifyUrl,
        });
      }
    } catch (e) {
      Alert.alert("Could not add", e.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  const resendOrLinkGmail = (athlete) => {
    setMenuFor(null);
    if (!athlete?.linkedEmail) {
      setGmailTarget(athlete);
      setGmailInput("");
      return;
    }
    (async () => {
      try {
        setBusy(true);
        const result = await linkAthleteEmail(athlete.id, athlete.linkedEmail);
        await reload();
        await autoSendVerify({
          name: athlete.name,
          email: result.email,
          url: result.verifyUrl,
        });
      } catch (e) {
        Alert.alert("Could not send", e.message || "Try again");
      } finally {
        setBusy(false);
      }
    })();
  };

  const confirmThen = (title, message) =>
    new Promise((resolve) => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Send link", onPress: () => resolve(true) },
      ]);
    });

  const saveGmailLink = async () => {
    if (!gmailTarget) return;
    const target = gmailTarget;
    try {
      setBusy(true);
      const check = await checkEmailForLink(gmailInput, target.id);
      if (!check.canSend) {
        Alert.alert("Cannot use this Gmail", check.message);
        return;
      }
      const ok = await confirmThen(
        check.authExists || check.status === "existing"
          ? "Gmail already has a FitTrack login"
          : "Send verify email?",
        check.message,
      );
      if (!ok) return;

      const result = await linkAthleteEmail(target.id, gmailInput);
      setGmailTarget(null);
      setGmailInput("");
      await reload();
      await autoSendVerify({
        name: target.name,
        email: result.email,
        url: result.verifyUrl,
      });
    } catch (e) {
      Alert.alert("Could not link Gmail", e.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (url) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        Alert.alert("Copied", "Link copied to clipboard.");
        return;
      }
    } catch {
      /* fall through */
    }
    Alert.alert("Verify link", url);
  };

  const allProfiles = [
    {
      id: SELF_PROFILE,
      name: ownerLabel,
      photo: ownerAvatar,
      email: ownerEmail || "",
      isOwner: true,
    },
    ...athletes.map((a) => ({
      id: a.id,
      name: a.name,
      photo: a.photo || "",
      email: a.linkedEmail || "",
      emailVerified: a.emailVerified,
      isOwner: false,
      raw: a,
    })),
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.hint}>
        Using <Text style={{ color: C.text, fontWeight: "800" }}>{usingProfile.name}</Text>
        {" · "}
        Primary{" "}
        <Text style={{ color: C.text, fontWeight: "800" }}>{primaryProfile.name}</Text>
        . Tap a profile to switch.
        {!canManageProfiles
          ? ` Switch to ${primaryProfile.name} to add/edit profiles; dashboard & exercises stay personal per profile.`
          : " You can add/edit profiles while on primary."}
      </Text>

      {/* All profiles including primary — like Gmail/Chrome switcher */}
      <Text style={styles.subHead}>Profiles</Text>
      <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
        {allProfiles.map((p) => {
          const isActive = activeId === p.id;
          const isPrimary = defaultId === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.profileRow, isActive && styles.profileRowOn]}
              onPress={() => doSwitch(p.id, p.isOwner ? null : p.raw)}
            >
              <Avatar uri={p.photo} name={p.name} C={C} />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileText}>{p.name}</Text>
                {p.email ? (
                  <Text style={styles.emailLine}>
                    {p.email}
                    {!p.isOwner && p.email
                      ? p.emailVerified
                        ? " · verified"
                        : " · pending verify"
                      : ""}
                  </Text>
                ) : p.isOwner ? null : (
                  <Text style={styles.emailLine}>No Gmail linked</Text>
                )}
                <View style={styles.badgeRow}>
                  {isPrimary ? <Text style={styles.primaryBadge}>PRIMARY</Text> : null}
                  {isActive ? <Text style={styles.primaryBadge}>USING NOW</Text> : null}
                </View>
              </View>
              {isActive ? (
                <MaterialCommunityIcons name="check" size={20} color={C.accent} />
              ) : null}
              {canManageProfiles && !p.isOwner ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    setMenuFor(p.raw);
                  }}
                  style={styles.moreBtn}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="dots-vertical" size={22} color={C.muted} />
                </TouchableOpacity>
              ) : null}
              {canManageProfiles && p.isOwner ? (
                <TouchableOpacity
                  onPress={async (e) => {
                    e?.stopPropagation?.();
                    if (!isPrimary) {
                      await setDefaultProfileId(SELF_PROFILE);
                      setDefaultId(SELF_PROFILE);
                      await reload();
                    }
                  }}
                  style={styles.moreBtn}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={isPrimary ? "star" : "star-outline"}
                    size={20}
                    color={C.accent}
                  />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {canManageProfiles ? (
        <TouchableOpacity style={styles.addProfileBtn} onPress={() => setAddOpen(true)}>
          <MaterialCommunityIcons name="account-plus" size={20} color={C.accent} />
          <Text style={styles.addProfileText}>Add profile</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.hint, { marginTop: 8 }]}>
          On {usingProfile.name}: change dashboard & exercises for this profile only. Switch to{" "}
          {primaryProfile.name} to manage profiles.
        </Text>
      )}

      {/* Devices only — not profile names as clickable “accounts” */}
      <Text style={[styles.subHead, { marginTop: 14 }]}>Your logins</Text>
      <Text style={styles.hint}>
        Where {ownerEmail || ownerLabel} is signed in, and which profile is primary there.
      </Text>
      {devices.length === 0 ? (
        <Text style={styles.hint}>No devices recorded yet.</Text>
      ) : (
        devices.map((d) => {
          // Prefer live names on this device (avoids stale “Demo Athlete” labels)
          const usingName = d.thisDevice ? usingProfile.name : d.activeProfileName;
          const primName = d.thisDevice ? primaryProfile.name : d.primaryProfileName;
          return (
            <View key={d.id} style={styles.deviceRow}>
              <DeviceIcon platform={d.platform} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileText}>
                  {d.label || "Device"}
                  {d.thisDevice ? " · this device" : ""}
                </Text>
                <Text style={styles.emailLine}>
                  Using: {usingName || "—"} · Primary: {primName || "—"}
                </Text>
              </View>
              {!d.thisDevice ? (
                <TouchableOpacity
                  onPress={async () => {
                    if (await confirmAction("Remove login?", `Forget ${d.label}?`)) {
                      setDevices(await removeDeviceSession(d.id));
                    }
                  }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={C.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}

      {isGoogleLogin ? (
        <>
          <Text style={[styles.subHead, { marginTop: 14 }]}>Where you’re shared</Text>
          {memberships.length === 0 ? (
            <Text style={styles.hint}>
              Profiles shared to {ownerEmail || "your Gmail"} after verify show here.
            </Text>
          ) : (
            memberships.map((m) => (
              <View key={m.id} style={styles.deviceRow}>
                <Avatar name={m.hostName || m.name} C={C} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileText}>{m.name}</Text>
                  <Text style={styles.emailLine}>
                    Shared by {m.hostName || m.hostEmail || "another account"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    if (
                      await confirmAction(
                        "Remove share?",
                        "Remove this shared-profile record from your Google account?",
                      )
                    ) {
                      await removeMembership(m.id);
                      await reload();
                    }
                  }}
                >
                  <MaterialCommunityIcons name="link-off" size={20} color={C.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      ) : null}

      {/* Overflow menu */}
      <Modal visible={Boolean(menuFor)} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuFor(null)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{menuFor?.name}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                await setDefaultProfileId(menuFor.id);
                setDefaultId(menuFor.id);
                setMenuFor(null);
                await reload();
              }}
            >
              <MaterialCommunityIcons name="star" size={18} color={C.accent} />
              <Text style={styles.menuText}>Set as primary on this device</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setPwdTarget(menuFor);
                setPwd1("");
                setPwd2("");
                setMenuFor(null);
              }}
            >
              <MaterialCommunityIcons name="lock-reset" size={18} color={C.accent} />
              <Text style={styles.menuText}>Change password / PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => resendOrLinkGmail(menuFor)}>
              <MaterialCommunityIcons name="gmail" size={18} color={C.accent} />
              <Text style={styles.menuText}>
                {menuFor?.linkedEmail ? "Resend verify email" : "Add Gmail & verify"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                const a = menuFor;
                setMenuFor(null);
                if (
                  await confirmAction(
                    "Remove profile?",
                    `Remove ${a.name}? Your own account cannot be deleted.`,
                  )
                ) {
                  try {
                    if (getActiveProfileId() === a.id) {
                      setActiveProfileId(SELF_PROFILE);
                      setActiveId(SELF_PROFILE);
                      if (typeof onProfileSwitched === "function") {
                        await onProfileSwitched(SELF_PROFILE);
                      }
                    }
                    await deleteAthlete(a.id);
                    await reload();
                  } catch (e) {
                    Alert.alert("Delete failed", e.message || "Try again");
                  }
                }
              }}
            >
              <MaterialCommunityIcons name="delete-outline" size={18} color={C.error} />
              <Text style={[styles.menuText, { color: C.error }]}>Remove profile</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Gmail to existing profile */}
      <Modal visible={Boolean(gmailTarget)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>ADD GMAIL</Text>
            <Text style={styles.hint}>
              Link a Gmail for {gmailTarget?.name}. We check if it already exists, then send a verify
              link automatically.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="name@gmail.com"
              placeholderTextColor={C.muted}
              value={gmailInput}
              onChangeText={setGmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.chip} onPress={() => setGmailTarget(null)}>
                <Text style={styles.chipText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveGmailLink} disabled={busy}>
                <Text style={styles.primaryText}>{busy ? "Sending…" : "Link & send"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add profile */}
      <Modal visible={addOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>ADD PROFILE</Text>
            <TouchableOpacity style={styles.avatarPick} onPress={pickPhoto}>
              <Avatar uri={newPhoto} name={newName || "+"} size={56} C={C} />
              <Text style={styles.hint}>Tap to add photo</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={C.muted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN / password (min 4)"
              placeholderTextColor={C.muted}
              value={newPin}
              onChangeText={(t) => setNewPin(t.slice(0, 32))}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Re-enter to confirm"
              placeholderTextColor={C.muted}
              value={newPin2}
              onChangeText={(t) => setNewPin2(t.slice(0, 32))}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Gmail (optional — verify email auto-sent)"
              placeholderTextColor={C.muted}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.chip} onPress={() => setAddOpen(false)}>
                <Text style={styles.chipText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={addMember} disabled={busy}>
                <Text style={styles.primaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Switch password */}
      <Modal visible={Boolean(switchTarget)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Enter password</Text>
            <Text style={styles.hint}>For {switchTarget?.name}</Text>
            <TextInput
              style={styles.input}
              value={switchPin}
              onChangeText={setSwitchPin}
              secureTextEntry
              placeholder="Password / PIN"
              placeholderTextColor={C.muted}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.chip} onPress={() => setSwitchTarget(null)}>
                <Text style={styles.chipText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={confirmSwitchPin}>
                <Text style={styles.primaryText}>Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change profile password */}
      <Modal visible={Boolean(pwdTarget)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>CHANGE PASSWORD</Text>
            <Text style={styles.hint}>{pwdTarget?.name} — enter twice to confirm.</Text>
            <TextInput
              style={styles.input}
              value={pwd1}
              onChangeText={setPwd1}
              secureTextEntry
              placeholder="New password"
              placeholderTextColor={C.muted}
            />
            <TextInput
              style={styles.input}
              value={pwd2}
              onChangeText={setPwd2}
              secureTextEntry
              placeholder="Re-enter password"
              placeholderTextColor={C.muted}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.chip} onPress={() => setPwdTarget(null)}>
                <Text style={styles.chipText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  try {
                    await updateAthletePin(pwdTarget.id, pwd1, pwd2);
                    setPwdTarget(null);
                    Alert.alert("Updated", "Password changed.");
                    await reload();
                  } catch (e) {
                    Alert.alert("Error", e.message || "Try again");
                  }
                }}
              >
                <Text style={styles.primaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fallback if auto-email not configured */}
      <Modal visible={Boolean(linkFallback)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>VERIFY LINK</Text>
            <Text style={styles.hint}>
              Couldn’t auto-send to {linkFallback?.email}. Copy the link and share it, or fix
              Gmail on Render and retry.
            </Text>
            {linkFallback?.error ? (
              <Text style={[styles.hint, { color: C.error || "#e74c3c" }]}>
                {linkFallback.error}
              </Text>
            ) : null}
            <Text style={styles.linkBox} selectable>
              {linkFallback?.url}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => copyLink(linkFallback?.url)}
            >
              <Text style={styles.primaryText}>Copy link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                const subject = encodeURIComponent("Verify your FitTrack profile");
                const body = encodeURIComponent(
                  `Hi ${linkFallback?.name},\n\nOpen this link:\n\n${linkFallback?.url}\n`,
                );
                Linking.openURL(
                  `mailto:${linkFallback?.email}?subject=${subject}&body=${body}`,
                );
              }}
            >
              <Text style={styles.chipText}>Open email app</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chip} onPress={() => setLinkFallback(null)}>
              <Text style={styles.chipText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** @deprecated use SecuritySection + ProfilesSection */
export default function SecurityAthletesPanel({
  onProfileSwitched,
  ownerName,
  ownerPhoto,
  ownerEmail,
  isGoogleLogin,
}) {
  return (
    <>
      <SecuritySection />
      <ProfilesSection
        onProfileSwitched={onProfileSwitched}
        ownerName={ownerName}
        ownerPhoto={ownerPhoto}
        ownerEmail={ownerEmail}
        isGoogleLogin={isGoogleLogin}
      />
    </>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "800",
      color: C.muted,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    subHead: {
      fontSize: 12,
      fontWeight: "800",
      color: C.text,
      marginTop: 10,
      marginBottom: 8,
    },
    hint: { fontSize: 12, color: C.muted, lineHeight: 17, marginBottom: 8 },
    status: { fontSize: 13, color: C.text, fontWeight: "700", marginBottom: 8 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    chipOn: {
      backgroundColor: C.accent,
      borderColor: C.accent,
    },
    chipDanger: { borderColor: `${C.error}66` },
    chipText: { color: C.text, fontSize: 12, fontWeight: "700" },
    chipTextOn: { color: "#000", fontWeight: "800" },
    hiText: { color: C.text, fontWeight: "800", fontSize: 15 },
    emailLine: { color: C.muted, fontSize: 11, marginTop: 2 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
    deviceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginBottom: 2,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      marginBottom: 4,
    },
    profileRowOn: { backgroundColor: `${C.accent}18` },
    profileText: { color: C.text, fontWeight: "700", fontSize: 14 },
    primaryBadge: {
      marginTop: 3,
      alignSelf: "flex-start",
      fontSize: 9,
      fontWeight: "800",
      color: C.accent,
      letterSpacing: 0.6,
    },
    moreBtn: { padding: 6 },
    addProfileBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: C.border,
      borderStyle: "dashed",
      borderRadius: 10,
    },
    addProfileText: { color: C.accent, fontWeight: "800", fontSize: 13 },
    input: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      color: C.text,
      fontSize: 13,
      marginBottom: 8,
      width: "100%",
    },
    primaryBtn: {
      backgroundColor: C.accent,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: "center",
      marginBottom: 8,
    },
    primaryText: { color: "#000", fontWeight: "800", fontSize: 13 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      alignItems: "center",
    },
    menuCard: {
      width: "100%",
      maxWidth: 300,
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 8,
      overflow: "hidden",
    },
    menuTitle: {
      color: C.muted,
      fontWeight: "800",
      fontSize: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      letterSpacing: 0.5,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    menuText: { color: C.text, fontWeight: "700", fontSize: 14 },
    avatarPick: { alignItems: "center", marginBottom: 8 },
    linkBox: {
      fontSize: 11,
      color: C.text,
      backgroundColor: C.surface,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      width: "100%",
    },
  });
