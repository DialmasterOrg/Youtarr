import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Video, Settings, Download } from 'lucide-react';
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta: Meta = {
  title: 'UI/Tabs',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

const BasicTabs = () => (
  <TabsRoot defaultValue="videos" className="w-full max-w-md">
    <TabsList>
      <TabsTrigger value="videos">Videos</TabsTrigger>
      <TabsTrigger value="settings">Settings</TabsTrigger>
      <TabsTrigger value="downloads">Downloads</TabsTrigger>
    </TabsList>
    <TabsContent value="videos">
      <p className="text-sm text-foreground">Your downloaded videos appear here.</p>
    </TabsContent>
    <TabsContent value="settings">
      <p className="text-sm text-foreground">Channel configuration options.</p>
    </TabsContent>
    <TabsContent value="downloads">
      <p className="text-sm text-foreground">Active and queued download jobs.</p>
    </TabsContent>
  </TabsRoot>
);

export const Default: Story = { render: () => <BasicTabs /> };

export const WithIcons: Story = {
  render: () => (
    <TabsRoot defaultValue="videos" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="videos"><Video className="h-4 w-4" />Videos</TabsTrigger>
        <TabsTrigger value="settings"><Settings className="h-4 w-4" />Settings</TabsTrigger>
        <TabsTrigger value="downloads"><Download className="h-4 w-4" />Downloads</TabsTrigger>
      </TabsList>
      <TabsContent value="videos"><p className="text-sm">Video list.</p></TabsContent>
      <TabsContent value="settings"><p className="text-sm">Settings panel.</p></TabsContent>
      <TabsContent value="downloads"><p className="text-sm">Download queue.</p></TabsContent>
    </TabsRoot>
  ),
};

export const WithDisabledTab: Story = {
  render: () => (
    <TabsRoot defaultValue="active" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="disabled" disabled>Disabled</TabsTrigger>
        <TabsTrigger value="archived">Archived</TabsTrigger>
      </TabsList>
      <TabsContent value="active"><p className="text-sm">Active channels.</p></TabsContent>
      <TabsContent value="archived"><p className="text-sm">Archived channels.</p></TabsContent>
    </TabsRoot>
  ),
};

const ControlledTabs = () => {
  const [tab, setTab] = useState('videos');
  return (
    <div className="space-y-2 w-full max-w-md">
      <p className="text-xs text-muted-foreground">Active tab: <strong>{tab}</strong></p>
      <TabsRoot value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="videos"><p className="text-sm">Videos content.</p></TabsContent>
        <TabsContent value="settings"><p className="text-sm">Settings content.</p></TabsContent>
      </TabsRoot>
    </div>
  );
};

export const Controlled: Story = { render: () => <ControlledTabs /> };
