import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAutoRemovalDryRun } from '../useAutoRemovalDryRun';
import { AutoRemovalDryRunResult } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('useAutoRemovalDryRun', () => {
  const mockToken = 'test-token-123';
  const mockConfig = {
    autoRemovalEnabled: true,
    autoRemovalVideoAgeThreshold: '30',
    autoRemovalFreeSpaceThreshold: '10',
  };

  const mockSuccessResponse: AutoRemovalDryRunResult = {
    dryRun: true,
    success: true,
    errors: [],
    plan: {
      ageStrategy: {
        enabled: true,
        thresholdDays: 30,
        threshold: null,
        thresholdBytes: null,
        candidateCount: 5,
        estimatedFreedBytes: 1073741824,
        deletedCount: 0,
        failedCount: 0,
        needsCleanup: false,
        iterations: 0,
        storageStatus: null,
        sampleVideos: [
          {
            id: 1,
            youtubeId: 'abc123',
            title: 'Old Video',
            channel: 'Test Channel',
            fileSize: 214748364,
            timeCreated: '2024-01-01T00:00:00Z',
          },
        ],
      },
      spaceStrategy: {
        enabled: true,
        thresholdDays: null,
        threshold: '10GB',
        thresholdBytes: 10737418240,
        candidateCount: 3,
        estimatedFreedBytes: 536870912,
        deletedCount: 0,
        failedCount: 0,
        needsCleanup: false,
        iterations: 0,
        storageStatus: {
          availableGB: '50.5',
          totalGB: '100.0',
          percentFree: 50.5,
          percentUsed: 49.5,
        },
        sampleVideos: [],
      },
    },
    simulationTotals: {
      byAge: 5,
      bySpace: 3,
      total: 8,
      estimatedFreedBytes: 1610612736,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('returns runDryRun function', () => {
      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      expect(result.current.runDryRun).toBeDefined();
      expect(typeof result.current.runDryRun).toBe('function');
    });

    test('works with null token', () => {
      const { result } = renderHook(() => useAutoRemovalDryRun({ token: null }));

      expect(result.current.runDryRun).toBeDefined();
      expect(typeof result.current.runDryRun).toBe('function');
    });
  });

  describe('Successful API Calls', () => {
    test('makes fetch request with correct parameters', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await result.current.runDryRun(mockConfig);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/auto-removal/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': mockToken,
        },
        body: JSON.stringify({
          autoRemovalEnabled: true,
          autoRemovalVideoAgeThreshold: '30',
          autoRemovalFreeSpaceThreshold: '10',
        }),
      });
    });

    test('returns dry run result on success', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const response = await result.current.runDryRun(mockConfig);

      expect(response).toEqual(mockSuccessResponse);
      expect(response.dryRun).toBe(true);
      expect(response.success).toBe(true);
      expect(response.plan.ageStrategy.candidateCount).toBe(5);
      expect(response.plan.spaceStrategy.candidateCount).toBe(3);
    });

    test('handles empty threshold values', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const configWithEmptyThresholds = {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '',
        autoRemovalFreeSpaceThreshold: '',
      };

      await result.current.runDryRun(configWithEmptyThresholds);

      expect(mockFetch).toHaveBeenCalledWith('/api/auto-removal/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': mockToken,
        },
        body: JSON.stringify({
          autoRemovalEnabled: true,
          autoRemovalVideoAgeThreshold: '',
          autoRemovalFreeSpaceThreshold: '',
        }),
      });
    });

    test('includes token in request headers', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const customToken = 'custom-auth-token';
      const { result } = renderHook(() => useAutoRemovalDryRun({ token: customToken }));

      await result.current.runDryRun(mockConfig);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'Content-Type': 'application/json',
        'x-access-token': customToken,
      });
    });

    test('uses empty string for token when null', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: null }));

      await result.current.runDryRun(mockConfig);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'Content-Type': 'application/json',
        'x-access-token': '',
      });
    });
  });

  describe('Error Handling', () => {
    test('throws error when response is not ok', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({
          error: 'Internal server error',
        }),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await expect(result.current.runDryRun(mockConfig)).rejects.toThrow(
        'Internal server error'
      );
    });

    test('throws default error message when no error in payload', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({}),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await expect(result.current.runDryRun(mockConfig)).rejects.toThrow(
        'Failed to preview automatic removal'
      );
    });

    test('throws error when json parsing fails', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await expect(result.current.runDryRun(mockConfig)).rejects.toThrow(
        'Failed to preview automatic removal'
      );
    });

    test('handles 401 Unauthorized error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce({
          error: 'Unauthorized',
        }),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await expect(result.current.runDryRun(mockConfig)).rejects.toThrow('Unauthorized');
    });

    test('handles 403 Forbidden error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValueOnce({
          error: 'Access forbidden',
        }),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await expect(result.current.runDryRun(mockConfig)).rejects.toThrow('Access forbidden');
    });

    test('handles network error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await expect(result.current.runDryRun(mockConfig)).rejects.toThrow('Network error');
    });
  });

  describe('Different Configuration Scenarios', () => {
    test('handles disabled auto removal', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const disabledConfig = {
        autoRemovalEnabled: false,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalFreeSpaceThreshold: '10',
      };

      await result.current.runDryRun(disabledConfig);

      expect(mockFetch).toHaveBeenCalledWith('/api/auto-removal/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': mockToken,
        },
        body: JSON.stringify({
          autoRemovalEnabled: false,
          autoRemovalVideoAgeThreshold: '30',
          autoRemovalFreeSpaceThreshold: '10',
        }),
      });
    });

    test('handles only age threshold set', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const ageOnlyConfig = {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '60',
        autoRemovalFreeSpaceThreshold: '',
      };

      await result.current.runDryRun(ageOnlyConfig);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.autoRemovalVideoAgeThreshold).toBe('60');
      expect(callBody.autoRemovalFreeSpaceThreshold).toBe('');
    });

    test('handles only space threshold set', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const spaceOnlyConfig = {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '',
        autoRemovalFreeSpaceThreshold: '20',
      };

      await result.current.runDryRun(spaceOnlyConfig);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.autoRemovalVideoAgeThreshold).toBe('');
      expect(callBody.autoRemovalFreeSpaceThreshold).toBe('20');
    });

    test('handles large threshold values', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const largeConfig = {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '365',
        autoRemovalFreeSpaceThreshold: '1000',
      };

      await result.current.runDryRun(largeConfig);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.autoRemovalVideoAgeThreshold).toBe('365');
      expect(callBody.autoRemovalFreeSpaceThreshold).toBe('1000');
    });
  });

  describe('Response Data Validation', () => {
    test('handles response with no videos to remove', async () => {
      const emptyResponse: AutoRemovalDryRunResult = {
        dryRun: true,
        success: true,
        errors: [],
        plan: {
          ageStrategy: {
            enabled: true,
            thresholdDays: 30,
            threshold: null,
            thresholdBytes: null,
            candidateCount: 0,
            estimatedFreedBytes: 0,
            deletedCount: 0,
            failedCount: 0,
            sampleVideos: [],
          },
          spaceStrategy: {
            enabled: true,
            thresholdDays: null,
            threshold: '10GB',
            thresholdBytes: 10737418240,
            candidateCount: 0,
            estimatedFreedBytes: 0,
            deletedCount: 0,
            failedCount: 0,
            sampleVideos: [],
          },
        },
        simulationTotals: {
          byAge: 0,
          bySpace: 0,
          total: 0,
          estimatedFreedBytes: 0,
        },
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(emptyResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const response = await result.current.runDryRun(mockConfig);

      expect(response.plan.ageStrategy.candidateCount).toBe(0);
      expect(response.plan.spaceStrategy.candidateCount).toBe(0);
      expect(response.simulationTotals?.total).toBe(0);
    });

    test('handles response with errors array', async () => {
      const errorResponse: AutoRemovalDryRunResult = {
        dryRun: true,
        success: false,
        errors: ['Error 1', 'Error 2'],
        plan: {
          ageStrategy: {
            enabled: false,
            thresholdDays: null,
            threshold: null,
            thresholdBytes: null,
            candidateCount: 0,
            estimatedFreedBytes: 0,
            deletedCount: 0,
            failedCount: 0,
            sampleVideos: [],
          },
          spaceStrategy: {
            enabled: false,
            thresholdDays: null,
            threshold: null,
            thresholdBytes: null,
            candidateCount: 0,
            estimatedFreedBytes: 0,
            deletedCount: 0,
            failedCount: 0,
            sampleVideos: [],
          },
        },
        simulationTotals: null,
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(errorResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const response = await result.current.runDryRun(mockConfig);

      expect(response.success).toBe(false);
      expect(response.errors).toHaveLength(2);
      expect(response.errors).toContain('Error 1');
      expect(response.errors).toContain('Error 2');
    });

    test('handles response with multiple sample videos', async () => {
      const responseWithVideos: AutoRemovalDryRunResult = {
        ...mockSuccessResponse,
        plan: {
          ...mockSuccessResponse.plan,
          ageStrategy: {
            ...mockSuccessResponse.plan.ageStrategy,
            sampleVideos: [
              {
                id: 1,
                youtubeId: 'abc123',
                title: 'Video 1',
                channel: 'Channel A',
                fileSize: 100000000,
                timeCreated: '2024-01-01T00:00:00Z',
              },
              {
                id: 2,
                youtubeId: 'def456',
                title: 'Video 2',
                channel: 'Channel B',
                fileSize: 200000000,
                timeCreated: '2024-02-01T00:00:00Z',
              },
              {
                id: 3,
                youtubeId: 'ghi789',
                title: 'Video 3',
                channel: 'Channel C',
                fileSize: 300000000,
                timeCreated: '2024-03-01T00:00:00Z',
              },
            ],
          },
        },
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(responseWithVideos),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const response = await result.current.runDryRun(mockConfig);

      expect(response.plan.ageStrategy.sampleVideos).toHaveLength(3);
      expect(response.plan.ageStrategy.sampleVideos[0].title).toBe('Video 1');
      expect(response.plan.ageStrategy.sampleVideos[1].title).toBe('Video 2');
      expect(response.plan.ageStrategy.sampleVideos[2].title).toBe('Video 3');
    });
  });

  describe('Hook Stability', () => {
    test('runDryRun function reference remains stable', () => {
      const { result, rerender } = renderHook(() =>
        useAutoRemovalDryRun({ token: mockToken })
      );

      const firstRef = result.current.runDryRun;

      rerender();

      const secondRef = result.current.runDryRun;

      expect(firstRef).toBe(secondRef);
    });

    test('runDryRun updates when token changes', () => {
      const { result, rerender } = renderHook(
        ({ token }) => useAutoRemovalDryRun({ token }),
        { initialProps: { token: 'token-1' } }
      );

      const firstRef = result.current.runDryRun;

      rerender({ token: 'token-2' });

      const secondRef = result.current.runDryRun;

      // The function reference should change when token changes
      expect(firstRef).not.toBe(secondRef);
    });

    test('can be called multiple times sequentially', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
        } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      await result.current.runDryRun(mockConfig);
      await result.current.runDryRun(mockConfig);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('handles special characters in threshold values', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const specialConfig = {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30 days',
        autoRemovalFreeSpaceThreshold: '10GB',
      };

      await result.current.runDryRun(specialConfig);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.autoRemovalVideoAgeThreshold).toBe('30 days');
      expect(callBody.autoRemovalFreeSpaceThreshold).toBe('10GB');
    });

    test('handles null simulationTotals in response', async () => {
      const responseWithNullTotals: AutoRemovalDryRunResult = {
        ...mockSuccessResponse,
        simulationTotals: null,
      };

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(responseWithNullTotals),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const response = await result.current.runDryRun(mockConfig);

      expect(response.simulationTotals).toBeNull();
    });

    test('handles response with storage status', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      } as any);

      const { result } = renderHook(() => useAutoRemovalDryRun({ token: mockToken }));

      const response = await result.current.runDryRun(mockConfig);

      expect(response.plan.spaceStrategy.storageStatus).toBeDefined();
      expect(response.plan.spaceStrategy.storageStatus?.availableGB).toBe('50.5');
      expect(response.plan.spaceStrategy.storageStatus?.totalGB).toBe('100.0');
      expect(response.plan.spaceStrategy.storageStatus?.percentFree).toBe(50.5);
    });
  });
});
