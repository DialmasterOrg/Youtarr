import React from 'react';
import { Box } from '../ui';
import { ThemeMode } from '../../themes';

interface BackgroundDecorationsProps {
  themeMode: ThemeMode;
}

export const BackgroundDecorations: React.FC<BackgroundDecorationsProps> = ({ themeMode }) => {
  if (themeMode === 'playful') {
    return (
      <>
        {/* Top-right large circle */}
        <div
          aria-hidden
          className="playful-shape"
          style={{
            position: 'absolute', top: 92, right: -60,
            width: 220, height: 220, borderRadius: '50%',
            backgroundColor: 'var(--tertiary)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', opacity: 0.8, zIndex: 0, pointerEvents: 'none',
          }}
        />
        {/* Bottom-left pill */}
        <div
          aria-hidden
          className="playful-shape"
          style={{
            position: 'absolute', bottom: 120, left: -80,
            width: 260, height: 140, borderRadius: '999px',
            backgroundColor: 'var(--secondary)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', transform: 'rotate(-8deg)',
            opacity: 0.7, zIndex: 0, pointerEvents: 'none',
          }}
        />
        {/* Middle-left small square */}
        <div
          aria-hidden
          className="playful-shape hidden md:block"
          style={{
            position: 'absolute', top: 220, left: 120,
            width: 72, height: 72, borderRadius: 8,
            backgroundColor: 'var(--quaternary)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', transform: 'rotate(12deg)',
            opacity: 0.65, zIndex: 0, pointerEvents: 'none',
          }}
        />
        {/* Top-center star/diamond shape */}
        <div
          aria-hidden
          className="playful-shape hidden sm:block"
          style={{
            position: 'absolute', top: 50, left: '25%',
            width: 64, height: 64, borderRadius: 8,
            backgroundColor: 'var(--accent)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', transform: 'rotate(45deg)',
            opacity: 0.6, zIndex: 0, pointerEvents: 'none',
          }}
        />
        {/* Right-center small circle */}
        <div
          aria-hidden
          className="playful-shape hidden md:block"
          style={{
            position: 'absolute', top: '45%', right: 24,
            width: 52, height: 52, borderRadius: '50%',
            backgroundColor: 'var(--primary)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', opacity: 0.55, zIndex: 0, pointerEvents: 'none',
          }}
        />
        {/* Bottom-right triangle-ish shape */}
        <div
          aria-hidden
          className="playful-shape hidden sm:block"
          style={{
            position: 'absolute', bottom: 60, right: 80,
            width: 80, height: 80, borderRadius: '50% 0 50% 0',
            backgroundColor: 'var(--secondary)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', transform: 'rotate(20deg)',
            opacity: 0.6, zIndex: 0, pointerEvents: 'none',
          }}
        />
        {/* Mid-right pill horizontal */}
        <div
          aria-hidden
          className="playful-shape hidden md:block"
          style={{
            position: 'absolute', top: '70%', left: -40,
            width: 160, height: 44, borderRadius: '999px',
            backgroundColor: 'var(--tertiary)', border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)', transform: 'rotate(6deg)',
            opacity: 0.55, zIndex: 0, pointerEvents: 'none',
          }}
        />
      </>
    );
  }

  if (themeMode === 'linear') {
    return (
      <>
        <div className="linear-top-rail" />
        <div className="linear-grid" />
        <div
          className="linear-blob"
          style={{
            top: '10%', right: '5%', width: '40vw', height: '40vw',
            background: 'radial-gradient(circle, #5E6AD2 0%, transparent 70%)',
            animationDelay: '0s',
          }}
        />
        <div
          className="linear-blob"
          style={{
            bottom: '10%', left: '5%', width: '35vw', height: '35vw',
            background: 'radial-gradient(circle, #f472b6 0%, transparent 70%)',
            animationDelay: '-5s', opacity: 0.1,
          }}
        />
      </>
    );
  }

  return null;
};
