import React, { createContext, useContext, useEffect, useMemo } from "react";
import { DEFAULT_THEME_ID, getThemeById } from "../constants/themes";
import { syncLegacyColors } from "../constants/data";

const ThemeContext = createContext({
  themeId: DEFAULT_THEME_ID,
  colors: getThemeById(DEFAULT_THEME_ID).colors,
  theme: getThemeById(DEFAULT_THEME_ID),
});

export function ThemeProvider({ themeId = DEFAULT_THEME_ID, children }) {
  const value = useMemo(() => {
    const theme = getThemeById(themeId);
    syncLegacyColors(theme.colors);
    return {
      themeId: theme.id,
      colors: theme.colors,
      theme,
    };
  }, [themeId]);

  useEffect(() => {
    syncLegacyColors(value.colors);
  }, [value.colors]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemedStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
