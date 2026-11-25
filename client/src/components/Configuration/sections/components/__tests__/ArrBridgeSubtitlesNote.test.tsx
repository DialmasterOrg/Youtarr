import React from 'react';
import { screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeSubtitlesNote } from '../ArrBridgeSubtitlesNote';
import { renderWithProviders } from '../../../../../test-utils';

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeSubtitlesNote>> = {}) => {
  renderWithProviders(<ArrBridgeSubtitlesNote subtitlesEnabled subtitleLanguage="en" {...overrides} />);
};

const note = () => within(screen.getByRole('group', { name: 'Subtitles' }));

describe('ArrBridgeSubtitlesNote', () => {
  describe('with subtitles on in Youtarr', () => {
    test('says which languages are downloaded and that a grab hands over the files a video has', () => {
      setup({ subtitleLanguage: 'en,es' });

      expect(
        note().getByText(/Youtarr downloads subtitles \(en, es\) with each video, and a grab hands over the subtitle files a video has/)
      ).toBeInTheDocument();
    });

    test('names the setting Sonarr and Radarr need, and where it is', () => {
      setup();

      expect(note().getByText('Import Extra Files')).toBeInTheDocument();
      expect(note().getByText(/Settings -> Media Management -> Importing/)).toBeInTheDocument();
    });

    test('does not send the user to the Core settings', () => {
      setup();

      expect(note().queryByRole('link', { name: 'Core settings' })).not.toBeInTheDocument();
    });

    // The downloader treats a missing language list as English, and a saved
    // null reaches the page as it is.
    test.each([
      ['null', null],
      ['empty', ''],
    ])('names English when the saved language list is %s', (_name, subtitleLanguage) => {
      setup({ subtitleLanguage });

      expect(note().getByText(/Youtarr downloads subtitles \(en\) with each video/)).toBeInTheDocument();
    });
  });

  describe('with subtitles off in Youtarr', () => {
    test('says a video downloaded now has none, and a library video keeps the ones it has', () => {
      setup({ subtitlesEnabled: false });

      expect(
        note().getByText(/Subtitles are off in Youtarr, so a video downloaded now has none to hand over/)
      ).toBeInTheDocument();
      expect(note().getByText(/one already in your library keeps the subtitles it has/)).toBeInTheDocument();
    });

    test('links to where subtitles are turned on', () => {
      setup({ subtitlesEnabled: false });

      expect(note().getByRole('link', { name: 'Core settings' })).toHaveAttribute('href', '/settings/core');
    });

    test('renders with a saved null language list', () => {
      setup({ subtitlesEnabled: false, subtitleLanguage: null });

      expect(note().getByText(/Subtitles are off in Youtarr/)).toBeInTheDocument();
    });

    test('still names the setting Sonarr and Radarr need', () => {
      setup({ subtitlesEnabled: false });

      expect(note().getByText('Import Extra Files')).toBeInTheDocument();
      expect(note().getByText(/Settings -> Media Management -> Importing/)).toBeInTheDocument();
    });
  });

  test.each([[true], [false]])('links to the subtitles part of the guide (subtitles on: %s)', (subtitlesEnabled) => {
    setup({ subtitlesEnabled });

    expect(note().getByRole('link', { name: 'More about subtitles' })).toHaveAttribute(
      'href', 'https://dialmasterorg.github.io/Youtarr/docs/sonarr-radarr/#subtitles'
    );
  });
});
