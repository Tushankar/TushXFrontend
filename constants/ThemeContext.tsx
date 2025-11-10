import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface Colors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  error: string;
  success: string;
  warning: string;
}

interface ThemeContextType {
  theme: Theme;
  colors: Colors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightColors: Colors = {
  background: '#FFFFFF',
  surface: '#F7F8FA',
  text: '#000000',
  textSecondary: '#667781',
  border: '#E9EDEF',
  primary: '#00A884',
  error: '#E53935',
  success: '#00A884',
  warning: '#FF9800',
};

const darkColors: Colors = {
  background: '#0B141A',
  surface: '#2A3942',
  text: '#E9EDEF',
  textSecondary: '#8696A0',
  border: '#2A3942',
  primary: '#00A884',
  error: '#E53935',
  success: '#00A884',
  warning: '#FF9800',
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  const colors = useMemo(() => (theme === 'light' ? lightColors : darkColors), [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const value = {
    theme,
    colors,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};