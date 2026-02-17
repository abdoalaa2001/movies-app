import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const API_BASE = "https://en.movizlands.com/wp-json/wp/v2";

interface SearchResult {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url: string }>;
  };
}

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/posts`, {
        params: {
          search: searchQuery,
          per_page: 30,
          _embed: true,
        },
      });
      setResults(response.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFeaturedImage = (item: SearchResult): string => {
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

  const handlePress = (item: SearchResult) => {
    router.push({
      pathname: "/player",
      params: {
        url: item.link,
        title: cleanTitle(item.title.rendered),
      },
    } as any);
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>🔍 البحث</ThemedText>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن فيلم أو مسلسل..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <ThemedText style={styles.searchButtonText}>بحث</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#e50914" />
          <ThemedText style={styles.loadingText}>جاري البحث...</ThemedText>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyText}>
            {searchQuery ? "لا توجد نتائج" : "ابحث عن أي شيء..."}
          </ThemedText>
        </View>
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
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: "#e50914",
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
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
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
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
});
