import React from 'react';
import { Box } from '@mui/material';
import { ThemeMode } from '../../contexts/ThemeEngineContext';

interface BackgroundDecorationsProps {
  themeMode: ThemeMode;
}

export const BackgroundDecorations: React.FC<BackgroundDecorationsProps> = ({ themeMode }) => {
  if (themeMode === 'playful') {
    return (
      <>
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

  if (themeMode === 'flat') {
    return (
      <>
        <Box
          sx={{
            position: 'absolute',
            top: '-5%',
            right: '-5%',
            width: '40vw',
            height: '40vw',
            borderRadius: '50%',
            bgcolor: 'rgba(59, 130, 246, 0.03)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '10%',
            left: '-10%',
            width: '30vw',
            height: '30vw',
            bgcolor: 'rgba(16, 185, 129, 0.03)',
            transform: 'rotate(15deg)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      </>
    );
  }

  return null;
};
