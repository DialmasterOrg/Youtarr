import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProtectionShieldButton from '../ProtectionShieldButton';

describe('ProtectionShieldButton', () => {
  test('renders unprotected state with correct tooltip', () => {
    render(<ProtectionShieldButton isProtected={false} onClick={jest.fn()} />);
    expect(screen.getByLabelText('Protect from auto-deletion')).toBeInTheDocument();
  });

  test('renders protected state with correct tooltip', () => {
    render(<ProtectionShieldButton isProtected={true} onClick={jest.fn()} />);
    expect(screen.getByLabelText('Remove protection')).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<ProtectionShieldButton isProtected={false} onClick={onClick} />);
    fireEvent.click(screen.getByLabelText('Protect from auto-deletion'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('renders inline variant', () => {
    render(<ProtectionShieldButton isProtected={false} onClick={jest.fn()} variant="inline" />);
    expect(screen.getByLabelText('Protect from auto-deletion')).toBeInTheDocument();
  });
});
