import { renderHook, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useCookieManagement } from '../useCookieManagement';
import { CookieStatus } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('useCookieManagement', () => {
  const mockToken = 'test-token-123';
  const mockSetConfig = jest.fn();
  const mockSetSnackbar = jest.fn();

  const mockCookieStatus: CookieStatus = {
    cookiesEnabled: true,
    customCookiesUploaded: true,
    customFileExists: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns expected functions and state', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      expect(result.current.uploadCookieFile).toBeDefined();
      expect(typeof result.current.uploadCookieFile).toBe('function');
      expect(result.current.deleteCookies).toBeDefined();
      expect(typeof result.current.deleteCookies).toBe('function');
      expect(result.current.uploadingCookie).toBe(false);
    });

    test('works with null token', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: null,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      expect(result.current.uploadCookieFile).toBeDefined();
      expect(result.current.deleteCookies).toBeDefined();
      expect(result.current.uploadingCookie).toBe(false);
    });

    test('initializes with null cookie status', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      // Initially null until useEffect runs
      expect(result.current.cookieStatus).toBeNull();
    });
  });

  describe('Cookie Status Fetching', () => {
    test('fetches cookie status on mount with valid token', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/cookies/status', {
        headers: {
          'x-access-token': mockToken,
        },
      });
      expect(result.current.cookieStatus).toEqual(mockCookieStatus);
    });

    test('does not fetch cookie status when token is null', () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      renderHook(() =>
        useCookieManagement({
          token: null,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('handles error fetching cookie status', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      expect(result.current.cookieStatus).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    test('refetches cookie status when token changes', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            ...mockCookieStatus,
            cookiesEnabled: false,
          }),
        } as any);

      const { rerender } = renderHook(
        ({ token }) =>
          useCookieManagement({
            token,
            setConfig: mockSetConfig,
            setSnackbar: mockSetSnackbar,
          }),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const newToken = 'new-token-456';
      rerender({ token: newToken });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/cookies/status', {
        headers: {
          'x-access-token': newToken,
        },
      });
    });
  });

  describe('Upload Cookie File', () => {
    const mockFile = new File(['cookie data'], 'cookies.txt', {
      type: 'text/plain',
    });

    test('uploads cookie file successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: mockCookieStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const uploadCall = mockFetch.mock.calls[1];
      expect(uploadCall[0]).toBe('/api/cookies/upload');
      expect(uploadCall[1]?.method).toBe('POST');
      expect(uploadCall[1]?.headers).toEqual({
        'x-access-token': mockToken,
      });

      const formData = uploadCall[1]?.body as FormData;
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('cookieFile')).toBe(mockFile);
    });

    test('sets uploadingCookie state during upload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  ok: true,
                  status: 200,
                  json: jest.fn().mockResolvedValueOnce({
                    cookieStatus: mockCookieStatus,
                  }),
                } as any);
              }, 100);
            })
        );

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      expect(result.current.uploadingCookie).toBe(false);

      let uploadPromise: Promise<void>;
      act(() => {
        uploadPromise = result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(result.current.uploadingCookie).toBe(true);
      });

      await act(async () => {
        await uploadPromise;
      });

      await waitFor(() => {
        expect(result.current.uploadingCookie).toBe(false);
      });
    });

    test('updates cookie status after successful upload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const updatedStatus: CookieStatus = {
        cookiesEnabled: true,
        customCookiesUploaded: true,
        customFileExists: true,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: updatedStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(result.current.cookieStatus).toEqual(updatedStatus);
      });
    });

    test('updates config state after successful upload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: mockCookieStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(mockSetConfig).toHaveBeenCalledTimes(1);
      });

      expect(mockSetConfig).toHaveBeenCalledWith(expect.any(Function));
      const setConfigCallback = mockSetConfig.mock.calls[0][0];
      const prevConfig = { cookiesEnabled: false, customCookiesUploaded: false } as any;
      const newConfig = setConfigCallback(prevConfig);

      expect(newConfig).toEqual({
        ...prevConfig,
        cookiesEnabled: mockCookieStatus.cookiesEnabled,
        customCookiesUploaded: mockCookieStatus.customCookiesUploaded,
      });
    });

    test('shows success snackbar after successful upload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: mockCookieStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Cookie file uploaded successfully',
        severity: 'success',
      });
    });

    test('handles upload error with error message from server', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValueOnce({
            error: 'Invalid cookie file format',
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Invalid cookie file format',
        severity: 'error',
      });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    test('handles upload error without error message from server', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: jest.fn().mockResolvedValueOnce({}),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to upload cookie file',
        severity: 'error',
      });
    });

    test('handles network error during upload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to upload cookie file',
        severity: 'error',
      });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    test('resets uploadingCookie state after error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      expect(result.current.uploadingCookie).toBe(false);

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(result.current.uploadingCookie).toBe(false);
      });
    });

    test('uses empty string for token when null', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          cookieStatus: mockCookieStatus,
        }),
      } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: null,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      const uploadCall = mockFetch.mock.calls[0];
      expect(uploadCall[1]?.headers).toEqual({
        'x-access-token': '',
      });
    });
  });

  describe('Delete Cookies', () => {
    test('deletes cookies successfully', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const deletedStatus: CookieStatus = {
        cookiesEnabled: false,
        customCookiesUploaded: false,
        customFileExists: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: deletedStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const deleteCall = mockFetch.mock.calls[1];
      expect(deleteCall[0]).toBe('/api/cookies');
      expect(deleteCall[1]?.method).toBe('DELETE');
      expect(deleteCall[1]?.headers).toEqual({
        'x-access-token': mockToken,
      });
    });

    test('updates cookie status after successful deletion', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const deletedStatus: CookieStatus = {
        cookiesEnabled: false,
        customCookiesUploaded: false,
        customFileExists: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: deletedStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(result.current.cookieStatus).toEqual(deletedStatus);
      });
    });

    test('updates config state after successful deletion', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const deletedStatus: CookieStatus = {
        cookiesEnabled: false,
        customCookiesUploaded: false,
        customFileExists: false,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: deletedStatus,
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(mockSetConfig).toHaveBeenCalledTimes(1);
      });

      expect(mockSetConfig).toHaveBeenCalledWith(expect.any(Function));
      const setConfigCallback = mockSetConfig.mock.calls[0][0];
      const prevConfig = { customCookiesUploaded: true } as any;
      const newConfig = setConfigCallback(prevConfig);

      expect(newConfig).toEqual({
        ...prevConfig,
        customCookiesUploaded: false,
      });
    });

    test('shows success snackbar after successful deletion', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: {
              cookiesEnabled: false,
              customCookiesUploaded: false,
              customFileExists: false,
            },
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Custom cookies deleted',
        severity: 'success',
      });
    });

    test('handles deletion error with non-ok response', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: jest.fn().mockResolvedValueOnce({}),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to delete cookies',
        severity: 'error',
      });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    test('handles network error during deletion', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledTimes(1);
      });

      expect(mockSetSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Failed to delete cookies',
        severity: 'error',
      });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    test('uses empty string for token when null', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          cookieStatus: {
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          },
        }),
      } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: null,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await act(async () => {
        await result.current.deleteCookies();
      });

      const deleteCall = mockFetch.mock.calls[0];
      expect(deleteCall[1]?.headers).toEqual({
        'x-access-token': '',
      });
    });
  });

  describe('Hook Stability', () => {
    test('uploadCookieFile function reference remains stable', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const { result, rerender } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      const firstRef = result.current.uploadCookieFile;

      rerender();

      const secondRef = result.current.uploadCookieFile;

      expect(firstRef).toBe(secondRef);
    });

    test('deleteCookies function reference remains stable', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const { result, rerender } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      const firstRef = result.current.deleteCookies;

      rerender();

      const secondRef = result.current.deleteCookies;

      expect(firstRef).toBe(secondRef);
    });

    test('functions update when token changes', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any);

      const { result, rerender } = renderHook(
        ({ token }) =>
          useCookieManagement({
            token,
            setConfig: mockSetConfig,
            setSnackbar: mockSetSnackbar,
          }),
        { initialProps: { token: 'token-1' } }
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      const firstUploadRef = result.current.uploadCookieFile;
      const firstDeleteRef = result.current.deleteCookies;

      rerender({ token: 'token-2' });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const secondUploadRef = result.current.uploadCookieFile;
      const secondDeleteRef = result.current.deleteCookies;

      expect(firstUploadRef).not.toBe(secondUploadRef);
      expect(firstDeleteRef).not.toBe(secondDeleteRef);
    });

    test('functions update when setConfig changes', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const newSetConfig = jest.fn();

      const { result, rerender } = renderHook(
        ({ setConfig }) =>
          useCookieManagement({
            token: mockToken,
            setConfig,
            setSnackbar: mockSetSnackbar,
          }),
        { initialProps: { setConfig: mockSetConfig } }
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      const firstUploadRef = result.current.uploadCookieFile;
      const firstDeleteRef = result.current.deleteCookies;

      rerender({ setConfig: newSetConfig });

      const secondUploadRef = result.current.uploadCookieFile;
      const secondDeleteRef = result.current.deleteCookies;

      expect(firstUploadRef).not.toBe(secondUploadRef);
      expect(firstDeleteRef).not.toBe(secondDeleteRef);
    });

    test('functions update when setSnackbar changes', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
      } as any);

      const newSetSnackbar = jest.fn();

      const { result, rerender } = renderHook(
        ({ setSnackbar }) =>
          useCookieManagement({
            token: mockToken,
            setConfig: mockSetConfig,
            setSnackbar,
          }),
        { initialProps: { setSnackbar: mockSetSnackbar } }
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      const firstUploadRef = result.current.uploadCookieFile;
      const firstDeleteRef = result.current.deleteCookies;

      rerender({ setSnackbar: newSetSnackbar });

      const secondUploadRef = result.current.uploadCookieFile;
      const secondDeleteRef = result.current.deleteCookies;

      expect(firstUploadRef).not.toBe(secondUploadRef);
      expect(firstDeleteRef).not.toBe(secondDeleteRef);
    });
  });

  describe('Edge Cases', () => {
    test('handles different file types', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: mockCookieStatus,
          }),
        } as any);

      const jsonFile = new File(['{"cookies": []}'], 'cookies.json', {
        type: 'application/json',
      });

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(jsonFile);
      });

      const uploadCall = mockFetch.mock.calls[1];
      const formData = uploadCall[1]?.body as FormData;
      expect(formData.get('cookieFile')).toBe(jsonFile);
    });

    test('handles large cookie files', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: mockCookieStatus,
          }),
        } as any);

      const largeContent = 'x'.repeat(1000000); // 1MB of data
      const largeFile = new File([largeContent], 'large-cookies.txt', {
        type: 'text/plain',
      });

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(largeFile);
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Cookie file uploaded successfully',
          severity: 'success',
        });
      });
    });

    test('can perform multiple operations sequentially', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const mockFile = new File(['cookies'], 'cookies.txt', {
        type: 'text/plain',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: mockCookieStatus,
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            cookieStatus: {
              cookiesEnabled: false,
              customCookiesUploaded: false,
              customFileExists: false,
            },
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      // Upload
      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(result.current.cookieStatus?.customCookiesUploaded).toBe(true);
      });

      // Delete
      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(result.current.cookieStatus?.customCookiesUploaded).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockSetSnackbar).toHaveBeenCalledTimes(2);
    });

    test('handles 401 Unauthorized error on upload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const mockFile = new File(['cookies'], 'cookies.txt', {
        type: 'text/plain',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValueOnce({
            error: 'Unauthorized',
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.uploadCookieFile(mockFile);
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Unauthorized',
          severity: 'error',
        });
      });
    });

    test('handles 403 Forbidden error on deletion', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockCookieStatus),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: jest.fn().mockResolvedValueOnce({
            error: 'Access forbidden',
          }),
        } as any);

      const { result } = renderHook(() =>
        useCookieManagement({
          token: mockToken,
          setConfig: mockSetConfig,
          setSnackbar: mockSetSnackbar,
        })
      );

      await waitFor(() => {
        expect(result.current.cookieStatus).not.toBeNull();
      });

      await act(async () => {
        await result.current.deleteCookies();
      });

      await waitFor(() => {
        expect(mockSetSnackbar).toHaveBeenCalledWith({
          open: true,
          message: 'Failed to delete cookies',
          severity: 'error',
        });
      });
    });
  });
});
