import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AudioFormatSelect } from '../AudioFormatSelect';

describe('AudioFormatSelect', () => {
  test('renders the default "Download Type" label with the video-only default', () => {
    render(<AudioFormatSelect value={null} onChange={jest.fn()} />);
    const select = screen.getByLabelText('Download Type');
    expect(select).toHaveTextContent('Video Only (default)');
  });

  test('lists the MP3 download options', async () => {
    render(<AudioFormatSelect value={null} onChange={jest.fn()} />);
    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Video + MP3' })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'MP3 Only' })).toBeInTheDocument();
  });

  test('calls onChange with the selected format', async () => {
    const onChange = jest.fn();
    render(<AudioFormatSelect value={null} onChange={onChange} />);
    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'MP3 Only' }));
    expect(onChange).toHaveBeenCalledWith('mp3_only');
  });

  test('calls onChange with null when the video-only default is selected', async () => {
    const onChange = jest.fn();
    render(<AudioFormatSelect value="mp3_only" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video Only (default)' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('renders helper text when provided', () => {
    render(
      <AudioFormatSelect
        value="mp3_only"
        onChange={jest.fn()}
        helperText="MP3 files are saved at 192kbps in the same folder as videos."
      />
    );
    expect(
      screen.getByText('MP3 files are saved at 192kbps in the same folder as videos.')
    ).toBeInTheDocument();
  });

  describe('videoOnly', () => {
    test('hides the MP3 choices', async () => {
      render(<AudioFormatSelect value={null} onChange={jest.fn()} videoOnly />);
      fireEvent.mouseDown(screen.getByLabelText('Download Type'));
      await screen.findByRole('option', { name: 'Video Only (default)' });
      expect(screen.queryByRole('option', { name: 'MP3 Only' })).not.toBeInTheDocument();
    });

    test('keeps an MP3 choice already selected so it can be changed', async () => {
      render(<AudioFormatSelect value="mp3_only" onChange={jest.fn()} videoOnly />);
      fireEvent.mouseDown(screen.getByLabelText('Download Type'));
      expect(await screen.findByRole('option', { name: 'MP3 Only' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Video + MP3' })).not.toBeInTheDocument();
    });

    test('explains why by default', () => {
      render(<AudioFormatSelect value={null} onChange={jest.fn()} videoOnly />);
      expect(screen.getByText('TV folders are video-only.')).toBeInTheDocument();
    });
  });
});
