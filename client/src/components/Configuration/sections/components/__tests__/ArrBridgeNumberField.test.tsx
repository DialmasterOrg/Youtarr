import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeNumberField } from '../ArrBridgeNumberField';
import { renderWithProviders } from '../../../../../test-utils';

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeNumberField>> = {}) => {
  const props: React.ComponentProps<typeof ArrBridgeNumberField> = {
    label: 'Keep staged files for (days)',
    value: 7,
    min: 1,
    max: 365,
    onChange: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeNumberField {...props} />);
  return props;
};

const field = () => screen.getByLabelText('Keep staged files for (days)');
const type = (value: string) => fireEvent.change(field(), { target: { value } });

describe('ArrBridgeNumberField', () => {
  test('shows the saved value', () => {
    setup();

    expect(field()).toHaveValue(7);
  });

  test('reports a typed number', () => {
    const props = setup();

    type('14');

    expect(props.onChange).toHaveBeenCalledWith(14);
  });

  // Emptying the field is how a number is retyped. It must not turn into 0,
  // which is out of range for some settings and blocks Save.
  test('can be emptied while typing, without reporting a value', () => {
    const props = setup();

    type('');

    expect(field()).toHaveValue(null);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  test('shows the saved value again when left empty', () => {
    setup();

    type('');
    fireEvent.blur(field());

    expect(field()).toHaveValue(7);
  });

  test.each([
    ['9999', 365],
    ['0', 1],
    ['-5', 1],
    ['2.6', 3],
  ])('reports %p as %p', (typed, reported) => {
    const props = setup();

    type(typed);

    expect(props.onChange).toHaveBeenCalledWith(reported);
  });

  test('shows the corrected value after leaving the field', () => {
    const props = setup();

    type('9999');
    expect(props.onChange).toHaveBeenCalledWith(365);
    fireEvent.blur(field());

    // The parent has not re-rendered with the new value in this test.
    expect(field()).toHaveValue(7);
  });
});
