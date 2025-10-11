// components/Screen.js
import React from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { LAYOUT } from "../theme/designSystem";

export default function Screen({ children, style }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <View style={[LAYOUT.screen, style]}>{children}</View>
    </KeyboardAvoidingView>
  );
}
