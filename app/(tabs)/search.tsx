import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE = "https://en.movizlands.com/wp-json/wp/v2";

const BG = "#0b0b0b";
const GOLD = "#b08d00";

interface SearchResult {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  categories?: number[];
  _embedded?: {
    "wp:featuredmedia"?: { source_url: string }[];
  };
}

// لو عندك IDs تانية للأفلام/المسلسلات غيّرها هنا فقط
const MOVIES_CATEGORY = 79;
const SERIES_CATEGORY = 9;

type FilterMode = "all" | "movies" | "series";

export default function SearchScreen() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<FilterMode>("all");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/posts`, {
        params: {
          search: searchQuery,
          per_page: 50,
          _embed: true,
        },
      });
      setResults(response.data || []);
    } catch (error) {
      console.error("Error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getFeaturedImage = (item: SearchResult): string => {
    const u = item._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    return (
      u || "https://via.placeholder.com/1200x700/111111/ffffff?text=No+Image"
    );
  };

  const cleanTitle = (htmlTitle: string): string => {
    return htmlTitle
      .replace(/<[^>]*>/g, "")
      .replace(/&#\d+;/g, "")
      .replace(/&[a-z]+;/gi, "")
      .trim();
  };

  const handlePress = (item: SearchResult) => {
    router.push({
      pathname: "/player",
      params: {
        url: item.link,
        title: cleanTitle(item.title.rendered),
      },
    } as any);
  };

  // فلتر اختياري (الكل/أفلام/مسلسلات) باستخدام categories اللي موجودة في نفس الداتا
  const filtered = useMemo(() => {
    if (mode === "all") return results;

    return results.filter((p) => {
      const cats = p.categories || [];
      if (mode === "movies") return cats.includes(MOVIES_CATEGORY);
      if (mode === "series") return cats.includes(SERIES_CATEGORY);
      return true;
    });
  }, [results, mode]);

  const renderItem = ({ item }: { item: SearchResult }) => (
    <Pressable style={styles.card} onPress={() => handlePress(item)}>
      <Image
        source={{ uri: getFeaturedImage(item) }}
        style={styles.poster}
        resizeMode="cover"
      />

      {/* Fade */}
      <View style={styles.fade} />

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>
        {cleanTitle(item.title.rendered)}
      </Text>

      {/* Date */}
      <Text style={styles.date}>
        {new Date(item.date).toLocaleDateString()}
      </Text>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>🔍 البحث</ThemedText>
        <ThemedText style={styles.headerSub}>ابحث عن فيلم أو مسلسل</ThemedText>
      </View>

      {/* Search box */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="اكتب اسم الفيلم/المسلسل..."
          placeholderTextColor="rgba(255,255,255,0.45)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />

        <Pressable style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>بحث</Text>
        </Pressable>
      </View>

      {/* Filter pills (optional) */}
      <View style={styles.pills}>
        <Pressable
          onPress={() => setMode("all")}
          style={[styles.pill, mode === "all" && styles.pillActive]}
        >
          <Text style={styles.pillText}>الكل</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("movies")}
          style={[styles.pill, mode === "movies" && styles.pillActive]}
        >
          <Text style={styles.pillText}>أفلام</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("series")}
          style={[styles.pill, mode === "series" && styles.pillActive]}
        >
          <Text style={styles.pillText}>مسلسلات</Text>
        </Pressable>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={GOLD} />
          <ThemedText style={styles.loadingText}>جاري البحث...</ThemedText>
        </View>
      ) : filtered.length > 0 ? (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyText}>
            {searchQuery ? "لا توجد نتائج" : "ابدأ بالبحث..."}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: GOLD,
  },
  headerSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.70)",
    fontSize: 13,
  },

  searchWrap: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 6,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  searchBtn: {
    backgroundColor: "rgba(176,141,0,0.18)",
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GOLD,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  pills: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillActive: {
    backgroundColor: "rgba(176,141,0,0.12)",
    borderColor: GOLD,
  },
  pillText: { color: "#fff", fontWeight: "900" },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#fff", opacity: 0.8 },

  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#fff", opacity: 0.5, fontSize: 16 },

  list: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    paddingTop: 6,
    gap: 12,
  },

  // Wide card like ArabSeed sections (but vertical list)
  card: {
    width: "100%",
    height: 190,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  poster: { width: "100%", height: "100%" },

  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    backgroundColor: "rgba(0,0,0,0.60)",
  },
  title: {
    position: "absolute",
    right: 14,
    bottom: 34,
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    maxWidth: "78%",
    textAlign: "right",
  },
  date: {
    position: "absolute",
    right: 14,
    bottom: 14,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "700",
  },
});
