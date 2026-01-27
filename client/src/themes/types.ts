import React from 'react';

export type ThemeMode = 'playful' | 'neumorphic' | 'linear';

export interface ThemeTokens {
  [key: string]: string;
}

export interface ThemeDefinition {
  id: ThemeMode;
  name: string;
  description: string;
  layoutMode: 'sidebar' | 'top-nav';
  tokens: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
  preview: React.ReactNode;
  muiOverrides?: any;
}
