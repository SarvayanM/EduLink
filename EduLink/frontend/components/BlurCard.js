// components/BlurCard.js
import React from "react";
import { View } from "react-native";
import { BlurView } from "expo-blur";
import { SURFACES, SHADOW, RADII } from "../theme/designSystem";

export default function BlurCard({
  intensity = 30,
  tint = "light",
  style,
  children,
}) {
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[SURFACES.cardBase, SHADOW.card, { overflow: "hidden" }, style]}
    >
      <View>{children}</View>
    </BlurView>
  );
}
