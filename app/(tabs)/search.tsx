/**
 * search.tsx — Search Screen
 *
 * Changes vs original:
 *  - Search only fires on keyboard "search" press or submit — NOT on text change.
 *  - Filter chips removed.
 */

import { ThemedView } from "@/components/themed-view";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BASE,
  COUNTRY_META,
  LANG_META,
  WPPost,
  cleanTitle,
  getClass,
  getThumb,
  safeClassList,
} from "./apiUtils";

const W = Dimensions.get("window").width;
const CARD_H = 100;

function extractSeriesName(classList: string[]): string | null {
  const cls = classList.find(
    (c) => c.startsWith("series-") && !/^series-\d+$/.test(c),
  );
  return cls ? cls.slice(7).replace(/-+/g, " ").trim() : null;
}

function ResultRow({ post, onPress }: { post: WPPost; onPress: () => void }) {
  const countryId = getClass(post, "country");
  const langId = getClass(post, "language");
  const flag = countryId ? COUNTRY_META[countryId]?.emoji : null;
  const lbl = langId ? LANG_META[langId]?.label : null;
  const series = extractSeriesName(safeClassList(post));

  return (
    <Pressable style={row.card} onPress={onPress}>
      <Image
        source={{ uri: getThumb(post) }}
        style={row.thumb}
        resizeMode="cover"
      />
      <View style={row.info}>
        {series && (
          <Text style={row.series} numberOfLines={1}>
            {series}
          </Text>
        )}
        <Text style={row.title} numberOfLines={2}>
          {cleanTitle(post.title.rendered)}
        </Text>
        {(flag || lbl) && (
          <View style={row.pills}>
            {flag && (
              <View style={row.pill}>
                <Text style={row.pillTxt}>{flag}</Text>
              </View>
            )}
            {lbl && (
              <View style={row.pill}>
                <Text style={row.pillTxt}>{lbl}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [hasError, setHasError] = useState(false);

  const search = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setEmpty(false);
    setHasError(false);
    try {
      const { data } = await axios.get<WPPost[]>(`${BASE}/posts`, {
        params: { search: trimmed, per_page: 50, _embed: true },
        timeout: 12_000,
      });
      const posts = data ?? [];
      setResults(posts);
      setEmpty(posts.length === 0);
    } catch {
      setResults([]);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setEmpty(false);
    setHasError(false);
  };

  const navigate = (post: WPPost) =>
    router.push({
      pathname: "/player",
      params: { url: post.link, title: cleanTitle(post.title.rendered) },
    } as any);

  return (
    <ThemedView style={s.container}>
      {/* Search bar */}
      <View style={s.bar}>
        <Pressable onPress={search} hitSlop={8}>
          <Text style={s.icon}>🔍</Text>
        </Pressable>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن مسلسل أو فيلم..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          returnKeyType="search"
          onSubmitEditing={search}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={clearSearch} hitSlop={8}>
            <Text style={s.clear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Result count */}
      {results.length > 0 && (
        <Text style={s.count}>{results.length} نتيجة</Text>
      )}

      {/* Content area */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#b08d00" />
        </View>
      ) : hasError ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>⚠️</Text>
          <Text style={s.emptyTxt}>حدث خطأ في الاتصال</Text>
          <Pressable onPress={search} style={s.retryBtn}>
            <Text style={s.retryTxt}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : empty ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🔎</Text>
          <Text style={s.emptyTxt}>لا توجد نتائج لـ "{query}"</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🎬</Text>
          <Text style={s.emptyTxt}>ابحث عن أي محتوى</Text>
          <Text style={s.emptyHint}>مسلسلات تركية، كورية، أفلام...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ResultRow post={item} onPress={() => navigate(item)} />
          )}
        />
      )}
    </ThemedView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0b" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  bar: {
    marginTop: 60,
    marginHorizontal: 14,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  icon: { fontSize: 18, marginRight: 8 },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    textAlign: "right",
    fontWeight: "600",
  },
  clear: { color: "rgba(255,255,255,0.4)", fontSize: 18, marginLeft: 8 },
  count: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "right",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: { paddingHorizontal: 14, paddingBottom: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTxt: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 16,
    textAlign: "center",
  },
  emptyHint: { color: "rgba(255,255,255,0.25)", fontSize: 13, marginTop: 6 },
  retryBtn: {
    marginTop: 14,
    backgroundColor: "#b08d00",
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 16,
  },
  retryTxt: { color: "#fff", fontWeight: "700" },
});

const row = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    height: CARD_H,
  },
  thumb: { width: CARD_H * 0.75, height: CARD_H },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  series: {
    color: "#b08d00",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 3,
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 6,
  },
  pills: { flexDirection: "row", gap: 6, justifyContent: "flex-end" },
  pill: {
    backgroundColor: "rgba(176,141,0,0.2)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(176,141,0,0.35)",
  },
  pillTxt: { color: "#c9a830", fontSize: 10, fontWeight: "700" },
});
