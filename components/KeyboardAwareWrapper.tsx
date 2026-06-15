import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraScrollHeight?: number;
};

export function KeyboardAwareWrapper({
  children,
  style,
  contentContainerStyle,
  extraScrollHeight = 20,
}: Props) {
  return (
    <KeyboardAwareScrollView
      style={[styles.flex, style]}
      contentContainerStyle={contentContainerStyle}
      enableOnAndroid
      extraScrollHeight={extraScrollHeight}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});