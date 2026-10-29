import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingsSection } from '../SettingsSection';
import { useContainerWidth } from '../../../../hooks/useContainerWidth';

jest.mock('../../../../hooks/useContainerWidth', () => ({ useContainerWidth: jest.fn() }));

describe('SettingsSection', () => {
  test('is a labelled section with its anchor id', () => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 900]);
    render(<SettingsSection id="naming" title="Naming" description="How files are named."><div>row</div></SettingsSection>);
    expect(screen.getByRole('region', { name: 'Naming' })).toHaveAttribute('id', 'naming');
    expect(screen.getByText('How files are named.')).toBeInTheDocument();
  });

  test('uses two columns from 720px and stacks below', () => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 900]);
    const { rerender } = render(<SettingsSection id="a" title="A"><div>row</div></SettingsSection>);
    expect(screen.getByTestId('settings-section-a')).toHaveAttribute('data-layout', 'columns');
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 500]);
    rerender(<SettingsSection id="a" title="A"><div>row</div></SettingsSection>);
    expect(screen.getByTestId('settings-section-a')).toHaveAttribute('data-layout', 'stacked');
  });
});
