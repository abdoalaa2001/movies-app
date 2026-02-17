import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#e50914",
        tabBarInactiveTintColor: "#200e0e",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#333",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الأفلام",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="film.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: "المسلسلات",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="tv.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "بحث",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: "القائمة",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
