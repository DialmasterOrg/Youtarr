import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';

const meta: Meta = {
  title: 'UI/Accordion',
  tags: ['autodocs'],
};
export default meta;

/* ─── Single Collapsible (one default open) ──────────── */
export const SingleCollapsible: StoryObj = {
  name: 'Accordion / Single Collapsible',
  render: () => (
    <AccordionRoot type="single" collapsible defaultValue="item-2" className="w-80">
      {[
        { id: 'item-1', title: 'What is Youtarr?', content: 'Youtarr is a self-hosted YouTube channel downloader that keeps your media library up to date automatically.' },
        { id: 'item-2', title: 'How does scheduling work?', content: 'You configure a cron schedule per channel and Youtarr will check for new videos and download them in the background.' },
        { id: 'item-3', title: 'Is authentication required?', content: 'Yes, Youtarr supports local authentication. You can configure users via the settings panel.' },
      ].map(({ id, title, content }) => (
        <AccordionItem key={id} value={id}>
          <AccordionTrigger>{title}</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">{content}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  ),
};

/* ─── Multiple (can open all) ────────────────────────── */
export const MultipleType: StoryObj = {
  name: 'Accordion / Multiple (open all)',
  render: () => (
    <AccordionRoot type="multiple" defaultValue={['m-1', 'm-2']} className="w-80">
      {[
        { id: 'm-1', title: 'Section One', content: 'Content for section one.' },
        { id: 'm-2', title: 'Section Two', content: 'Content for section two.' },
        { id: 'm-3', title: 'Section Three', content: 'Content for section three.' },
      ].map(({ id, title, content }) => (
        <AccordionItem key={id} value={id}>
          <AccordionTrigger>{title}</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">{content}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  ),
};

/* ─── All Collapsed ──────────────────────────────────── */
export const AllCollapsed: StoryObj = {
  name: 'Accordion / All Collapsed Initially',
  render: () => (
    <AccordionRoot type="single" collapsible className="w-80">
      {[
        { id: 'c-1', title: 'Collapsed Item 1', content: 'Expand to see this content.' },
        { id: 'c-2', title: 'Collapsed Item 2', content: 'Expand to see this content.' },
        { id: 'c-3', title: 'Collapsed Item 3', content: 'Expand to see this content.' },
      ].map(({ id, title, content }) => (
        <AccordionItem key={id} value={id}>
          <AccordionTrigger>{title}</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">{content}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  ),
};

/* ─── Configuration Panel Pattern ────────────────────── */
export const ConfigurationPanel: StoryObj = {
  name: 'Accordion / Configuration Panel',
  render: () => (
    <AccordionRoot type="multiple" defaultValue={['general']} className="w-96">
      <AccordionItem value="general">
        <AccordionTrigger>General Settings</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Library Path</label>
              <input
                type="text"
                defaultValue="/media/downloads"
                className="border border-border rounded px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Max Concurrent Downloads</label>
              <input
                type="number"
                defaultValue={3}
                className="border border-border rounded px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary w-24"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="download">
        <AccordionTrigger>Download Settings</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Default Quality</label>
              <select className="border border-border rounded px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary">
                <option>1080p</option>
                <option>720p</option>
                <option>480p</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="embed-subs" defaultChecked />
              <label htmlFor="embed-subs" className="text-sm">Embed subtitles</label>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notifications">
        <AccordionTrigger>Notifications</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="notify-complete" defaultChecked />
              <label htmlFor="notify-complete" className="text-sm">Notify on download complete</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="notify-error" />
              <label htmlFor="notify-error" className="text-sm">Notify on error</label>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  ),
};
