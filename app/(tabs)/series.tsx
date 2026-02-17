import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

const API_BASE = "https://en.movizlands.com/wp-json/wp/v2";
const SERIES_CATEGORY = 9;

interface Series {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url: string }>;
  };
}

export default function SeriesScreen() {
  const router = useRouter();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await axios.get(`${API_BASE}/posts`, {
        params: {
          per_page: 30,
          page: pageNum,
          categories: SERIES_CATEGORY,
          _embed: true,
        },
      });

      const newSeries = response.data;

      if (append) {
        setSeries((prev) => [...prev, ...newSeries]);
      } else {
        setSeries(newSeries);
      }

      const totalPages = parseInt(response.headers["x-wp-totalpages"] || "1");
      setHasMore(pageNum < totalPages);
    } catch (error) {
      console.error("Error:", error);
      if (pageNum === 1) {
        const response = await axios.get(`${API_BASE}/posts`, {
          params: { per_page: 30, page: pageNum, _embed: true },
        });
        setSeries(response.data);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadSeries(nextPage, true);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    setHasMore(true);
    loadSeries(1, false);
  };

  const getFeaturedImage = (item: Series): string => {
    try {
      if (item._embedded?.["wp:featuredmedia"]?.[0]) {
        return item._embedded["wp:featuredmedia"][0].source_url;
      }
    } catch (error) {}
    return "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=No+Image";
  };

  const cleanTitle = (htmlTitle: string): string => {
    return htmlTitle
      .replace(/<[^>]*>/g, "")
      .replace(/&#\d+;/g, "")
      .replace(/&[a-z]+;/gi, "");
  };

  const handlePress = (item: Series) => {
    router.push({
      pathname: "/player",
      params: {
        url: item.link,
        title: cleanTitle(item.title.rendered),
      },
    } as any);
  };

  const renderItem = ({ item }: { item: Series }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handlePress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: getFeaturedImage(item) }}
        style={styles.poster}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <ThemedText style={styles.title} numberOfLines={2}>
          {cleanTitle(item.title.rendered)}
        </ThemedText>
        <ThemedText style={styles.date}>
          {new Date(item.date).toLocaleDateString()}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#e50914" />
        <ThemedText style={styles.footerText}>جاري التحميل...</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>📺 المسلسلات</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          {series.length} نتيجة
        </ThemedText>
      </View>

      {loading && series.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#e50914" />
          <ThemedText style={styles.loadingText}>جاري التحميل...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={series}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          contentContainerStyle={styles.list}
          onRefresh={handleRefresh}
          refreshing={loading}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 3,
    borderBottomColor: "#e50914",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e50914",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  list: {
    padding: 8,
  },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  poster: {
    width: "100%",
    height: 250,
    backgroundColor: "#1a1a1a",
  },
  overlay: {
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
    opacity: 0.7,
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
});
