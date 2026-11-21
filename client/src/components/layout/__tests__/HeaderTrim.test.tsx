import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeaderTrim } from '../HeaderTrim';
import { HeaderTrimId } from '../HeaderTrim/useHeaderTrim';

describe('HeaderTrim', () => {
  it.each<HeaderTrimId>(['christmas', 'halloween', 'july4'])('renders the %s trim', (trim) => {
    render(<HeaderTrim trim={trim} />);

    expect(screen.getByTestId('header-trim')).toHaveAttribute('data-trim', trim);
  });

  it('is hidden from assistive technology', () => {
    render(<HeaderTrim trim="christmas" />);

    expect(screen.getByTestId('header-trim')).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds spiders, skulls and bones to the halloween trim', () => {
    render(<HeaderTrim trim="halloween" />);

    expect(screen.getAllByTestId('header-trim-item')).toHaveLength(8);
  });

  it.each<HeaderTrimId>(['christmas', 'july4'])('adds no extra items to the %s trim', (trim) => {
    render(<HeaderTrim trim={trim} />);

    expect(screen.queryByTestId('header-trim-item')).not.toBeInTheDocument();
  });
});
