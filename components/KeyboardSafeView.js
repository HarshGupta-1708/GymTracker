import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

/**
 * Wraps content so inputs stay visible above the soft keyboard on phone.
 * Use `scroll` for forms; plain View for fixed layouts.
 */
export default function KeyboardSafeView({
  children,
  style,
  contentContainerStyle,
  scroll = false,
  offset,
  ...rest
}) {
  const keyboardVerticalOffset =
    offset ?? (Platform.OS === "ios" ? 12 : Platform.OS === "android" ? 24 : 0);

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentContainerStyle]} {...rest}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
