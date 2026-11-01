import { useEffect, useRef } from "react";
import { BackHandler, Linking, Platform, SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const APP_URL = "https://aisecratory.netlify.app";
const APP_HOST = new URL(APP_URL).host;

export default function App() {
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />
      <WebView
        ref={web}
        source={{ uri: APP_URL }}
        sharedCookiesEnabled
        domStorageEnabled
        onNavigationStateChange={(s) => (canGoBack.current = s.canGoBack)}
        // Google OAuth (Composio connections) is blocked in embedded WebViews,
        // so anything off our own host opens in the system browser.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url === "about:blank") return true;
          let host = "";
          try {
            host = new URL(req.url).host;
          } catch {
            return false;
          }
          if (host === APP_HOST) return true;
          Linking.openURL(req.url);
          return false;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
