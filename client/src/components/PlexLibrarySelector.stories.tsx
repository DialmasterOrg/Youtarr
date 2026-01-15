import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import PlexLibrarySelector from './PlexLibrarySelector';

const meta: Meta<typeof PlexLibrarySelector> = {
  title: 'Components/PlexLibrarySelector',
  component: PlexLibrarySelector,
  args: {
    open: true,
    handleClose: fn(),
    setLibraryId: fn(),
    token: 'storybook-token',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/getplexlibraries', () =>
          HttpResponse.json([
            { id: '1', title: 'Movies' },
            { id: '2', title: 'TV Shows' },
          ])
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof PlexLibrarySelector>;

export const SelectLibrary: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByLabelText('Select a Plex Library'));
    await userEvent.click(await body.findByText('Movies'));

    await userEvent.click(body.getByRole('button', { name: 'Save Selection' }));
    await expect(args.setLibraryId).toHaveBeenCalledWith({
      libraryId: '1',
      libraryTitle: 'Movies',
    });
  },
};
