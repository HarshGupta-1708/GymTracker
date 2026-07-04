import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert, Platform, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { COLORS, USER_GOALS_DEFAULT, todayStr, prettyDate } from "../constants/data";
import { calculateStreaks, listenUserSettings, saveUserSettings, listenBodyPhotos, saveBodyPhotoEntry, deleteBodyPhotoEntry, getWorkouts } from "../utils/firestore";
import { exportUserData, importUserData } from "../utils/backup";

const compressImageWeb = (base64Str, maxWidth, maxHeight, quality = 0.5) => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      resolve(base64Str);
      return;
    }
    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export default function DashboardScreen({
  user,
  workouts,
  onSignOut,
  navigation,
  showRestoreHint,
  onDismissRestoreHint,
  onWorkoutsChange,
}) {
  const [settings, setSettings] = useState({
    goalsPerWeek: USER_GOALS_DEFAULT.activitiesPerWeek,
    activeDaysPerWeek: USER_GOALS_DEFAULT.activeDaysPerWeek,
    targetWeeks: USER_GOALS_DEFAULT.targetWeeks,
    theme: "dark",
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [tempGoal, setTempGoal] = useState('4');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: "",
    age: "",
    height: "",
    weight: "",
    units: "Metric",
    profilePhoto: "",
    bodyPhoto: "",
  });

  const [bodyPhotos, setBodyPhotos] = useState([]);
  const [showBodyHistoryModal, setShowBodyHistoryModal] = useState(false);
  const [activeHistoryPhoto, setActiveHistoryPhoto] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);

  // Sync profileData when settings change
  useEffect(() => {
    if (settings) {
      setProfileData({
        displayName: settings.displayName || user?.displayName || "",
        age: settings.age ? String(settings.age) : "",
        height: settings.height ? String(settings.height) : "",
        weight: settings.weight ? String(settings.weight) : "",
        units: settings.units || "Metric",
        profilePhoto: settings.profilePhoto || "",
        bodyPhoto: "", // Leave blank for adding new photo
      });
    }
  }, [settings, user]);

  useEffect(() => {
    const unsub = listenUserSettings(setSettings);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = listenBodyPhotos(setBodyPhotos);
    return unsub;
  }, [user]);

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need photo library permissions to upload photos!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 9],
      quality: type === 'profile' ? 0.2 : 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      let base64 = asset.base64;
      if (!base64 && asset.uri.startsWith("data:image")) {
        base64 = asset.uri.split(",")[1];
      }
      const prefix = "data:image/jpeg;base64,";
      let fullBase64 = base64 ? (base64.startsWith("data:") ? base64 : prefix + base64) : asset.uri;

      if (Platform.OS === 'web') {
        const maxW = type === 'profile' ? 250 : 640;
        const maxH = type === 'profile' ? 250 : 360;
        fullBase64 = await compressImageWeb(fullBase64, maxW, maxH, 0.4);
      }

      if (type === 'profile') {
        setProfileData(p => ({ ...p, profilePhoto: fullBase64 }));
      } else if (type === 'body') {
        setProfileData(p => ({ ...p, bodyPhoto: fullBase64 }));
      }
    }
  };

  const handleSaveProfile = async () => {
    const ageNum = parseInt(profileData.age) || 0;
    const heightNum = parseFloat(profileData.height) || 0;
    const weightNum = parseFloat(profileData.weight) || 0;

    const updatedSettings = {
      ...settings,
      displayName: profileData.displayName,
      age: ageNum,
      height: heightNum,
      weight: weightNum,
      units: profileData.units,
      profilePhoto: profileData.profilePhoto,
    };

    if (updatedSettings.bodyPhoto) {
      delete updatedSettings.bodyPhoto;
    }

    await saveUserSettings(updatedSettings);

    if (profileData.bodyPhoto) {
      const photoId = `photo_${Date.now()}`;
      await saveBodyPhotoEntry({
        id: photoId,
        date: todayStr(),
        photo: profileData.bodyPhoto,
        weight: weightNum,
        height: heightNum,
        units: profileData.units,
        description: `Logged weight ${weightNum} ${profileData.units === 'Imperial' ? 'lbs' : 'kg'} and height ${heightNum} ${profileData.units === 'Imperial' ? 'in' : 'cm'}`,
      });
      setProfileData(p => ({ ...p, bodyPhoto: "" }));
    }

    setShowProfileModal(false);
    Alert.alert("Success 🎉", "Profile updated successfully!");
  };

  const stats = useMemo(() => {
    const workoutEntries = Object.entries(workouts || {}).filter(([, w]) => w?.exs?.length);
    const goalsPerWeek = settings?.goalsPerWeek || USER_GOALS_DEFAULT.activitiesPerWeek;
    const activeDaysPerWeek = settings?.activeDaysPerWeek || USER_GOALS_DEFAULT.activeDaysPerWeek;
    const targetWeeks = settings?.targetWeeks || USER_GOALS_DEFAULT.targetWeeks;
    const todayLogged = Boolean(workouts?.[todayStr()]?.exs?.length);

    const weekMap = {};
    workoutEntries.forEach(([date]) => {
      const d = new Date(`${date}T12:00`);
      const day = d.getDay();
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - day);
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      weekMap[key] = (weekMap[key] || 0) + 1;
    });

    const weekKeys = Object.keys(weekMap).sort();
    let longestWeekStreak = 0;
    let currentWeekStreak = 0;
    let running = 0;
    weekKeys.forEach((key) => {
      if (weekMap[key] >= goalsPerWeek) {
        running += 1;
        longestWeekStreak = Math.max(longestWeekStreak, running);
      } else {
        running = 0;
      }
    });

    const thisWeekStart = (() => {
      const t = new Date();
      t.setDate(t.getDate() - t.getDay());
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    })();

    if ((weekMap[thisWeekStart] || 0) >= goalsPerWeek) {
      currentWeekStreak = running;
    } else {
      let reverseRun = 0;
      for (let i = weekKeys.length - 1; i >= 0; i--) {
        if (weekMap[weekKeys[i]] >= goalsPerWeek) reverseRun += 1;
        else break;
      }
      currentWeekStreak = reverseRun;
    }

    const streaks = calculateStreaks(workouts);
    const goalProgress = Math.min(100, ((streaks.thisWeekWorkouts || 0) / goalsPerWeek) * 100);
    const currentWeekNo = Math.max(1, Math.ceil((workoutEntries.length || 0) / goalsPerWeek));

    return {
      sessions: workoutEntries.length,
      todayLogged,
      ...streaks,
      goalProgress,
      longestWeekStreak,
      currentWeekStreak,
      goalsPerWeek,
      activeDaysPerWeek,
      targetWeeks,
      currentWeekNo,
    };
  }, [workouts, settings]);

  const handleSaveGoal = async () => {
    const goal = parseInt(tempGoal) || 4;
    if (goal < 1 || goal > 7) {
      Alert.alert('Invalid Goal', 'Please enter a number between 1 and 7');
      return;
    }
    await saveUserSettings({ ...settings, goalsPerWeek: goal, activeDaysPerWeek: goal });
    setShowGoalModal(false);
  };

  const handleExport = async () => {
    try {
      setBackupBusy(true);
      const result = await exportUserData();
      Alert.alert("Backup Exported", `Saved as ${result.fileName}`);
    } catch (err) {
      Alert.alert("Export Failed", err.message || "Could not export backup");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImport = async () => {
    Alert.alert(
      "Import Backup",
      "This will merge workouts from your backup file. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          onPress: async () => {
            try {
              setBackupBusy(true);
              const result = await importUserData();
              if (result.cancelled) return;
              const fresh = await getWorkouts();
              if (typeof onWorkoutsChange === "function") onWorkoutsChange(fresh);
              Alert.alert(
                "Import Complete",
                `Restored ${result.workoutCount} workout days${result.exerciseCount ? ` and ${result.exerciseCount} exercises` : ""}.`,
              );
            } catch (err) {
              Alert.alert("Import Failed", err.message || "Invalid backup file");
            } finally {
              setBackupBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>DASHBOARD</Text>
          <Text style={styles.subtitle}>{prettyDate(todayStr())}</Text>
        </View>
        <TouchableOpacity style={styles.profilePill} onPress={() => setShowProfileModal(true)}>
          {settings.profilePhoto ? (
            <Image source={{ uri: settings.profilePhoto }} style={styles.profileImageAvatar} />
          ) : (
            <MaterialCommunityIcons name="account-circle" size={18} color={COLORS.accent} />
          )}
          <Text style={styles.profileText} numberOfLines={1}>
            {settings.displayName || user?.displayName || "Athlete"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showRestoreHint && (
          <TouchableOpacity style={styles.restoreBanner} onPress={onDismissRestoreHint}>
            <MaterialCommunityIcons name="cloud-check" size={18} color={COLORS.green} />
            <Text style={styles.restoreBannerText}>
              History restored from cloud. Same Google account keeps your data after reinstall.
            </Text>
            <MaterialCommunityIcons name="close" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        {/* Main Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="SESSIONS" value={stats.sessions} icon="calendar-check" color={COLORS.accent} isHero={true} />
          <StatCard label="LONGEST STREAK WEEK" value={stats.longestWeekStreak} icon="fire" color={COLORS.orange} />
          <StatCard label="CURRENT STREAK WEEK" value={stats.currentWeekStreak} icon="calendar-sync" color={COLORS.green} />
        </View>

        {/* Today's Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>TODAY</Text>
          <Text style={[styles.statusValue, { color: stats.todayLogged ? COLORS.green : COLORS.muted }]}>
            {stats.todayLogged ? "✓ Logged" : "Not started"}
          </Text>
        </View>

        {/* Athlete Profile Stats */}
        <View style={styles.profileStatsCard}>
          <View style={styles.profileStatsHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity onPress={() => setShowProfileModal(true)}>
                {settings.profilePhoto ? (
                  <Image source={{ uri: settings.profilePhoto }} style={styles.profileAvatarThumbnail} />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={24} color={COLORS.accent} />
                  </View>
                )}
              </TouchableOpacity>
              <View>
                <Text style={styles.profileNameText}>{settings.displayName || user?.displayName || "Athlete"}</Text>
                <Text style={styles.profileDetailsSub}>{settings.age ? `${settings.age} years old` : "No age added"}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowProfileModal(true)}>
              <MaterialCommunityIcons name="cog" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statsCol}>
              <Text style={styles.statSubLabel}>WEIGHT</Text>
              <Text style={styles.statValText}>{settings.weight ? `${settings.weight} ${settings.units === 'Imperial' ? 'lbs' : 'kg'}` : "--"}</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.statSubLabel}>HEIGHT</Text>
              <Text style={styles.statValText}>{settings.height ? `${settings.height} ${settings.units === 'Imperial' ? 'in' : 'cm'}` : "--"}</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.statSubLabel}>UNIT SYSTEM</Text>
              <Text style={styles.statValText}>{settings.units || "Metric"}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bodyHistoryButton}
            onPress={() => setShowBodyHistoryModal(true)}
          >
            <MaterialCommunityIcons name="camera-account" size={16} color={COLORS.accent} />
            <Text style={styles.bodyHistoryButtonText}>View Body Progress Photos</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.muted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>

        {/* Streak Info */}
        <View style={styles.streakContainer}>
          <View style={[styles.streakCard, { borderLeftColor: COLORS.accent }]}>
            <View style={styles.streakHeader}>
              <MaterialCommunityIcons name="check-decagram" size={16} color={COLORS.accent} />
              <Text style={styles.streakLabel}>COMPLETE DAYS THIS WEEK</Text>
            </View>
            <Text style={[styles.streakValue, { color: COLORS.accent }]}>{stats.thisWeekWorkouts}</Text>
          </View>
        </View>

        {/* Weekly Goal Progress */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalLabel}>Finish {stats.goalsPerWeek} activities / week</Text>
              <Text style={styles.goalValue}>Week {Math.min(stats.targetWeeks, stats.currentWeekNo)}/{stats.targetWeeks}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowGoalModal(true)}>
              <MaterialCommunityIcons name="pencil" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${stats.goalProgress}%`,
                  backgroundColor: stats.goalProgress >= 100 ? COLORS.green : COLORS.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>Completed {stats.thisWeekWorkouts}/{stats.activeDaysPerWeek} this week</Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => navigation.navigate("Today")}>
          <MaterialCommunityIcons name="dumbbell" size={18} color="#000" />
          <Text style={styles.primaryButtonText}>Start Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate("History")}>
          <MaterialCommunityIcons name="history" size={18} color={COLORS.accent} />
          <Text style={styles.secondaryButtonText}>View History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate("Progress")}>
          <MaterialCommunityIcons name="chart-line" size={18} color={COLORS.accent} />
          <Text style={styles.secondaryButtonText}>View Performance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate("Exercises")}>
          <MaterialCommunityIcons name="format-list-bulleted" size={18} color={COLORS.accent} />
          <Text style={styles.secondaryButtonText}>Manage Exercises</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, backupBusy && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={backupBusy}
        >
          <MaterialCommunityIcons name="export" size={18} color={COLORS.accent} />
          <Text style={styles.secondaryButtonText}>Export Backup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, backupBusy && { opacity: 0.6 }]}
          onPress={handleImport}
          disabled={backupBusy}
        >
          <MaterialCommunityIcons name="import" size={18} color={COLORS.accent} />
          <Text style={styles.secondaryButtonText}>Import Backup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={onSignOut}>
          <MaterialCommunityIcons name="logout" size={18} color={COLORS.error} />
          <Text style={[styles.secondaryButtonText, { color: COLORS.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Goal Setting Modal */}
      <Modal visible={showGoalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SET WEEKLY GOAL</Text>
            <Text style={styles.modalSubtitle}>How many workouts per week?</Text>
            
            <TextInput
              style={styles.goalInput}
              placeholder="4"
              keyboardType="number-pad"
              value={tempGoal}
              onChangeText={setTempGoal}
              maxLength={1}
            />

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, { flex: 1 }]}
                onPress={() => setShowGoalModal(false)}
              >
                <Text style={styles.secondaryButtonText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, { flex: 1 }]}
                onPress={handleSaveGoal}
              >
                <Text style={styles.primaryButtonText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.profileModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ATHLETE PROFILE</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "80%" }}>
              {/* Photo Pickers */}
              <View style={styles.photoContainer}>
                <View style={styles.photoBlock}>
                  <Text style={styles.photoLabel}>PROFILE PHOTO</Text>
                  <TouchableOpacity style={styles.avatarButton} onPress={() => pickImage('profile')}>
                    {profileData.profilePhoto ? (
                      <Image source={{ uri: profileData.profilePhoto }} style={styles.profileAvatarLarge} />
                    ) : (
                      <MaterialCommunityIcons name="camera-plus" size={28} color={COLORS.accent} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.photoBlock}>
                  <Text style={styles.photoLabel}>BODY PHOTO</Text>
                  <TouchableOpacity style={styles.bodyImageButton} onPress={() => pickImage('body')}>
                    {profileData.bodyPhoto ? (
                      <Image source={{ uri: profileData.bodyPhoto }} style={styles.bodyImageLarge} />
                    ) : (
                      <MaterialCommunityIcons name="image-plus" size={28} color={COLORS.accent} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Text Fields */}
              <Text style={styles.inputLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Athlete Name"
                placeholderTextColor={COLORS.muted}
                value={profileData.displayName}
                onChangeText={(val) => setProfileData(p => ({ ...p, displayName: val }))}
              />

              <View style={styles.inputGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>AGE</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="25"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="number-pad"
                    value={profileData.age}
                    onChangeText={(val) => setProfileData(p => ({ ...p, age: val }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>UNITS</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.unitToggle]}
                    onPress={() => setProfileData(p => ({ ...p, units: p.units === 'Metric' ? 'Imperial' : 'Metric' }))}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                      {profileData.units}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>WEIGHT ({profileData.units === 'Metric' ? 'kg' : 'lbs'})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={profileData.units === 'Metric' ? "75" : "165"}
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={profileData.weight}
                    onChangeText={(val) => setProfileData(p => ({ ...p, weight: val }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>HEIGHT ({profileData.units === 'Metric' ? 'cm' : 'in'})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={profileData.units === 'Metric' ? "175" : "69"}
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={profileData.height}
                    onChangeText={(val) => setProfileData(p => ({ ...p, height: val }))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, styles.primaryButton, { marginTop: 14 }]}
                onPress={handleSaveProfile}
              >
                <MaterialCommunityIcons name="check" size={16} color="#000" />
                <Text style={styles.primaryButtonText}>SAVE PROFILE</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Body Photo History Modal */}
      <Modal visible={showBodyHistoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.profileModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>BODY PROGRESS HISTORY</Text>
              <TouchableOpacity onPress={() => setShowBodyHistoryModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {bodyPhotos.length === 0 ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialCommunityIcons name="camera-off" size={48} color={`${COLORS.muted}40`} />
                <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 12, textAlign: "center" }}>
                  No progress photos saved yet.{"\n"}Add body photos by updating your profile.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 16 }}>
                  {bodyPhotos.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        width: "48%",
                        backgroundColor: COLORS.surface,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        overflow: "hidden",
                        marginBottom: 4,
                      }}
                      onPress={() => setActiveHistoryPhoto(item)}
                    >
                      <Image source={{ uri: item.photo }} style={{ width: "100%", height: 110, resizeMode: "cover" }} />
                      <View style={{ padding: 8 }}>
                        <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: "700" }}>
                          {prettyDate(item.date)}
                        </Text>
                        <Text style={{ color: COLORS.muted, fontSize: 9, marginTop: 2, fontWeight: "600" }}>
                          {item.weight} {item.units === "Imperial" ? "lbs" : "kg"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>

        {/* Selected Photo Detail Zoom Modal */}
        <Modal visible={Boolean(activeHistoryPhoto)} transparent animationType="fade">
          <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.9)" }]}>
            <View style={{ width: "90%", maxWidth: 500, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 14 }}>
                  {activeHistoryPhoto ? prettyDate(activeHistoryPhoto.date) : ""}
                </Text>
                <TouchableOpacity onPress={() => setActiveHistoryPhoto(null)}>
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              {activeHistoryPhoto && (
                <View>
                  <Image
                    source={{ uri: activeHistoryPhoto.photo }}
                    style={{ width: "100%", height: 260, borderRadius: 8, resizeMode: "contain", backgroundColor: "#000" }}
                  />
                  <View style={{ marginTop: 14, gap: 6 }}>
                    <Text style={{ color: COLORS.text, fontSize: 13, lineHeight: 18 }}>
                      {activeHistoryPhoto.description}
                    </Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 6 }}>
                      <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                        Weight: <Text style={{ color: COLORS.accent, fontWeight: "700" }}>{activeHistoryPhoto.weight} {activeHistoryPhoto.units === "Imperial" ? "lbs" : "kg"}</Text>
                      </Text>
                      <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                        Height: <Text style={{ color: COLORS.accent, fontWeight: "700" }}>{activeHistoryPhoto.height} {activeHistoryPhoto.units === "Imperial" ? "in" : "cm"}</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.button, styles.dangerButton, { marginTop: 14, height: 40, paddingVertical: 0 }]}
                      onPress={() => {
                        Alert.alert(
                          "Delete Entry?",
                          "Are you sure you want to delete this historical photo?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: async () => {
                                await deleteBodyPhotoEntry(activeHistoryPhoto.id);
                                setActiveHistoryPhoto(null);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <MaterialCommunityIcons name="trash-can" size={16} color={COLORS.error} />
                      <Text style={{ color: COLORS.error, fontWeight: "700", fontSize: 13 }}>DELETE ENTRY</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, icon, color, isHero }) {
  if (isHero) {
    return (
      <View style={[
        styles.statCard,
        { borderLeftColor: color, borderLeftWidth: 3 },
        styles.heroStatCard
      ]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <MaterialCommunityIcons name={icon} size={22} color={color} />
          <Text style={styles.statLabel}>{label}</Text>
        </View>
        <Text style={[styles.statValue, { color, fontSize: 24 }]}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.text, letterSpacing: 1 },
  subtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 150,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  profileText: { color: COLORS.text, fontSize: 12, fontWeight: "600" },
  scrollContent: { flex: 1, padding: 12 },
  restoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: `${COLORS.green}15`,
    borderWidth: 1,
    borderColor: `${COLORS.green}40`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  restoreBannerText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 17,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  heroStatCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  statValue: { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 10, color: COLORS.muted, fontWeight: "700", letterSpacing: 0.8 },
  statusCard: {
    marginBottom: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  statusLabel: { fontSize: 10, color: COLORS.muted, fontWeight: "700", letterSpacing: 1 },
  statusValue: { marginTop: 4, fontSize: 14, fontWeight: "700" },
  streakContainer: { flexDirection: "row", gap: 10, marginBottom: 14 },
  streakCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  streakHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  streakLabel: { fontSize: 10, color: COLORS.muted, fontWeight: "700", letterSpacing: 0.8 },
  streakValue: { fontSize: 20, fontWeight: "900" },
  goalCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  goalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  goalLabel: { fontSize: 10, color: COLORS.muted, fontWeight: "700", letterSpacing: 0.8 },
  goalValue: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressText: { fontSize: 12, color: COLORS.muted, fontWeight: "600", textAlign: "right" },
  liftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  liftLabel: { fontSize: 10, color: COLORS.muted, fontWeight: "700", letterSpacing: 0.8 },
  liftValue: { fontSize: 16, fontWeight: "900", marginTop: 4 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButton: { backgroundColor: COLORS.accent },
  secondaryButton: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  dangerButton: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.error },
  primaryButtonText: { color: "#000", fontWeight: "800", fontSize: 13 },
  secondaryButtonText: { color: COLORS.accent, fontWeight: "700", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    width: "80%",
    maxWidth: 300,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 16,
    fontWeight: "600",
  },
  goalInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButtonGroup: { flexDirection: "row", gap: 10 },
  profileStatsCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  profileStatsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  profileAvatarThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  profileAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  profileNameText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  profileDetailsSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    justifyContent: "space-between",
  },
  statsCol: {
    alignItems: "center",
    flex: 1,
  },
  statSubLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  statValText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  bodyHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: "100%",
  },
  bodyHistoryButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  profileImageAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  profileModalContent: {
    width: "90%",
    maxWidth: 420,
    maxHeight: "85%",
  },
  photoContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  photoBlock: {
    flex: 1,
    alignItems: "center",
  },
  photoLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  avatarButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  bodyImageButton: {
    width: 140,
    height: 80,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bodyImageLarge: {
    width: 140,
    height: 80,
    borderRadius: 10,
  },
  unitToggle: {
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    height: 42,
  },
  inputGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
});
