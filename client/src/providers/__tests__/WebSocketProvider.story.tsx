import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import React, { useContext } from 'react';
import WebSocketContext from '../../contexts/WebSocketContext';
import WebSocketProvider from '../WebSocketProvider';

const ContextConsumer = () => {
  const ctx = useContext(WebSocketContext);
  return <div>{ctx ? 'WebSocket context ready' : 'WebSocket context missing'}</div>;
};

const meta: Meta<typeof WebSocketProvider> = {
  title: 'Providers/WebSocketProvider',
  component: WebSocketProvider,
  render: () => (
    <WebSocketProvider>
      <ContextConsumer />
    </WebSocketProvider>
  ),
};

export default meta;
type Story = StoryObj<typeof WebSocketProvider>;

export const ProvidesContext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('WebSocket context ready')).toBeInTheDocument();
  },
};
