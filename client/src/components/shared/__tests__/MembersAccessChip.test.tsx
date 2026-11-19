import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MembersAccessChip from '../MembersAccessChip';
import { renderWithProviders } from '../../../test-utils';

describe('MembersAccessChip', () => {
  test('says when the cookies can open the video', () => {
    renderWithProviders(<MembersAccessChip access="confirmed" />);
    expect(screen.getByText('Members: access')).toBeInTheDocument();
  });

  test('says when the cookies were denied', () => {
    renderWithProviders(<MembersAccessChip access="denied" />);
    expect(screen.getByText('Members: no access')).toBeInTheDocument();
  });

  test('reads a missing state as members only without cookies', () => {
    renderWithProviders(<MembersAccessChip access={undefined} />);
    expect(screen.getByText('Members only')).toBeInTheDocument();
  });

  test('explains the state on hover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MembersAccessChip access="unchecked" />);

    await user.hover(screen.getByText('Members: not checked'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(/checked on the next download, or open the video and choose Check access/);
  });
});
