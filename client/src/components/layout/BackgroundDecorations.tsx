import React from 'react';
import { Box } from '@mui/material';
import { ThemeMode } from '../../themes';

interface BackgroundDecorationsProps {
  themeMode: ThemeMode;
}

export const BackgroundDecorations: React.FC<BackgroundDecorationsProps> = ({ themeMode }) => {
  if (themeMode === 'playful') {
    return (
      <>
        {/* Top-right large circle */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            top: 92,
            right: { xs: -120, md: -60 },
            width: { xs: 180, md: 220 },
            height: { xs: 180, md: 220 },
            borderRadius: '50%',
            bgcolor: 'var(--tertiary)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            opacity: 0.8,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        {/* Bottom-left pill */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            bottom: { xs: 80, md: 120 },
            left: { xs: -140, md: -80 },
            width: { xs: 200, md: 260 },
            height: { xs: 120, md: 140 },
            borderRadius: '999px',
            bgcolor: 'var(--secondary)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            transform: 'rotate(-8deg)',
            opacity: 0.7,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        {/* Middle-left small square */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            top: { xs: 260, md: 220 },
            left: { xs: 24, md: 120 },
            width: { xs: 56, md: 72 },
            height: { xs: 56, md: 72 },
            borderRadius: 2,
            bgcolor: 'var(--quaternary)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            transform: 'rotate(12deg)',
            opacity: 0.65,
            zIndex: 0,
            pointerEvents: 'none',
            display: { xs: 'none', md: 'block' },
          }}
        />
        {/* Top-center star/diamond shape */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            top: { xs: 40, md: 50 },
            left: { xs: '30%', md: '25%' },
            width: { xs: 48, md: 64 },
            height: { xs: 48, md: 64 },
            borderRadius: 2,
            bgcolor: 'var(--accent)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            transform: 'rotate(45deg)',
            opacity: 0.6,
            zIndex: 0,
            pointerEvents: 'none',
            display: { xs: 'none', sm: 'block' },
          }}
        />
        {/* Right-center small circle */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            top: { xs: '40%', md: '45%' },
            right: { xs: 8, md: 24 },
            width: { xs: 40, md: 52 },
            height: { xs: 40, md: 52 },
            borderRadius: '50%',
            bgcolor: 'var(--primary)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            opacity: 0.55,
            zIndex: 0,
            pointerEvents: 'none',
            display: { xs: 'none', md: 'block' },
          }}
        />
        {/* Bottom-right triangle-ish shape */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            bottom: { xs: 40, md: 60 },
            right: { xs: 24, md: 80 },
            width: { xs: 60, md: 80 },
            height: { xs: 60, md: 80 },
            borderRadius: '50% 0 50% 0',
            bgcolor: 'var(--secondary)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            transform: 'rotate(20deg)',
            opacity: 0.6,
            zIndex: 0,
            pointerEvents: 'none',
            display: { xs: 'none', sm: 'block' },
          }}
        />
        {/* Mid-right pill horizontal */}
        <Box
          aria-hidden
          className="playful-shape"
          sx={{
            position: 'absolute',
            top: { xs: '65%', md: '70%' },
            left: { xs: -60, md: -40 },
            width: { xs: 120, md: 160 },
            height: { xs: 36, md: 44 },
            borderRadius: '999px',
            bgcolor: 'var(--tertiary)',
            border: '3px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            transform: 'rotate(6deg)',
            opacity: 0.55,
            zIndex: 0,
            pointerEvents: 'none',
            display: { xs: 'none', md: 'block' },
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
        <Box
          className="linear-blob"
          sx={{
            top: '10%',
            right: '5%',
            width: '40vw',
            height: '40vw',
            background: 'radial-gradient(circle, #5E6AD2 0%, transparent 70%)',
            animationDelay: '0s',
          }}
        />
        <Box
          className="linear-blob"
          sx={{
            bottom: '10%',
            left: '5%',
            width: '35vw',
            height: '35vw',
            background: 'radial-gradient(circle, #f472b6 0%, transparent 70%)',
            animationDelay: '-5s',
            opacity: 0.1,
          }}
        />
      </>
    );
  }

  return null;
};
