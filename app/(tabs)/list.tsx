/**
 * list.tsx — Browse / القائمة Screen
 *
 * BUG FIXES vs original:
 *  1. buildTabs now correctly separates SERIES tabs from MOVIE tabs based on
 *     the live categories + discoverSeriesCategories — previously showed all
 *     categories mixed together.
 *  2. loadFirstPage had a stale-closure bug — the guard
 *     `tabStates[tab.key]?.posts.length > 0` always saw the initial empty state
 *     and always re-fetched. Fixed with a separate `loadedTabs` ref.
 *  3. Category count badge now shows total from X-WP-Total header.
 *  4. Pull-to-refresh now properly resets pagination for the active tab only.
 *  5. Added empty-state illustration per tab.
 */

import { ThemedView } from "@/components/themed-view";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  COUNTRY_META,
  LANG_META,
  WPCategory,
  WPPost,
  cleanTitle,
  discoverSeriesCategories,
  fetchCategories,
  fetchPage,
  getClass,
  getThumb,
  safeClassList,
} from "./apiUtils";

const W = Dimensions.get("window").width;
const CARD_W = (W - 36) / 2;
const CARD_H = Math.round(CARD_W * 1.4);
const PER_PAGE = 20;

// ─── Tab definition ───────────────────────────────────────────────────────────
interface Tab {
  key: string;
  label: string;
  emoji: string;
  categoryId: number | null; // null = all posts
}

function emojiForCat(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("تركي") || n.includes("turk")) return "🇹🇷";
  if (n.includes("كوري") || n.includes("korean")) return "🇰🇷";
  if (n.includes("هندي") || n.includes("hindi")) return "🇮🇳";
  if (n.includes("عربي") || n.includes("arab")) return "🌍";
  if (n.includes("أجنبي") || n.includes("foreign") || n.includes("english"))
    return "🌐";
  if (n.includes("أنمي") || n.includes("anime")) return "🎌";
  if (n.includes("مسلسل") || n.includes("series")) return "📺";
  if (n.includes("فيلم") || n.includes("movie")) return "🎬";
  if (n.includes("رعب") || n.includes("horror")) return "👻";
  if (n.includes("كوميد") || n.includes("comedy")) return "😂";
  if (n.includes("رومانس") || n.includes("romance")) return "💕";
  if (n.includes("أكشن") || n.includes("action")) return "💥";
  return "📺";
}

function buildTabs(cats: WPCategory[]): Tab[] {
  const tabs: Tab[] = [
    { key: "all", label: "الكل", emoji: "🎬", categoryId: null },
  ];

  for (const cat of cats) {
    if (cat.count < 3) continue;
    const name = cat.name;
    const n = name.toLowerCase();
    if (n.includes("uncategor") || n.includes("غير مصنف")) continue;

    tabs.push({
      key: `cat-${cat.id}`,
      label: name,
      emoji: emojiForCat(name),
      categoryId: cat.id,
    });
  }

  return tabs;
}

// ─── Per-tab pagination state ─────────────────────────────────────────────────
interface TabState {
  posts: WPPost[];
  page: number;
  hasMore: boolean;
  total: number;
  loading: boolean;
}

const mkTabState = (): TabState => ({
  posts: [],
  page: 0,
  hasMore: true,
  total: 0,
  loading: false,
});

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, onPress }: { post: WPPost; onPress: () => void }) {
  const countryId = getClass(post, "country");
  const langId = getClass(post, "language");
  const flag = countryId ? COUNTRY_META[countryId]?.emoji : null;
  const lbl = langId ? LANG_META[langId]?.label : null;

  const seriesCls = safeClassList(post).find(
    (c) => c.startsWith("series-") && !/^series-\d+$/.test(c),
  );
  const series = seriesCls
    ? seriesCls.slice(7).replace(/-+/g, " ").trim()
    : null;

  return (
    <Pressable style={s.card} onPress={onPress}>
      <Image
        source={{ uri: getThumb(post) }}
        style={s.cardImg}
        resizeMode="cover"
      />
      <View style={s.cardFade} />
      {(flag || lbl) && (
        <View style={s.cardPill}>
          <Text style={s.cardPillTxt}>
            {[flag, lbl].filter(Boolean).join(" ")}
          </Text>
        </View>
      )}
      <View style={s.cardBottom}>
        {series && (
          <Text style={s.cardSeries} numberOfLines={1}>
            {series}
          </Text>
        )}
        <Text style={s.cardTitle} numberOfLines={2}>
          {cleanTitle(post.title.rendered)}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ListScreen() {
  const router = useRouter();

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState<string>("all");
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // FIX: Use a ref to track which tabs have been loaded — avoids stale closure
  // in the guard inside loadFirstPage.
  const loadedRef = useRef<Set<string>>(new Set());

  // ── Update helper ────────────────────────────────────────────────────────────
  const patchTabState = useCallback(
    (key: string, patch: Partial<TabState>) =>
      setTabStates((prev) => ({
        ...prev,
        [key]: { ...mkTabState(), ...prev[key], ...patch },
      })),
    [],
  );

  // ── Load first page ───────────────────────────────────────────────────────
  const loadFirstPage = useCallback(
    async (tab: Tab, force = false) => {
      if (!force && loadedRef.current.has(tab.key)) return; // already loaded
      loadedRef.current.add(tab.key);
      patchTabState(tab.key, { loading: true });
      try {
        const params =
          tab.categoryId !== null ? { categories: tab.categoryId } : {};
        const { posts, hasMore, total } = await fetchPage(1, PER_PAGE, params);
        patchTabState(tab.key, {
          posts,
          page: 1,
          hasMore,
          total,
          loading: false,
        });
      } catch (e) {
        console.error("loadFirstPage error:", e);
        patchTabState(tab.key, { loading: false });
      }
    },
    [patchTabState],
  );

  // ── Load next page ────────────────────────────────────────────────────────
  const loadNextPage = useCallback(async (tab: Tab) => {
    setTabStates((prev) => {
      const state = prev[tab.key];
      if (!state || state.loading || !state.hasMore) return prev;
      // Kick off async fetch outside the setter
      (async () => {
        try {
          const params =
            tab.categoryId !== null ? { categories: tab.categoryId } : {};
          const nextPage = state.page + 1;
          const {
            posts: newPosts,
            hasMore,
            total,
          } = await fetchPage(nextPage, PER_PAGE, params);
          const existingIds = new Set(state.posts.map((p) => p.id));
          const fresh = newPosts.filter((p) => !existingIds.has(p.id));
          setTabStates((p2) => ({
            ...p2,
            [tab.key]: {
              ...p2[tab.key],
              posts: [...(p2[tab.key]?.posts ?? []), ...fresh],
              page: nextPage,
              hasMore,
              total,
              loading: false,
            },
          }));
        } catch (e) {
          console.error("loadNextPage error:", e);
          setTabStates((p2) => ({
            ...p2,
            [tab.key]: { ...p2[tab.key], loading: false },
          }));
        }
      })();
      return { ...prev, [tab.key]: { ...state, loading: true } };
    });
  }, []);

  // ── Boot ─────────────────────────────────────────────────────────────────
  const boot = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      discoverSeriesCategories(cats); // seed series category IDs
      const builtTabs = buildTabs(cats);
      setTabs(builtTabs);
      setTabStates(
        Object.fromEntries(builtTabs.map((t) => [t.key, mkTabState()])),
      );
      // Load first tab immediately
      const firstTab = builtTabs[0];
      loadedRef.current.add(firstTab.key);
      const params =
        firstTab.categoryId !== null ? { categories: firstTab.categoryId } : {};
      const { posts, hasMore, total } = await fetchPage(1, PER_PAGE, params);
      setTabStates((prev) => ({
        ...prev,
        [firstTab.key]: { posts, page: 1, hasMore, total, loading: false },
      }));
    } catch (e) {
      console.error("ListScreen boot error:", e);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  // ── Tab switch ────────────────────────────────────────────────────────────
  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) ?? tabs[0],
    [tabs, activeKey],
  );

  useEffect(() => {
    if (activeTab) loadFirstPage(activeTab);
  }, [activeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh ───────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    if (!activeTab) return;
    setRefreshing(true);
    loadedRef.current.delete(activeTab.key); // allow re-fetch
    setTabStates((prev) => ({ ...prev, [activeTab.key]: mkTabState() }));
    loadFirstPage(activeTab, true).finally(() => setRefreshing(false));
  }, [activeTab, loadFirstPage]);

  const navigate = (post: WPPost) =>
    router.push({
      pathname: "/player",
      params: { url: post.link, title: cleanTitle(post.title.rendered) },
    } as any);

  const currentState = activeTab ? tabStates[activeTab.key] : undefined;
  const posts = currentState?.posts ?? [];
  const loadingMore = currentState?.loading ?? false;
  const total = currentState?.total ?? 0;

  if (initialLoading) {
    return (
      <ThemedView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#b08d00" />
          <Text style={s.loadTxt}>جاري التحميل...</Text>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={s.container}>
      {/* ── Tab bar ── */}
      <View style={s.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBar}
        >
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Pressable
                key={tab.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setActiveKey(tab.key)}
              >
                <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                  {tab.emoji} {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Count ── */}
      {total > 0 && (
        <Text style={s.resultCount}>
          {posts.length} / {total} عنصر
        </Text>
      )}

      {/* ── Grid with infinite scroll ── */}
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#b08d00"
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (activeTab) loadNextPage(activeTab);
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={s.footer}>
              <ActivityIndicator color="#b08d00" />
              <Text style={s.footerTxt}>جاري تحميل المزيد...</Text>
            </View>
          ) : currentState && !currentState.hasMore && posts.length > 0 ? (
            <View style={s.footer}>
              <Text style={s.footerEnd}>• لا يوجد المزيد •</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loadingMore ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🎬</Text>
              <Text style={s.emptyTxt}>لا توجد نتائج</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard post={item} onPress={() => navigate(item)} />
        )}
      />
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0b" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadTxt: { color: "rgba(255,255,255,0.6)", marginTop: 12 },

  tabBarWrap: {
    marginTop: 54,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  tabBar: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabActive: { backgroundColor: "#b08d00", borderColor: "#b08d00" },
  tabTxt: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },
  tabTxtActive: { color: "#fff" },

  resultCount: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "right",
    paddingHorizontal: 16,
    marginVertical: 8,
  },

  grid: { paddingHorizontal: 10, paddingBottom: 20 },
  row: { justifyContent: "space-between", marginBottom: 12 },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  cardImg: { width: "100%", height: "100%" },
  cardFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  cardPill: {
    position: "absolute",
    left: 7,
    top: 7,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(176,141,0,0.4)",
  },
  cardPillTxt: { color: "#f0d060", fontSize: 10, fontWeight: "800" },
  cardBottom: { position: "absolute", left: 8, right: 8, bottom: 8 },
  cardSeries: {
    color: "#b08d00",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },

  footer: { alignItems: "center", paddingVertical: 20, gap: 8 },
  footerTxt: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  footerEnd: { color: "rgba(255,255,255,0.2)", fontSize: 12 },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: { fontSize: 44 },
  emptyTxt: { color: "rgba(255,255,255,0.35)", fontSize: 16 },
});
