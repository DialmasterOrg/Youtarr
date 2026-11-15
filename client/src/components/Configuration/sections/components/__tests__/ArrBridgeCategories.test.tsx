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
    SubfolderAutocomplete: ({ label, value, onChange, mode }: {
      label: string; value: string | null; onChange: (value: string | null) => void; mode: string;
    }) => React.createElement('input', {
      'aria-label': label,
      'data-mode': mode,
      value: value ?? '',
      onChange: (event: { target: { value: string } }) => onChange(event.target.value || null),
    }),
  };
});

const DEFAULTS: ArrCategory[] = [{ name: 'tv', subfolder: null }, { name: 'movies', subfolder: 'Films' }];

const setup = (categories: ArrCategory[] = DEFAULTS) => {
  const onChange = jest.fn();
  renderWithProviders(<ArrBridgeCategories token="session" categories={categories} onChange={onChange} />);
  return { onChange };
};

describe('ArrBridgeCategories', () => {
  test('lists each category with where its downloads go', () => {
    setup();

    expect(screen.getByLabelText('Download tv to')).toHaveValue('');
    expect(screen.getByLabelText('Download movies to')).toHaveValue('Films');
    expect(screen.getByLabelText('Download tv to')).toHaveAttribute('data-mode', 'download');
  });

  test('changing a subfolder reports the whole list', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('Download tv to'), { target: { value: 'Shows' } });

    expect(onChange).toHaveBeenCalledWith([{ name: 'tv', subfolder: 'Shows' }, { name: 'movies', subfolder: 'Films' }]);
  });

  test('adds a category', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: ' tv-4k ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(onChange).toHaveBeenCalledWith([...DEFAULTS, { name: 'tv-4k', subfolder: null }]);
  });

  test('Enter adds the category too', () => {
    const { onChange } = setup();
    const input = screen.getByLabelText('New category name');

    fireEvent.change(input, { target: { value: 'anime' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([...DEFAULTS, { name: 'anime', subfolder: null }]);
  });

  test('a name that differs only by case is refused with the reason', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'TV' } });

    expect(screen.getByText('Each category needs a different name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('New category name'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('a name with a space is refused with the reason', () => {
    setup();

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'my tv' } });

    expect(screen.getByText(/Category names use letters, digits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
  });

  test('removes a category', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Remove movies' }));

    expect(onChange).toHaveBeenCalledWith([{ name: 'tv', subfolder: null }]);
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
