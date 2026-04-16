import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

function ThemeTypographyPreview() {
  return (
    <div className="min-h-[240px] bg-background text-foreground p-6">
      <div
        data-testid="theme-typography-preview"
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '24px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-ui)',
          background: 'var(--card)',
        }}
      >
        <p
          data-testid="theme-typography-kicker"
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.85rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
          }}
        >
          Theme Typography Preview
        </p>
        <h1
          data-testid="theme-typography-display"
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--font-display)',
            fontSize: '2.5rem',
            lineHeight: 1.05,
          }}
        >
          Youtarr stays readable while each theme keeps its own voice.
        </h1>
        <p
          data-testid="theme-typography-body"
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: '1rem',
            lineHeight: 1.7,
          }}
        >
          Typography should support the layout system, not fight it. This sample exists to catch
          regressions where a theme silently falls back to the wrong family or loses its intended tone.
        </p>
      </div>
    </div>
  );
}

const meta: Meta<typeof ThemeTypographyPreview> = {
  title: 'Theme/Test/Typography',
  component: ThemeTypographyPreview,
};

export default meta;
type Story = StoryObj<typeof ThemeTypographyPreview>;

function makeStory(themeMode: 'playful' | 'linear' | 'flat'): Story {
  return {
    globals: {
      themeMode,
      colorMode: themeMode === 'linear' ? 'dark' : 'light',
      motionEnabled: themeMode === 'playful' ? 'on' : 'off',
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByTestId('theme-typography-preview')).toBeInTheDocument();
      await expect(canvas.getByTestId('theme-typography-display')).toBeInTheDocument();
      await expect(canvas.getByTestId('theme-typography-body')).toBeInTheDocument();
    },
  };
}

export const Playful = makeStory('playful');
export const Linear = makeStory('linear');
export const Flat = makeStory('flat');