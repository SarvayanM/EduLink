// components/PrimaryButton.js
import React from "react";
import { Pressable, Text } from "react-native";
import { BUTTON } from "../theme/designSystem";

export default function PrimaryButton({ title, onPress, style, textStyle }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [BUTTON.primary.container, pressed && BUTTON.primary.pressed, style]}
    >
      <Text style={[BUTTON.primary.label, textStyle]}>{title}</Text>
    </Pressable>
  );
}
