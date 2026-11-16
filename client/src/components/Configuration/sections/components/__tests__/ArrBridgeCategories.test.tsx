import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeCategories } from '../ArrBridgeCategories';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrCategory } from '../../../utils/arrBridgeSetup';

jest.mock('../../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({ subfolders: ['__Shows'], loading: false, createSubfolder: jest.fn() }),
}));

// The real control is a Select with its own tests; here it only has to show
// the category's value and report a new one.
jest.mock('../../../../shared/SubfolderAutocomplete', () => {
  const React = require('react');
  return {
    __esModule: true,
    SubfolderAutocomplete: ({ label, value, onChange, mode, noOverrideLabel }: {
      label: string; value: string | null; onChange: (value: string | null) => void; mode: string;
      noOverrideLabel?: string;
    }) => React.createElement('input', {
      'aria-label': label,
      'data-mode': mode,
      'data-no-override-label': noOverrideLabel,
      value: value ?? '',
      onChange: (event: { target: { value: string } }) => onChange(event.target.value || null),
    }),
  };
});

const DEFAULTS: ArrCategory[] = [{ name: 'tv', subfolder: null }, { name: 'movies', subfolder: 'Films' }];
const WITH_4K: ArrCategory[] = [...DEFAULTS, { name: 'tv-4k', subfolder: null }];
const MORE_INSTANCES = 'I run more than one Sonarr or Radarr';

const setup = (categories: ArrCategory[] = DEFAULTS) => {
  const onChange = jest.fn();
  renderWithProviders(<ArrBridgeCategories token="session" categories={categories} onChange={onChange} />);
  return { onChange };
};

const openMoreInstances = () => fireEvent.click(screen.getByRole('button', { name: MORE_INSTANCES }));

describe('ArrBridgeCategories', () => {
  test('says in plain words where TV and movie grabs are saved', () => {
    setup();

    expect(screen.getByLabelText('TV grabs are saved to')).toHaveValue('');
    expect(screen.getByLabelText('Movie grabs are saved to')).toHaveValue('Films');
    expect(screen.getByLabelText('TV grabs are saved to')).toHaveAttribute('data-mode', 'download');
  });

  test('calls no choice Youtarr\'s normal download location, not a channel setting', () => {
    setup();

    expect(screen.getByLabelText('TV grabs are saved to'))
      .toHaveAttribute('data-no-override-label', "Youtarr's normal download location");
  });

  test('changing a subfolder reports the whole list', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('TV grabs are saved to'), { target: { value: 'Shows' } });

    expect(onChange).toHaveBeenCalledWith([{ name: 'tv', subfolder: 'Shows' }, { name: 'movies', subfolder: 'Films' }]);
  });

  describe('with the two categories Youtarr starts with', () => {
    test('keeps the second-instance controls out of the way', () => {
      setup();

      expect(screen.getByRole('button', { name: MORE_INSTANCES })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('New category name')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove tv' })).not.toBeInTheDocument();
    });

    test('opening them explains categories and offers adding and removing', () => {
      setup();

      openMoreInstances();

      expect(screen.getByRole('button', { name: MORE_INSTANCES })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/Two instances that share a category import each other's downloads/)).toBeInTheDocument();
      expect(screen.getByLabelText('New category name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove tv' })).toBeInTheDocument();
    });
  });

  test('a category the user added is named, and its controls are open from the start', () => {
    setup(WITH_4K);

    expect(screen.getByLabelText('Grabs in category tv-4k are saved to')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MORE_INSTANCES })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Remove tv-4k' })).toBeInTheDocument();
  });

  test('adds a category', () => {
    const { onChange } = setup();
    openMoreInstances();

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: ' tv-4k ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(onChange).toHaveBeenCalledWith([...DEFAULTS, { name: 'tv-4k', subfolder: null }]);
  });

  test('Enter adds the category too', () => {
    const { onChange } = setup();
    openMoreInstances();
    const input = screen.getByLabelText('New category name');

    fireEvent.change(input, { target: { value: 'anime' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([...DEFAULTS, { name: 'anime', subfolder: null }]);
  });

  test('a name that differs only by case is refused with the reason', () => {
    const { onChange } = setup();
    openMoreInstances();

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'TV' } });

    expect(screen.getByText('Each category needs a different name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('New category name'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('a name with a space is refused with the reason', () => {
    setup();
    openMoreInstances();

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'my tv' } });

    expect(screen.getByText(/Category names use letters, digits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
  });

  test('removes a category', () => {
    const { onChange } = setup(WITH_4K);

    fireEvent.click(screen.getByRole('button', { name: 'Remove tv-4k' }));

    expect(onChange).toHaveBeenCalledWith(DEFAULTS);
  });

  test('the last category cannot be removed', () => {
    setup([{ name: 'tv', subfolder: null }]);

    expect(screen.getByRole('button', { name: 'Remove tv' })).toBeDisabled();
  });

  test('no more can be added at 10', () => {
    setup(Array.from({ length: 10 }, (_, index) => ({ name: `cat${index}`, subfolder: null })));

    expect(screen.getByLabelText('New category name')).toBeDisabled();
    expect(screen.getByText('At most 10 categories.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
  });
});
