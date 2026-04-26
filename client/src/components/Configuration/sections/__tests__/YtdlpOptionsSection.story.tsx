import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { YtdlpOptionsSection } from '../YtdlpOptionsSection';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { ConfigState } from '../../types';

const meta: Meta<typeof YtdlpOptionsSection> = {
  title: 'Components/Configuration/Sections/YtdlpOptionsSection',
  component: YtdlpOptionsSection,
  parameters: { layout: 'centered' },
  render: (args) => {
    const [config, setConfig] = useState<ConfigState>({
      ...DEFAULT_CONFIG,
      ...(args.config ?? {}),
    });
    return (
      <YtdlpOptionsSection
        {...args}
        config={config}
        onConfigChange={(updates: Partial<ConfigState>) =>
          setConfig((prev) => ({ ...prev, ...updates }))
        }
        token={args.token ?? 'storybook-token'}
      />
    );
  },
};

export default meta;

type Story = StoryObj<typeof YtdlpOptionsSection>;

export const Default: Story = {};

export const WithCustomArgs: Story = {
  args: {
    config: { ...DEFAULT_CONFIG, ytdlpCustomArgs: '--concurrent-fragments 4' },
  },
};

export const WithDenylistedFlag: Story = {
  args: {
    config: { ...DEFAULT_CONFIG, ytdlpCustomArgs: '--exec rm' },
  },
};
