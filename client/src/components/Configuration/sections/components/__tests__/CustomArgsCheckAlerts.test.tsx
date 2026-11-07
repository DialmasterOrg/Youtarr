import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CustomArgsCheckAlerts } from '../CustomArgsCheckAlerts';
import { renderWithProviders } from '../../../../../test-utils';
import { CustomArgEntry, CustomArgsCheck } from '../../../types';

const EXEC: CustomArgEntry = { given: '--exec', option: '--exec', reason: 'can run programs or load code on the server' };
const EXTRACT: CustomArgEntry = { given: '-x', option: '--extract-audio', reason: 'this turns every video download into an audio-only file' };

const renderAlerts = (check: Partial<CustomArgsCheck>, blockedNote?: string) =>
  renderWithProviders(
    <CustomArgsCheckAlerts
      check={check}
      blockedTitle='Blocked title'
      errorsTitle='Errors title'
      warningsTitle='Warnings title'
      blockedNote={blockedNote}
    />
  );

describe('CustomArgsCheckAlerts', () => {
  test('renders no alert for a clean check', () => {
    renderAlerts({ blocked: [], warnings: [], errors: [] });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('lists blocked options with what the user typed and the reason', () => {
    renderAlerts({ blocked: [EXEC] });
    expect(screen.getByText('Blocked title')).toBeInTheDocument();
    expect(screen.getByText('--exec')).toBeInTheDocument();
    expect(screen.getByText(/can run programs or load code/)).toBeInTheDocument();
  });

  test('shows the blocked note when nothing else was dropped', () => {
    renderAlerts({ blocked: [EXEC], errors: [] }, 'The rest still apply.');
    expect(screen.getByText('The rest still apply.')).toBeInTheDocument();
  });

  test('hides the blocked note when a parse error also dropped options', () => {
    renderAlerts({ blocked: [EXEC], errors: ['--format needs a value but none was given.'] }, 'The rest still apply.');
    expect(screen.queryByText('The rest still apply.')).not.toBeInTheDocument();
  });

  test('lists each parse error', () => {
    renderAlerts({ errors: ['--format needs a value but none was given.', '"stray" looks like a positional argument.'] });
    expect(screen.getByText('Errors title')).toBeInTheDocument();
    expect(screen.getByText('--format needs a value but none was given.')).toBeInTheDocument();
    expect(screen.getByText('"stray" looks like a positional argument.')).toBeInTheDocument();
  });

  test('lists a repeated option once per occurrence', () => {
    renderAlerts({ blocked: [EXEC, EXEC] });
    expect(screen.getAllByText(/can run programs or load code/)).toHaveLength(2);
  });

  test('lists warnings under the warnings title', () => {
    renderAlerts({ warnings: [EXTRACT] });
    expect(screen.getByText('Warnings title')).toBeInTheDocument();
    expect(screen.getByText(/audio-only file/)).toBeInTheDocument();
  });
});
