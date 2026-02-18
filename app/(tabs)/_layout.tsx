import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const LOGO = require("../../assets/images/movizlands_logo.png");

// ===== Text outline (border around text) =====
function OutlineLabel({
  text,
  color,
  outlineColor,
  fontSize,
  stroke,
}: {
  text: string;
  color: string;
  outlineColor: string;
  fontSize: number;
  stroke: number;
}) {
  return (
    <View style={styles.labelWrap} pointerEvents="none">
      <Text
        style={[
          styles.labelBase,
          { fontSize, color: outlineColor, left: -stroke },
        ]}
      >
        {text}
      </Text>
      <Text
        style={[
          styles.labelBase,
          { fontSize, color: outlineColor, left: stroke },
        ]}
      >
        {text}
      </Text>
      <Text
        style={[
          styles.labelBase,
          { fontSize, color: outlineColor, top: -stroke },
        ]}
      >
        {text}
      </Text>
      <Text
        style={[
          styles.labelBase,
          { fontSize, color: outlineColor, top: stroke },
        ]}
      >
        {text}
      </Text>
      <Text style={[styles.labelBase, { fontSize, color }]}>{text}</Text>
    </View>
  );
}

// ===== Custom tab button with ACTIVE gold border =====
function GoldBorderTabButton(props: any) {
  const selected = props?.accessibilityState?.selected;

  return (
    <Pressable
      {...props}
      onPress={(e) => props.onPress?.(e)}
      style={[
        styles.tabBtn,
        selected ? styles.tabBtnActive : styles.tabBtnInactive,
        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
      ]}
    >
      {props.children}
    </Pressable>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // ===== Responsive sizes =====
  const isSmall = width < 380;
  const isTablet = width >= 768;

  const iconSize = isSmall ? 22 : isTablet ? 28 : 25;
  const fontSize = isSmall ? 10.5 : isTablet ? 12.5 : 11.5;
  const tabBarHeight = isSmall ? 70 : isTablet ? 85 : 75;
  const stroke = isSmall ? 1 : 1.3;

  // ===== Colors =====
  const BG = "#0b0b0b";
  const GOLD = "#b08d00";
  const INACTIVE = "#d0d0d0";
  const OUTLINE = "#000";

  const centerSize = isSmall ? 58 : isTablet ? 70 : 62;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <GoldBorderTabButton {...props} />,
        tabBarShowLabel: true,

        tabBarStyle: {
          backgroundColor: BG,
          height: tabBarHeight,
          borderTopWidth: 0,
          elevation: 15,

          overflow: "visible", // ✅ مهم جدًا عشان اللوجو يبان وهو طالع لفوق
          position: "relative", // ✅ يساعد في الويب
        },

        tabBarIconStyle: { marginBottom: 5 },
      }}
    >
      {/* Movies */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: ({ focused }) => (
            <OutlineLabel
              text="الأفلام"
              color={focused ? GOLD : INACTIVE}
              outlineColor={OUTLINE}
              fontSize={fontSize}
              stroke={stroke}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "videocam" : "videocam-outline"}
              size={iconSize}
              color={focused ? GOLD : INACTIVE}
            />
          ),
        }}
      />

      {/* Series */}
      <Tabs.Screen
        name="series"
        options={{
          tabBarLabel: ({ focused }) => (
            <OutlineLabel
              text="المسلسلات"
              color={focused ? GOLD : INACTIVE}
              outlineColor={OUTLINE}
              fontSize={fontSize}
              stroke={stroke}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "tv" : "tv-outline"}
              size={iconSize}
              color={focused ? GOLD : INACTIVE}
            />
          ),
        }}
      />

      {/* CENTER LOGO TAB */}
      <Tabs.Screen
        name="center"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => null,

          // IMPORTANT: مفيش href هنا خالص

          tabBarButton: () => (
            <Pressable
              onPress={() => router.push("/")}
              style={[
                styles.centerButton,
                {
                  width: centerSize,
                  height: centerSize,
                  borderRadius: centerSize / 2,
                  top: -centerSize * 0.35,
                  borderColor: GOLD,
                },
              ]}
            >
              <View
                style={{
                  width: centerSize * 0.82,
                  height: centerSize * 0.82,
                  borderRadius: (centerSize * 0.82) / 2,
                  overflow: "hidden", // ✅ ده اللي بيقص الصورة دايرة
                }}
              >
                <Image
                  source={LOGO}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover" // cover عشان تملى الدايرة
                />
              </View>
            </Pressable>
          ),
        }}
      />

      {/* Search */}
      <Tabs.Screen
        name="search"
        options={{
          tabBarLabel: ({ focused }) => (
            <OutlineLabel
              text="بحث"
              color={focused ? GOLD : INACTIVE}
              outlineColor={OUTLINE}
              fontSize={fontSize}
              stroke={stroke}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={iconSize}
              color={focused ? GOLD : INACTIVE}
            />
          ),
        }}
      />

      {/* List */}
      <Tabs.Screen
        name="list"
        options={{
          tabBarLabel: ({ focused }) => (
            <OutlineLabel
              text="القائمة"
              color={focused ? GOLD : INACTIVE}
              outlineColor={OUTLINE}
              fontSize={fontSize}
              stroke={stroke}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "list" : "list-outline"}
              size={iconSize}
              color={focused ? GOLD : INACTIVE}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    borderRadius: 20,
  },
  tabBtnInactive: {},
  tabBtnActive: {
    borderWidth: 1.5,
    borderColor: "#b08d00",
    backgroundColor: "rgba(176, 141, 0, 0.08)",
  },

  centerButton: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#0b0b0b",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",

    zIndex: 9999, // ✅ مهم للويب
    elevation: 9999, // ✅ مهم للأندرويد

    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },

  labelWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  labelBase: {
    position: "absolute",
    fontWeight: "700",
    textAlign: "center",
  },
});
