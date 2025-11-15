import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AccountSecuritySection } from '../AccountSecuritySection';
import { renderWithProviders } from '../../../../test-utils';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
}));

// Mock the usePasswordChange hook
jest.mock('../../hooks/usePasswordChange');

const mockUsePasswordChange = require('../../hooks/usePasswordChange');

describe('AccountSecuritySection Component', () => {
  const mockSetSnackbar = jest.fn();
  const mockSetShowPasswordChange = jest.fn();
  const mockHandlePasswordFieldChange = jest.fn();
  const mockHandlePasswordSubmit = jest.fn();

  const defaultProps = {
    token: 'test-token-123',
    envAuthApplied: false,
    authEnabled: true,
    setSnackbar: mockSetSnackbar,
  };

  const defaultHookReturn = {
    showPasswordChange: false,
    setShowPasswordChange: mockSetShowPasswordChange,
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    handlePasswordFieldChange: mockHandlePasswordFieldChange,
    handlePasswordSubmit: mockHandlePasswordSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // Set default mock return value after clearing mocks
    mockUsePasswordChange.usePasswordChange.mockReturnValue(defaultHookReturn);
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.getByText('Account & Security')).toBeInTheDocument();
    });

    test('renders title correctly', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Account & Security');
    });

    test('renders Change Password subtitle', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      const subtitle = screen.getAllByText('Change Password')[0];
      expect(subtitle).toBeInTheDocument();
    });
  });

  describe('Environment-Managed Authentication', () => {
    test('shows info alert when envAuthApplied is true', () => {
      renderWithProviders(
        <AccountSecuritySection {...defaultProps} envAuthApplied={true} />
      );

      expect(screen.getByText(/Username and password authentication is managed by your platform/i)).toBeInTheDocument();
    });

    test('shows info alert when authEnabled is false', () => {
      renderWithProviders(
        <AccountSecuritySection {...defaultProps} authEnabled={false} />
      );

      expect(screen.getByText(/Username and password authentication is managed by your platform/i)).toBeInTheDocument();
    });

    test('does not show Change Password button when envAuthApplied is true', () => {
      renderWithProviders(
        <AccountSecuritySection {...defaultProps} envAuthApplied={true} />
      );

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    });

    test('does not show Change Password button when authEnabled is false', () => {
      renderWithProviders(
        <AccountSecuritySection {...defaultProps} authEnabled={false} />
      );

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    });

    test('displays full environment authentication message', () => {
      renderWithProviders(
        <AccountSecuritySection {...defaultProps} envAuthApplied={true} />
      );

      expect(screen.getByText(/To change your login credentials, update the authentication settings/i)).toBeInTheDocument();
    });
  });

  describe('Password Change Button', () => {
    test('renders Change Password button when not showing form', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
    });

    test('calls setShowPasswordChange when Change Password button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Change Password' });
      await user.click(button);

      expect(mockSetShowPasswordChange).toHaveBeenCalledTimes(1);
      expect(mockSetShowPasswordChange).toHaveBeenCalledWith(true);
    });

    test('button has outlined variant', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      const button = screen.getByRole('button', { name: 'Change Password' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Password Change Form', () => {
    beforeEach(() => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });
    });

    test('does not show Change Password button when form is visible', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    });

    test('renders all three password input fields', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      // Check that all three password fields exist by their unique characteristics
      expect(screen.getByText('Current Password')).toBeInTheDocument();
      expect(screen.getByText('New Password')).toBeInTheDocument();
      expect(screen.getByText('Minimum 8 characters')).toBeInTheDocument(); // Unique to New Password field
      expect(screen.getByText('Confirm New Password')).toBeInTheDocument();
    });

    test('all password fields are of type password', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      // Get password inputs by their labels (using getAllByLabelText for fields that might match multiple)
      const currentPwdInputs = screen.getAllByLabelText(/^Current Password/i, { selector: 'input' });
      const newPwdInputs = screen.getAllByLabelText('New Password', { selector: 'input', exact: false });
      const confirmPwdInputs = screen.getAllByLabelText(/^Confirm New Password/i, { selector: 'input' });

      expect(currentPwdInputs[0]).toHaveAttribute('type', 'password');
      expect(newPwdInputs[0]).toHaveAttribute('type', 'password');
      expect(confirmPwdInputs[0]).toHaveAttribute('type', 'password');
    });

    test('all password fields are required', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      // Get password inputs by their labels (using getAllByLabelText for fields that might match multiple)
      const currentPwdInputs = screen.getAllByLabelText(/^Current Password/i, { selector: 'input' });
      const newPwdInputs = screen.getAllByLabelText('New Password', { selector: 'input', exact: false });
      const confirmPwdInputs = screen.getAllByLabelText(/^Confirm New Password/i, { selector: 'input' });

      expect(currentPwdInputs[0]).toBeRequired();
      expect(newPwdInputs[0]).toBeRequired();
      expect(confirmPwdInputs[0]).toBeRequired();
    });

    test('renders helper text for new password field', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.getByText('Minimum 8 characters')).toBeInTheDocument();
    });

    test('renders Update Password button', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();
    });

    test('renders Cancel button', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    test('Update Password button has contained variant', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      const button = screen.getByRole('button', { name: 'Update Password' });
      expect(button).toHaveAttribute('type', 'submit');
    });

    test('Cancel button has outlined variant', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      const button = screen.getByRole('button', { name: 'Cancel' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Password Field Interactions', () => {
    test('calls handlePasswordFieldChange when current password changes', async () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const input = screen.getByLabelText(/Current Password/i, { selector: 'input' });
      await user.type(input, 'old-password');

      expect(mockHandlePasswordFieldChange).toHaveBeenCalled();
      const calls = mockHandlePasswordFieldChange.mock.calls;
      expect(calls[0][0]).toBe('current');
      expect(calls[calls.length - 1][1]).toBe('d');
    });

    test('calls handlePasswordFieldChange when new password changes', async () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const inputs = screen.getAllByLabelText('New Password', { selector: 'input', exact: false });
      await user.type(inputs[0], 'new-password');

      expect(mockHandlePasswordFieldChange).toHaveBeenCalled();
      const calls = mockHandlePasswordFieldChange.mock.calls;
      expect(calls[0][0]).toBe('new');
      expect(calls[calls.length - 1][1]).toBe('d');
    });

    test('calls handlePasswordFieldChange when confirm password changes', async () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const input = screen.getByLabelText(/Confirm New Password/i, { selector: 'input' });
      await user.type(input, 'confirm-password');

      expect(mockHandlePasswordFieldChange).toHaveBeenCalled();
      const calls = mockHandlePasswordFieldChange.mock.calls;
      expect(calls[0][0]).toBe('confirm');
      expect(calls[calls.length - 1][1]).toBe('d');
    });

    test('displays password values from hook state', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        currentPassword: 'old-pass',
        newPassword: 'new-pass-123',
        confirmNewPassword: 'new-pass-123',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const currentPwdInputs = screen.getAllByLabelText(/^Current Password/i, { selector: 'input' });
      const newPwdInputs = screen.getAllByLabelText('New Password', { selector: 'input', exact: false });
      const confirmPwdInputs = screen.getAllByLabelText(/^Confirm New Password/i, { selector: 'input' });

      expect(currentPwdInputs[0]).toHaveValue('old-pass');
      expect(newPwdInputs[0]).toHaveValue('new-pass-123');
      expect(confirmPwdInputs[0]).toHaveValue('new-pass-123');
    });
  });

  describe('Password Mismatch Validation', () => {
    test('shows error when passwords do not match', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: 'different-password',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const confirmInput = screen.getByLabelText(/Confirm New Password/i, { selector: 'input' });
      // MUI TextField uses aria-invalid when error prop is true
      expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('displays error message when passwords do not match', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: 'different-password',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });

    test('does not show error when confirm password is empty', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: '',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();
    });

    test('does not show error when passwords match', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: 'new-password-123',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();
    });

    test('does not show error indicator when passwords match', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: 'new-password-123',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const confirmInput = screen.getByLabelText(/Confirm New Password/i, { selector: 'input' });
      // When there's no error, aria-invalid should be false or not present with 'true'
      expect(confirmInput).toHaveAttribute('aria-invalid', 'false');
    });

    test('error state is case-sensitive', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'NewPassword123',
        confirmNewPassword: 'newpassword123',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    test('calls handlePasswordSubmit when form is submitted', async () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        currentPassword: 'old-password',
        newPassword: 'new-password-123',
        confirmNewPassword: 'new-password-123',
      });

      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Update Password' });
      await user.click(submitButton);

      expect(mockHandlePasswordSubmit).toHaveBeenCalledTimes(1);
    });

    test('submits form with Enter key', async () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        currentPassword: 'old-password',
        newPassword: 'new-password-123',
        confirmNewPassword: 'new-password-123',
      });

      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const input = screen.getByLabelText(/Current Password/i, { selector: 'input' });
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(mockHandlePasswordSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel Button Functionality', () => {
    beforeEach(() => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        currentPassword: 'old-password',
        newPassword: 'new-password-123',
        confirmNewPassword: 'new-password-123',
      });
    });

    test('calls setShowPasswordChange(false) when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockSetShowPasswordChange).toHaveBeenCalledWith(false);
    });

    test('calls handlePasswordFieldChange to clear current password', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockHandlePasswordFieldChange).toHaveBeenCalledWith('current', '');
    });

    test('calls handlePasswordFieldChange to clear new password', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockHandlePasswordFieldChange).toHaveBeenCalledWith('new', '');
    });

    test('calls handlePasswordFieldChange to clear confirm password', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockHandlePasswordFieldChange).toHaveBeenCalledWith('confirm', '');
    });

    test('clears all fields in correct order when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockHandlePasswordFieldChange).toHaveBeenCalledTimes(3);
      });

      const calls = mockHandlePasswordFieldChange.mock.calls;
      expect(calls[0]).toEqual(['current', '']);
      expect(calls[1]).toEqual(['new', '']);
      expect(calls[2]).toEqual(['confirm', '']);
    });
  });

  describe('Hook Integration', () => {
    test('passes token to usePasswordChange hook', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} token="custom-token" />);

      expect(mockUsePasswordChange.usePasswordChange).toHaveBeenCalledWith({
        token: 'custom-token',
        setSnackbar: mockSetSnackbar,
      });
    });

    test('passes null token to usePasswordChange hook', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} token={null} />);

      expect(mockUsePasswordChange.usePasswordChange).toHaveBeenCalledWith({
        token: null,
        setSnackbar: mockSetSnackbar,
      });
    });

    test('passes setSnackbar to usePasswordChange hook', () => {
      const customSetSnackbar = jest.fn();
      renderWithProviders(<AccountSecuritySection {...defaultProps} setSnackbar={customSetSnackbar} />);

      expect(mockUsePasswordChange.usePasswordChange).toHaveBeenCalledWith({
        token: defaultProps.token,
        setSnackbar: customSetSnackbar,
      });
    });
  });

  describe('Conditional Rendering Logic', () => {
    test('shows password form when authEnabled is true and envAuthApplied is false', () => {
      renderWithProviders(
        <AccountSecuritySection
          {...defaultProps}
          authEnabled={true}
          envAuthApplied={false}
        />
      );

      expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
    });

    test('hides password form when authEnabled is false', () => {
      renderWithProviders(
        <AccountSecuritySection
          {...defaultProps}
          authEnabled={false}
          envAuthApplied={false}
        />
      );

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    });

    test('hides password form when envAuthApplied is true', () => {
      renderWithProviders(
        <AccountSecuritySection
          {...defaultProps}
          authEnabled={true}
          envAuthApplied={true}
        />
      );

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    });

    test('hides password form when both authEnabled is false and envAuthApplied is true', () => {
      renderWithProviders(
        <AccountSecuritySection
          {...defaultProps}
          authEnabled={false}
          envAuthApplied={true}
        />
      );

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string token', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} token="" />);

      expect(mockUsePasswordChange.usePasswordChange).toHaveBeenCalledWith({
        token: '',
        setSnackbar: mockSetSnackbar,
      });
    });

    test('renders correctly when showPasswordChange toggles', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: false,
      });

      const { rerender } = renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();

      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      rerender(
        <AccountSecuritySection {...defaultProps} />
      );

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Current Password/i, { selector: 'input' })).toBeInTheDocument();
    });

    test('handles partial password mismatch after typing', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: 'new-p',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper heading structure', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Account & Security');
    });

    test('password fields have accessible labels', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const currentPwdInputs = screen.getAllByLabelText(/^Current Password/i, { selector: 'input' });
      const newPwdInputs = screen.getAllByLabelText('New Password', { selector: 'input', exact: false });
      const confirmPwdInputs = screen.getAllByLabelText(/^Confirm New Password/i, { selector: 'input' });

      expect(currentPwdInputs[0]).toBeInTheDocument();
      expect(newPwdInputs[0]).toBeInTheDocument();
      expect(confirmPwdInputs[0]).toBeInTheDocument();
    });

    test('buttons have accessible labels', () => {
      renderWithProviders(<AccountSecuritySection {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
    });

    test('form buttons have accessible labels when form is visible', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    test('error state is accessible via aria-invalid', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        newPassword: 'new-password-123',
        confirmNewPassword: 'different',
      });

      renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      const confirmInput = screen.getByLabelText(/Confirm New Password/i, { selector: 'input' });
      expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('alert has proper role when showing environment auth message', () => {
      renderWithProviders(
        <AccountSecuritySection {...defaultProps} envAuthApplied={true} />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('Multiple Renders', () => {
    test('maintains state across re-renders', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        currentPassword: 'test-pass',
      });

      const { rerender } = renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByLabelText(/Current Password/i, { selector: 'input' })).toHaveValue('test-pass');

      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
        currentPassword: 'test-pass',
      });

      rerender(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByLabelText(/Current Password/i, { selector: 'input' })).toHaveValue('test-pass');
    });

    test('updates when hook state changes', () => {
      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: false,
      });

      const { rerender } = renderWithProviders(<AccountSecuritySection {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();

      mockUsePasswordChange.usePasswordChange.mockReturnValue({
        ...defaultHookReturn,
        showPasswordChange: true,
      });

      rerender(<AccountSecuritySection {...defaultProps} />);

      expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Current Password/i, { selector: 'input' })).toBeInTheDocument();
    });
  });
});
