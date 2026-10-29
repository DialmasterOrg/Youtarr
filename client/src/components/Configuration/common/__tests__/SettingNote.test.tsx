import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingNote } from '../SettingNote';

describe('SettingNote', () => {
  test('renders its text in both tones', () => {
    render(<><SettingNote tone="info">Info text</SettingNote><SettingNote tone="warning">Warning text</SettingNote></>);
    expect(screen.getByText('Info text')).toBeInTheDocument();
    expect(screen.getByText('Warning text')).toHaveClass('text-warning');
  });
});
