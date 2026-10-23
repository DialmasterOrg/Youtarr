import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingRow, settingDescriptionId } from '../SettingRow';
import { Switch } from '../../../ui';

describe('SettingRow', () => {
  test('labels its control and describes it', () => {
    render(
      <SettingRow controlId="subtitles" label="Subtitles" description="SRT files when available."
        control={<Switch id="subtitles" aria-describedby={settingDescriptionId('subtitles')} checked={false} />} />
    );
    expect(screen.getByRole('checkbox', { name: 'Subtitles' })).toHaveAccessibleDescription('SRT files when available.');
  });

  test('renders children under the row and a badge after the label', () => {
    render(<SettingRow controlId="x" label="X" badge={<span>Platform Managed</span>}><p>nested</p></SettingRow>);
    expect(screen.getByText('Platform Managed')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });
});
