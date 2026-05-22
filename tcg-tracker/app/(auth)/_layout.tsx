import { Stack } from "expo-router";
import { palette } from "@/lib/theme";

// hi

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
      }}
    />
  );
}
