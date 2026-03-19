import React from 'react';
import { ThemeBackgroundDecorations } from '../../themes/types';

interface BackgroundDecorationsProps {
  decorations: ThemeBackgroundDecorations;
}

export const BackgroundDecorations: React.FC<BackgroundDecorationsProps> = ({ decorations }) => {
  return (
    <>
      {decorations.elements.map((element, index) => (
        <div
          key={`${element.className || 'theme-decoration'}-${index}`}
          aria-hidden
          className={element.className}
          style={element.style}
        />
      ))}
    </>
  );
};
