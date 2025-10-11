// ui/toastConfig.js
import React from "react";
import { View, Text } from "react-native";
import Toast, { BaseToast } from "react-native-toast-message";
import { COLORS, RADII, SHADOW, SPACING } from "../theme/designSystem";

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: COLORS.success, borderRadius: RADII.md, ...SHADOW.card }}
      contentContainerStyle={{ paddingHorizontal: SPACING.md }}
      text1Style={{ fontSize: 16, fontWeight: "700", color: COLORS.textPrimary }}
      text2Style={{ fontSize: 14, color: COLORS.textSecondary }}
    />
  ),
  error: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: COLORS.error, borderRadius: RADII.md, ...SHADOW.card }}
      contentContainerStyle={{ paddingHorizontal: SPACING.md }}
      text1Style={{ fontSize: 16, fontWeight: "700", color: COLORS.textPrimary }}
      text2Style={{ fontSize: 14, color: COLORS.textSecondary }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: COLORS.accent, borderRadius: RADII.md, ...SHADOW.card }}
      contentContainerStyle={{ paddingHorizontal: SPACING.md }}
      text1Style={{ fontSize: 16, fontWeight: "700", color: COLORS.textPrimary }}
      text2Style={{ fontSize: 14, color: COLORS.textSecondary }}
    />
  ),
};

export default Toast;
