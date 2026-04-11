import React, { useEffect, useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RowSettingsPopover from '../components/RowSettingsPopover';
import { RowState, DEFAULT_ROW_SETTINGS } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';

function makeRowState(overrides: Partial<RowState> = {}): RowState {
  return {
    selected: true,
    settings: { ...DEFAULT_ROW_SETTINGS },
    ...overrides,
  };
}

interface WrapperProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders?: string[];
  defaultSubfolderDisplay?: string | null;
}

const PopoverWrapper: React.FC<WrapperProps> = (props) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div>
      <div ref={anchorRef} data-testid="anchor" />
      <RowSettingsPopover
        anchorEl={props.open && mounted ? anchorRef.current : null}
        open={props.open && mounted}
        onClose={props.onClose}
        channelId={props.channelId}
        rowState={props.rowState}
        dispatch={props.dispatch}
        subfolders={props.subfolders ?? []}
        defaultSubfolderDisplay={props.defaultSubfolderDisplay ?? null}
      />
    </div>
  );
};

describe('RowSettingsPopover', () => {
  const mockDispatch = jest.fn() as jest.Mock<void, [ImportFlowAction]>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all form fields when open', async () => {
    render(
      <PopoverWrapper
        open={true}
        onClose={jest.fn()}
        channelId="ch1"
        rowState={makeRowState()}
        dispatch={mockDispatch}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Channel Settings')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Auto-download enabled')).toBeInTheDocument();
    expect(screen.getByLabelText('Video Quality')).toBeInTheDocument();
    expect(screen.getByLabelText('Subfolder')).toBeInTheDocument();
    expect(screen.getByLabelText('Content Rating')).toBeInTheDocument();
  });

  test('auto-download switch dispatches UPDATE_ROW_SETTINGS', async () => {
    render(
      <PopoverWrapper
        open={true}
        onClose={jest.fn()}
        channelId="ch1"
        rowState={makeRowState()}
        dispatch={mockDispatch}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Auto-download enabled')).toBeInTheDocument();
    });

    const switchInput = screen.getByLabelText('Auto-download enabled');
    fireEvent.click(switchInput);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ROW_SETTINGS',
      payload: {
        channelId: 'ch1',
        settings: { autoDownloadEnabled: false },
      },
    });
  });

  test('quality select shows options including "Use global default"', async () => {
    render(
      <PopoverWrapper
        open={true}
        onClose={jest.fn()}
        channelId="ch1"
        rowState={makeRowState()}
        dispatch={mockDispatch}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Video Quality')).toBeInTheDocument();
    });

    const qualitySelect = screen.getByLabelText('Video Quality');
    fireEvent.mouseDown(qualitySelect);

    const options = screen.getAllByRole('option');
    const optionTexts = options.map((opt) => opt.textContent);
    expect(optionTexts).toContain('Use global default');
    expect(optionTexts).toContain('720p');
    expect(optionTexts).toContain('1080p');
    expect(optionTexts).toContain('360p');
  });

  test('not rendered when open=false', () => {
    render(
      <PopoverWrapper
        open={false}
        onClose={jest.fn()}
        channelId="ch1"
        rowState={makeRowState()}
        dispatch={mockDispatch}
      />
    );

    expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
  });
});
