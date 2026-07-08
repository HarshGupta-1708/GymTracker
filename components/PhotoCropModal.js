import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const MAX_W = 320;
const MAX_H = 360;
const MIN_CROP = 48;

// Free-form crop tool for web (native platforms use the OS crop UI).
// Drag inside the box to move it, drag the corner handle to resize it
// to any width/height — no fixed aspect ratio.
export default function PhotoCropModal({ visible, imageUri, colors: C, onCancel, onDone }) {
  const [display, setDisplay] = useState(null); // { w, h, naturalW, naturalH }
  const [crop, setCrop] = useState(null); // { x, y, w, h } in display px
  const displayRef = useRef(null);
  const cropRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!visible || !imageUri || typeof window === "undefined" || !window.Image) return;
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      const d = {
        w: Math.max(1, Math.round(img.width * scale)),
        h: Math.max(1, Math.round(img.height * scale)),
        naturalW: img.width,
        naturalH: img.height,
      };
      displayRef.current = d;
      setDisplay(d);
      const init = { x: 0, y: 0, w: d.w, h: d.h };
      cropRef.current = init;
      setCrop(init);
    };
    img.src = imageUri;
  }, [visible, imageUri]);

  const setCropBoth = (c) => {
    cropRef.current = c;
    setCrop(c);
  };

  const movePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = { ...cropRef.current };
      },
      onPanResponderMove: (_e, g) => {
        const d = displayRef.current;
        const s = startRef.current;
        if (!d || !s) return;
        setCropBoth({
          ...s,
          x: Math.max(0, Math.min(s.x + g.dx, d.w - s.w)),
          y: Math.max(0, Math.min(s.y + g.dy, d.h - s.h)),
        });
      },
    }),
  ).current;

  const resizePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = { ...cropRef.current };
      },
      onPanResponderMove: (_e, g) => {
        const d = displayRef.current;
        const s = startRef.current;
        if (!d || !s) return;
        setCropBoth({
          ...s,
          w: Math.max(MIN_CROP, Math.min(s.w + g.dx, d.w - s.x)),
          h: Math.max(MIN_CROP, Math.min(s.h + g.dy, d.h - s.y)),
        });
      },
    }),
  ).current;

  const handleCrop = () => {
    const d = display;
    const c = crop;
    if (!d || !c || typeof document === "undefined") {
      onDone(imageUri);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const sx = d.naturalW / d.w;
      const sy = d.naturalH / d.h;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(c.w * sx));
      canvas.height = Math.max(1, Math.round(c.h * sy));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        c.x * sx,
        c.y * sy,
        c.w * sx,
        c.h * sy,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      onDone(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => onDone(imageUri);
    img.src = imageUri;
  };

  if (!visible) return null;
  const styles = createStyles(C);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>CROP PHOTO</Text>
            <TouchableOpacity onPress={onCancel}>
              <MaterialCommunityIcons name="close" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Drag the box to move · drag the corner to resize (any shape)
          </Text>

          {display && crop ? (
            <View style={[styles.stage, { width: display.w, height: display.h }]}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: display.w, height: display.h }}
              />
              {/* Dimmed regions outside the crop box */}
              <View style={[styles.dim, { top: 0, left: 0, right: 0, height: crop.y }]} />
              <View style={[styles.dim, { top: crop.y + crop.h, left: 0, right: 0, bottom: 0 }]} />
              <View style={[styles.dim, { top: crop.y, left: 0, width: crop.x, height: crop.h }]} />
              <View style={[styles.dim, { top: crop.y, left: crop.x + crop.w, right: 0, height: crop.h }]} />
              {/* Crop box */}
              <View
                {...movePan.panHandlers}
                style={[
                  styles.cropBox,
                  {
                    left: crop.x,
                    top: crop.y,
                    width: crop.w,
                    height: crop.h,
                    borderColor: C.accent,
                  },
                ]}
              >
                <View
                  {...resizePan.panHandlers}
                  style={[styles.handle, { backgroundColor: C.accent }]}
                >
                  <MaterialCommunityIcons name="resize-bottom-right" size={14} color="#000" />
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.stage, { width: MAX_W, height: 200 }]}>
              <Text style={{ color: C.muted, fontSize: 12 }}>Loading photo…</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline, { borderColor: C.border }]}
              onPress={() => onDone(imageUri)}
            >
              <Text style={[styles.btnOutlineText, { color: C.accent }]}>USE FULL PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.accent }]}
              onPress={handleCrop}
            >
              <MaterialCommunityIcons name="crop" size={16} color="#000" />
              <Text style={styles.btnPrimaryText}>CROP &amp; USE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    card: {
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      alignItems: "center",
      maxWidth: 420,
      width: "100%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 6,
    },
    title: {
      color: C.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 1,
    },
    hint: {
      color: C.muted,
      fontSize: 10,
      marginBottom: 12,
      textAlign: "center",
    },
    stage: {
      position: "relative",
      backgroundColor: "#000",
      borderRadius: 8,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
    dim: {
      position: "absolute",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    cropBox: {
      position: "absolute",
      borderWidth: 2,
      touchAction: "none",
      cursor: "move",
    },
    handle: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      touchAction: "none",
      cursor: "nwse-resize",
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
      width: "100%",
    },
    btn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 10,
    },
    btnOutline: {
      borderWidth: 1,
      backgroundColor: "transparent",
    },
    btnOutlineText: {
      fontSize: 12,
      fontWeight: "800",
    },
    btnPrimaryText: {
      color: "#000",
      fontSize: 12,
      fontWeight: "800",
    },
  });
