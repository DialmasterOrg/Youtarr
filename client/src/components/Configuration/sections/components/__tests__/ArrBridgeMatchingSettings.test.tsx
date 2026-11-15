import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeMatchingSettings } from '../ArrBridgeMatchingSettings';
import { renderWithProviders } from '../../../../../test-utils';
import { ConfigState } from '../../../types';
import { DEFAULT_CONFIG } from '../../../../../config/configSchema';

const setup = (
  configOverrides: Partial<ConfigState> = {},
  overrides: Partial<React.ComponentProps<typeof ArrBridgeMatchingSettings>> = {}
) => {
  const props: React.ComponentProps<typeof ArrBridgeMatchingSettings> = {
    config: { ...DEFAULT_CONFIG, arrBridgeExcludeTerms: ['trailer', 'recap'], ...configOverrides },
    onConfigChange: jest.fn(),
    sonarrConnected: false,
    radarrConnected: false,
    ...overrides,
  };
  renderWithProviders(<ArrBridgeMatchingSettings {...props} />);
  return props;
};

const summary = () => within(screen.getByRole('group', { name: 'How a video is matched' }));

describe('ArrBridgeMatchingSettings', () => {
  test('summarizes strict matching in plain language', () => {
    setup();

    expect(summary().getByText(/written like S01E05/)).toBeInTheDocument();
    expect(summary().getByText(/one of the 2 excluded words/)).toBeInTheDocument();
    expect(summary().getByText(/shorter than 10 minutes/)).toBeInTheDocument();
  });

  test('the summary changes with loose matching, and the warning appears only then', () => {
    setup({ arrBridgeLooseMatching: true });

    expect(summary().getByText(/even without a season/)).toBeInTheDocument();
    expect(screen.getByText(/Loose matching can offer the wrong video/)).toBeInTheDocument();
  });

  test('shows no warning under strict matching', () => {
    setup();

    expect(screen.queryByText(/Loose matching can offer the wrong video/)).not.toBeInTheDocument();
  });

  test('the summary mentions a Sonarr connection', () => {
    setup({}, { sonarrConnected: true });

    expect(summary().getByText(/With your Sonarr connection/)).toBeInTheDocument();
  });

  test('switching loose matching on reports it', () => {
    const props = setup();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Loose matching' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeLooseMatching: true });
  });

  test('adds an excluded word in lower case', () => {
    const props = setup();

    fireEvent.change(screen.getByLabelText('Add a word or phrase'), { target: { value: '  Fan Edit ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add word' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeExcludeTerms: ['trailer', 'recap', 'fan edit'] });
  });

  test('Enter adds the word too', () => {
    const props = setup();
    const input = screen.getByLabelText('Add a word or phrase');

    fireEvent.change(input, { target: { value: 'parody' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeExcludeTerms: ['trailer', 'recap', 'parody'] });
  });

  test('a word already in the list cannot be added again', () => {
    setup();

    fireEvent.change(screen.getByLabelText('Add a word or phrase'), { target: { value: 'Trailer' } });

    expect(screen.getByRole('button', { name: 'Add word' })).toBeDisabled();
  });

  test('removes an excluded word', () => {
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Remove trailer' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeExcludeTerms: ['recap'] });
  });

  test('restores the default words', () => {
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Restore the default words' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({
      arrBridgeExcludeTerms: DEFAULT_CONFIG.arrBridgeExcludeTerms,
    });
  });

  test('the shortest lengths report numbers', () => {
    const props = setup();

    fireEvent.change(screen.getByLabelText('Shortest episode (minutes)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Shortest movie (minutes)'), { target: { value: '45' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeMinTvMinutes: 5 });
    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeMinMovieMinutes: 45 });
  });

  test('an emptied length changes nothing, and a huge one reads as the limit', () => {
    const props = setup();
    const input = screen.getByLabelText('Shortest episode (minutes)');

    fireEvent.change(input, { target: { value: '' } });
    expect(props.onConfigChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '9999' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeMinTvMinutes: 600 });
  });

  test('0 is allowed as the shortest length', () => {
    const props = setup();

    fireEvent.change(screen.getByLabelText('Shortest movie (minutes)'), { target: { value: '0' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeMinMovieMinutes: 0 });
  });
});
