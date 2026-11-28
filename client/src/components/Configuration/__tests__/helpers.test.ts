import { getChannelFilesOptions, storageSizeToBytes } from '../helpers';

describe('Configuration Helpers', () => {
  describe('storageSizeToBytes', () => {
    test('converts gigabytes', () => {
      expect(storageSizeToBytes('500GB')).toBe(500 * 1024 ** 3);
    });

    test('converts terabytes', () => {
      expect(storageSizeToBytes('2TB')).toBe(2 * 1024 ** 4);
    });

    test('converts megabytes', () => {
      expect(storageSizeToBytes('500MB')).toBe(500 * 1024 ** 2);
    });

    test('returns null for a blank value', () => {
      expect(storageSizeToBytes('')).toBeNull();
    });

    test('returns null for an unrecognized value', () => {
      expect(storageSizeToBytes('lots')).toBeNull();
    });
  });

  describe('getChannelFilesOptions', () => {
    describe('Basic Functionality', () => {
      test('returns array with 1-10 for current value 1', () => {
        const result = getChannelFilesOptions(1);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      test('returns array with 1-10 for current value 5', () => {
        const result = getChannelFilesOptions(5);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      test('returns array with 1-10 for current value 10', () => {
        const result = getChannelFilesOptions(10);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      test('returns array length of 10 for values 1-10', () => {
        for (let i = 1; i <= 10; i++) {
          expect(getChannelFilesOptions(i)).toHaveLength(10);
        }
      });
    });

    describe('Values Greater Than 10', () => {
      test('includes current value when greater than 10', () => {
        const result = getChannelFilesOptions(15);
        expect(result).toContain(15);
      });

      test('includes 15 and maintains 1-10 for current value 15', () => {
        const result = getChannelFilesOptions(15);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]);
      });

      test('includes 20 and maintains 1-10 for current value 20', () => {
        const result = getChannelFilesOptions(20);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]);
      });

      test('includes 100 for current value 100', () => {
        const result = getChannelFilesOptions(100);
        expect(result).toContain(100);
        expect(result).toHaveLength(11);
      });

      test('returns sorted array when current value is greater than 10', () => {
        const result = getChannelFilesOptions(50);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50]);
      });

      test('array remains sorted with large current value', () => {
        const result = getChannelFilesOptions(1000);
        for (let i = 1; i < result.length; i++) {
          expect(result[i]).toBeGreaterThan(result[i - 1]);
        }
      });
    });

    describe('Edge Cases', () => {
      test('handles current value of 0', () => {
        const result = getChannelFilesOptions(0);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      test('handles negative current value', () => {
        const result = getChannelFilesOptions(-5);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      test('handles decimal current value less than 10', () => {
        const result = getChannelFilesOptions(5.5);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      test('handles decimal current value greater than 10', () => {
        const result = getChannelFilesOptions(15.7);
        expect(result).toContain(15.7);
        expect(result).toHaveLength(11);
      });
    });

    describe('Boundary Values', () => {
      test('handles value exactly at boundary (11)', () => {
        const result = getChannelFilesOptions(11);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      });

      test('handles value just below boundary (10)', () => {
        const result = getChannelFilesOptions(10);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(result).toHaveLength(10);
      });

      test('handles value just above boundary (11)', () => {
        const result = getChannelFilesOptions(11);
        expect(result).toHaveLength(11);
      });
    });

    describe('Array Properties', () => {
      test('always includes values 1 through 10', () => {
        const testValues = [1, 5, 10, 15, 50, 100];
        testValues.forEach(value => {
          const result = getChannelFilesOptions(value);
          for (let i = 1; i <= 10; i++) {
            expect(result).toContain(i);
          }
        });
      });

      test('does not include duplicates when current value is within 1-10', () => {
        const result = getChannelFilesOptions(7);
        const uniqueValues = new Set(result);
        expect(uniqueValues.size).toBe(result.length);
      });

      test('does not include duplicates when current value is above 10', () => {
        const result = getChannelFilesOptions(25);
        const uniqueValues = new Set(result);
        expect(uniqueValues.size).toBe(result.length);
      });

      test('array is always sorted in ascending order', () => {
        const testValues = [1, 5, 15, 50, 100];
        testValues.forEach(value => {
          const result = getChannelFilesOptions(value);
          for (let i = 1; i < result.length; i++) {
            expect(result[i]).toBeGreaterThan(result[i - 1]);
          }
        });
      });

      test('returns new array instance each time', () => {
        const result1 = getChannelFilesOptions(5);
        const result2 = getChannelFilesOptions(5);
        expect(result1).not.toBe(result2); // Different references
        expect(result1).toEqual(result2); // Same values
      });
    });

    describe('Large Values', () => {
      test('handles very large current value', () => {
        const result = getChannelFilesOptions(10000);
        expect(result).toContain(10000);
        expect(result[result.length - 1]).toBe(10000);
      });

      test('handles maximum safe integer', () => {
        const maxSafe = Number.MAX_SAFE_INTEGER;
        const result = getChannelFilesOptions(maxSafe);
        expect(result).toContain(maxSafe);
      });
    });

    describe('Return Value Structure', () => {
      test('returns array of numbers', () => {
        const result = getChannelFilesOptions(5);
        expect(Array.isArray(result)).toBe(true);
        result.forEach(value => {
          expect(typeof value).toBe('number');
        });
      });

      test('minimum length is 10', () => {
        const testValues = [1, 5, 10, -5, 0];
        testValues.forEach(value => {
          const result = getChannelFilesOptions(value);
          expect(result.length).toBeGreaterThanOrEqual(10);
        });
      });

      test('maximum length is 11 when current value is unique and > 10', () => {
        const result = getChannelFilesOptions(50);
        expect(result.length).toBe(11);
      });
    });

    describe('Consistency', () => {
      test('same input produces same output', () => {
        const value = 15;
        const result1 = getChannelFilesOptions(value);
        const result2 = getChannelFilesOptions(value);
        expect(result1).toEqual(result2);
      });

      test('produces consistent results for multiple calls', () => {
        for (let i = 0; i < 10; i++) {
          const result = getChannelFilesOptions(20);
          expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]);
        }
      });
    });
  });
});
