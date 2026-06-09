import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InfoHint from './InfoHint';

describe('InfoHint', () => {
  test('renders an info trigger labelled for assistive tech', () => {
    render(
      <InfoHint label="About sync">
        <span>Syncs the playlist to your servers.</span>
      </InfoHint>
    );
    expect(screen.getByRole('button', { name: 'About sync' })).toBeInTheDocument();
  });

  test('does not show the help text until hovered', () => {
    render(
      <InfoHint label="About sync">
        <span>Syncs the playlist to your servers.</span>
      </InfoHint>
    );
    expect(
      screen.queryByText('Syncs the playlist to your servers.')
    ).not.toBeInTheDocument();
  });

  test('reveals the help text on hover', async () => {
    const user = userEvent.setup();
    render(
      <InfoHint label="About sync">
        <span>Syncs the playlist to your servers.</span>
      </InfoHint>
    );

    await user.hover(screen.getByRole('button', { name: 'About sync' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Syncs the playlist to your servers.');
  });
});
