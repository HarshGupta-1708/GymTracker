import { Platform } from "react-native";

/**
 * Injects web manifest + iOS "Add to Home Screen" meta so Safari can install
 * FitTrack as a standalone PWA (no App Store fee).
 */
export function setupPwaWeb() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  const ensure = (selector, create) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = create();
      document.head.appendChild(el);
    }
    return el;
  };

  const manifest = ensure('link[rel="manifest"]', () => {
    const link = document.createElement("link");
    link.rel = "manifest";
    return link;
  });
  manifest.href = "/manifest.json";

  const appleCapable = ensure('meta[name="apple-mobile-web-app-capable"]', () => {
    const meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-capable";
    return meta;
  });
  appleCapable.content = "yes";

  const mobileWebApp = ensure('meta[name="mobile-web-app-capable"]', () => {
    const meta = document.createElement("meta");
    meta.name = "mobile-web-app-capable";
    return meta;
  });
  mobileWebApp.content = "yes";

  const appleStatus = ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () => {
    const meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-status-bar-style";
    return meta;
  });
  appleStatus.content = "black-translucent";

  const appleTitle = ensure('meta[name="apple-mobile-web-app-title"]', () => {
    const meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-title";
    return meta;
  });
  appleTitle.content = "FitTrack";

  const themeColor = ensure('meta[name="theme-color"]', () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    return meta;
  });
  themeColor.content = "#080810";

  const appleIcon = ensure('link[rel="apple-touch-icon"]', () => {
    const link = document.createElement("link");
    link.rel = "apple-touch-icon";
    return link;
  });
  appleIcon.href = "/apple-touch-icon.png";
}
