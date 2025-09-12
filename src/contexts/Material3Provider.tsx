import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { applyMaterial3Theme, generateMaterial3Theme, Material3Theme } from '../styles/material3/theme';
import { generateColorTokens } from '../styles/material3/colors';
import { generateTypographyTokens } from '../styles/material3/typography';

interface Material3ContextType {
  theme: Material3Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setSourceColor: (color: string) => void;
}

const Material3Context = createContext<Material3ContextType | undefined>(undefined);

interface Material3ProviderProps {
  children: ReactNode;
  defaultDark?: boolean;
  sourceColor?: string;
}

export const Material3Provider: React.FC<Material3ProviderProps> = ({
  children,
  defaultDark = true,
  sourceColor
}) => {
  const [isDark, setIsDark] = useState(defaultDark);
  const [theme, setTheme] = useState<Material3Theme>(generateMaterial3Theme());
  const [currentSourceColor, setCurrentSourceColor] = useState(sourceColor || '#8B5CF6');

  // Apply theme on mount and when dark mode changes
  useEffect(() => {
    const newTheme = applyMaterial3Theme(isDark);
    setTheme(newTheme);
    
    // Apply additional custom properties
    const root = document.documentElement;
    
    // Add color tokens
    const colorTokens = generateColorTokens();
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `:root { ${colorTokens} }`;
    document.head.appendChild(styleElement);
    
    // Add typography tokens
    const typographyTokens = generateTypographyTokens();
    const typeStyleElement = document.createElement('style');
    typeStyleElement.innerHTML = `:root { ${typographyTokens} }`;
    document.head.appendChild(typeStyleElement);
    
    // Set dark mode class on body
    if (isDark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
    
    return () => {
      // Cleanup
      if (styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
      if (typeStyleElement.parentNode) {
        typeStyleElement.parentNode.removeChild(typeStyleElement);
      }
    };
  }, [isDark, currentSourceColor]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const setSourceColor = (color: string) => {
    setCurrentSourceColor(color);
    // Theme will be regenerated via useEffect
  };

  return (
    <Material3Context.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setSourceColor
      }}
    >
      {children}
    </Material3Context.Provider>
  );
};

// Custom hook to use Material 3 theme
export const useMaterial3 = () => {
  const context = useContext(Material3Context);
  if (context === undefined) {
    throw new Error('useMaterial3 must be used within a Material3Provider');
  }
  return context;
};

export default Material3Provider;