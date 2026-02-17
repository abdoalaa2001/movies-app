import { ThemedText } from "@/components/themed-text";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef } from "react";
import { SafeAreaView, StyleSheet, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";

export default function PlayerScreen() {
  const { url, title } = useLocalSearchParams();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  // SMART ad blocking with auto-detection
  const adBlockScript = `
    (function() {
      console.log('🛡️ SMART Ad Blocker with Auto-Detection');
      
      // ==========================================
      // DETECT AND LOG VIDEO HOSTS
      // ==========================================
      function detectVideoHosts() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe, index) => {
          const src = iframe.src;
          if (src && src.includes('http')) {
            try {
              const hostname = new URL(src).hostname;
              console.log('📺 VIDEO HOST DETECTED:', hostname);
              console.log('📺 Full URL:', src);
              
              // Send to React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'VIDEO_HOST',
                hostname: hostname,
                url: src
              }));
            } catch (e) {
              console.log('Error parsing iframe URL:', src);
            }
          }
        });
      }
      
      // ==========================================
      // WARMUP PHASE
      // ==========================================
      let isWarmupPhase = true;
      setTimeout(() => {
        isWarmupPhase = false;
        console.log('✅ Warmup complete');
      }, 5000);
      
      // ==========================================
      // POPUP BLOCKING
      // ==========================================
      window.open = function() { 
        console.log('🚫 Blocked popup');
        return null; 
      };
      window.alert = function() {};
      window.confirm = function() { return false; };
      
      // ==========================================
      // SMART CLICK HANDLER
      // ==========================================
      document.addEventListener('click', function(e) {
        if (isWarmupPhase) {
          console.log('🔥 Warmup click');
          return;
        }
        
        const link = e.target.closest('a');
        if (link && link.href) {
          const href = link.href.toLowerCase();
          
          // Block obvious ad domains
          const adKeywords = [
            'doubleclick', 'googlesyndication', 'googleadservices',
            'adnxs', 'exoclick', 'popads', 'adcash',
            'propellerads', 'popcash', 'clickadu'
          ];
          
          if (adKeywords.some(keyword => href.includes(keyword))) {
            console.log('🚫 Blocked ad link');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }
      }, true);
      
      // ==========================================
      // INJECT INTO IFRAMES
      // ==========================================
      function injectIntoIframes() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach((iframe, index) => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && !iframe.dataset.injected) {
              iframe.dataset.injected = 'true';
              console.log('💉 Injecting into iframe', index);
              
              const script = iframeDoc.createElement('script');
              script.textContent = \`
                (function() {
                  console.log('🎬 Video player protection');
                  
                  window.open = () => null;
                  
                  function removeAds() {
                    const ads = document.querySelectorAll(
                      '.ad, .ads, [id*="ad"], [class*="ad-"]',
                      '[class*="overlay"]', '[class*="popup"]'
                    );
                    ads.forEach(ad => {
                      if (!ad.querySelector('video')) {
                        ad.remove();
                      }
                    });
                  }
                  
                  function skipAds() {
                    // Skip buttons
                    document.querySelectorAll('[class*="skip"], [id*="skip"]').forEach(btn => {
                      if (btn.offsetParent !== null) btn.click();
                    });
                    
                    // Fast-forward ads
                    document.querySelectorAll('video').forEach(video => {
                      if (video.duration > 0 && video.duration < 60) {
                        video.currentTime = video.duration - 0.1;
                      }
                    });
                  }
                  
                  setInterval(removeAds, 200);
                  setInterval(skipAds, 300);
                })();
              \`;
              
              if (iframeDoc.head) {
                iframeDoc.head.appendChild(script);
              }
            }
          } catch (e) {
            console.log('⚠️ Cross-origin iframe', index);
          }
        });
      }
      
      // ==========================================
      // REMOVE AD ELEMENTS
      // ==========================================
      function nukeAds() {
        const selectors = [
          '.ad', '.ads', '.advertisement',
          '[id*="ad"]', '[class*="ad-"]',
          '[class*="popup"]', '[class*="banner"]'
        ];
        
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            if (!el.querySelector('video')) {
              el.remove();
            }
          });
        });
      }
      
      // ==========================================
      // RUN EVERYTHING
      // ==========================================
      detectVideoHosts();
      nukeAds();
      injectIntoIframes();
      
      setInterval(nukeAds, 300);
      setInterval(injectIntoIframes, 1000);
      setInterval(detectVideoHosts, 2000);
      
      new MutationObserver(() => {
        nukeAds();
        injectIntoIframes();
        detectVideoHosts();
      }).observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('✅ Protection active');
    })();
    true;
  `;

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "VIDEO_HOST") {
        console.log("📺 VIDEO HOST DETECTED:");
        console.log("   Hostname:", data.hostname);
        console.log("   Full URL:", data.url);
        console.log("");
        console.log("👉 ADD THIS TO ALLOWED LIST:");
        console.log(`   '${data.hostname}',`);
        console.log("");
      }
    } catch (e) {
      // Not JSON, ignore
    }
  };

  // SMART navigation handler - allows common video hosts
  const handleNavigation = (request: any) => {
    const reqUrl = request.url.toLowerCase();

    // Known ad domains - ALWAYS BLOCK
    const blockedDomains = [
      "doubleclick.net",
      "googlesyndication.com",
      "googleadservices.com",
      "advertising.com",
      "adnxs.com",
      "exoclick.com",
      "popads.net",
      "adcash.com",
      "propellerads.com",
      "popcash.net",
      "clickadu.com",
      "hilltopads.net",
      "adsterra.com",
    ];

    // Check if it's a blocked ad domain
    if (blockedDomains.some((domain) => reqUrl.includes(domain))) {
      console.log("🚫 BLOCKED AD DOMAIN:", reqUrl);
      return false;
    }

    // Whitelist - MovizLand and common video hosts
    const allowed = [
      "movizlands.com",
      // Common video hosts (add more as you discover them)
      "vidcloud",
      "upstream",
      "streamtape",
      "fembed",
      "doodstream",
      "mixdrop",
      "uqload",
      "streamwish",
      "filemoon",
      "voe",
      "streamlare",
      "vidoza",
      "supervideo",
      "videovard",
      "guccihide",
      "streamruby",
      "uploadever",
      "send.cm",
      "userload.co",
    ];

    const isAllowed = allowed.some((domain) => reqUrl.includes(domain));

    if (isAllowed) {
      console.log("✅ ALLOWED:", reqUrl);
      return true;
    }

    // If not in whitelist and not a known ad, log it
    console.log("⚠️ UNKNOWN DOMAIN (might be video host):", reqUrl);
    console.log("   If video doesn't play, add this domain to allowed list");

    // For now, BLOCK unknown domains (safer approach)
    // If video doesn't play, check logs and add the domain
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ThemedText style={styles.backButtonText}>← Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: url as string }}
        injectedJavaScript={adBlockScript}
        injectedJavaScriptBeforeContentLoaded={adBlockScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsFullscreenVideo={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onShouldStartLoadWithRequest={handleNavigation}
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    color: "#e50914",
    fontSize: 18,
    fontWeight: "bold",
  },
  title: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
});
