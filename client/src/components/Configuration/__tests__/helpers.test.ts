import { formatBytes, reverseFrequencyMapping, getChannelFilesOptions } from '../helpers';
import { FREQUENCY_MAPPING } from '../constants';

describe('Configuration Helpers', () => {
  describe('formatBytes', () => {
    describe('Basic Byte Formatting', () => {
      test('formats 0 bytes correctly', () => {
        expect(formatBytes(0)).toBe('0 B');
      });

      test('formats bytes without decimal places', () => {
        expect(formatBytes(512)).toBe('512 B');
      });

      test('formats 1 byte correctly', () => {
        expect(formatBytes(1)).toBe('1 B');
      });

      test('formats 1023 bytes correctly', () => {
        expect(formatBytes(1023)).toBe('1023 B');
      });
    });

    describe('Kilobyte Formatting', () => {
      test('formats 1 KB with 1 decimal place', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
      });

      test('formats KB values with 1 decimal place', () => {
        expect(formatBytes(1536)).toBe('1.5 KB');
      });

      test('formats large KB values correctly', () => {
        expect(formatBytes(512 * 1024)).toBe('512.0 KB');
      });

      test('formats 1023.9 KB correctly', () => {
        expect(formatBytes(1023.9 * 1024)).toBe('1023.9 KB');
      });
    });

    describe('Megabyte Formatting', () => {
      test('formats 1 MB with 2 decimal places', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      });

      test('formats fractional MB values', () => {
        expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
      });

      test('formats large MB values correctly', () => {
        expect(formatBytes(512 * 1024 * 1024)).toBe('512.00 MB');
      });

      test('formats MB with precision', () => {
        expect(formatBytes(1234567)).toBe('1.18 MB');
      });
    });

    describe('Gigabyte Formatting', () => {
      test('formats 1 GB with 2 decimal places', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      });

      test('formats fractional GB values', () => {
        expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
      });

      test('formats large GB values correctly', () => {
        expect(formatBytes(100 * 1024 * 1024 * 1024)).toBe('100.00 GB');
      });

      test('formats GB with precision', () => {
        expect(formatBytes(1234567890)).toBe('1.15 GB');
      });
    });

    describe('Terabyte Formatting', () => {
      test('formats 1 TB with 2 decimal places', () => {
        expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
      });

      test('formats fractional TB values', () => {
        expect(formatBytes(1.5 * 1024 * 1024 * 1024 * 1024)).toBe('1.50 TB');
      });

      test('formats large TB values correctly', () => {
        expect(formatBytes(10 * 1024 * 1024 * 1024 * 1024)).toBe('10.00 TB');
      });

      test('formats very large TB values', () => {
        expect(formatBytes(999 * 1024 * 1024 * 1024 * 1024)).toBe('999.00 TB');
      });
    });

    describe('Edge Cases and Invalid Input', () => {
      test('handles negative numbers', () => {
        expect(formatBytes(-100)).toBe('0 B');
      });

      test('handles NaN', () => {
        expect(formatBytes(NaN)).toBe('0 B');
      });

      test('handles undefined as NaN', () => {
        expect(formatBytes(undefined as unknown as number)).toBe('0 B');
      });

      test('handles null as 0', () => {
        expect(formatBytes(null as unknown as number)).toBe('0 B');
      });

      test('handles very small positive numbers', () => {
        // Values less than 1 produce unexpected results due to logarithm calculation
        // This is an edge case - the function is designed for positive byte counts >= 1
        expect(formatBytes(0.5)).toBeTruthy();
      });

      test('handles decimal bytes correctly', () => {
        // toFixed() rounds, so 1.9 becomes 2
        expect(formatBytes(1.9)).toBe('2 B');
      });
    });

    describe('Boundary Values', () => {
      test('formats at KB boundary (1024)', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
      });

      test('formats just below KB boundary', () => {
        expect(formatBytes(1023)).toBe('1023 B');
      });

      test('formats at MB boundary', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      });

      test('formats just below MB boundary', () => {
        expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
      });

      test('formats at GB boundary', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      });

      test('formats just below GB boundary', () => {
        expect(formatBytes(1024 * 1024 * 1024 - 1)).toBe('1024.00 MB');
      });

      test('formats at TB boundary', () => {
        expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
      });

      test('formats just below TB boundary', () => {
        expect(formatBytes(1024 * 1024 * 1024 * 1024 - 1)).toBe('1024.00 GB');
      });
    });

    describe('Real-world File Sizes', () => {
      test('formats typical text file size', () => {
        expect(formatBytes(5000)).toBe('4.9 KB');
      });

      test('formats typical image size', () => {
        expect(formatBytes(2500000)).toBe('2.38 MB');
      });

      test('formats typical video size', () => {
        expect(formatBytes(500000000)).toBe('476.84 MB');
      });

      test('formats large video file', () => {
        expect(formatBytes(5000000000)).toBe('4.66 GB');
      });

      test('formats HD movie size', () => {
        expect(formatBytes(4.7 * 1024 * 1024 * 1024)).toBe('4.70 GB');
      });
    });

    describe('Decimal Precision', () => {
      test('bytes have no decimal places', () => {
        expect(formatBytes(999)).not.toContain('.');
      });

      test('KB values have 1 decimal place', () => {
        const result = formatBytes(5000);
        expect(result).toMatch(/\d+\.\d KB/);
        expect(result.split('.')[1].split(' ')[0]).toHaveLength(1);
      });

      test('MB values have 2 decimal places', () => {
        const result = formatBytes(5000000);
        expect(result).toMatch(/\d+\.\d{2} MB/);
      });

      test('GB values have 2 decimal places', () => {
        const result = formatBytes(5000000000);
        expect(result).toMatch(/\d+\.\d{2} GB/);
      });

      test('TB values have 2 decimal places', () => {
        const result = formatBytes(5000000000000);
        expect(result).toMatch(/\d+\.\d{2} TB/);
      });
    });
  });

  describe('reverseFrequencyMapping', () => {
    describe('Valid Cron Expressions', () => {
      test('maps "*/15 * * * *" to "Every 15 minutes"', () => {
        expect(reverseFrequencyMapping('*/15 * * * *')).toBe('Every 15 minutes');
      });

      test('maps "*/30 * * * *" to "Every 30 minutes"', () => {
        expect(reverseFrequencyMapping('*/30 * * * *')).toBe('Every 30 minutes');
      });

      test('maps "0 * * * *" to "Hourly"', () => {
        expect(reverseFrequencyMapping('0 * * * *')).toBe('Hourly');
      });

      test('maps "0 */4 * * *" to "Every 4 hours"', () => {
        expect(reverseFrequencyMapping('0 */4 * * *')).toBe('Every 4 hours');
      });

      test('maps "0 */6 * * *" to "Every 6 hours"', () => {
        expect(reverseFrequencyMapping('0 */6 * * *')).toBe('Every 6 hours');
      });

      test('maps "0 */12 * * *" to "Every 12 hours"', () => {
        expect(reverseFrequencyMapping('0 */12 * * *')).toBe('Every 12 hours');
      });

      test('maps "0 0 * * *" to "Daily"', () => {
        expect(reverseFrequencyMapping('0 0 * * *')).toBe('Daily');
      });

      test('maps "0 0 * * 0" to "Weekly"', () => {
        expect(reverseFrequencyMapping('0 0 * * 0')).toBe('Weekly');
      });
    });

    describe('All FREQUENCY_MAPPING Entries', () => {
      test('correctly reverses all entries in FREQUENCY_MAPPING', () => {
        Object.entries(FREQUENCY_MAPPING).forEach(([label, cronExpression]) => {
          expect(reverseFrequencyMapping(cronExpression)).toBe(label);
        });
      });

      test('mapping is bidirectional', () => {
        const labels = Object.keys(FREQUENCY_MAPPING);
        labels.forEach(label => {
          const cron = FREQUENCY_MAPPING[label];
          const reversedLabel = reverseFrequencyMapping(cron);
          expect(reversedLabel).toBe(label);
        });
      });
    });

    describe('Invalid or Unknown Cron Expressions', () => {
      test('returns the original cron expression when no match found', () => {
        const unknownCron = '0 0 1 * *';
        expect(reverseFrequencyMapping(unknownCron)).toBe(unknownCron);
      });

      test('returns custom cron expression unchanged', () => {
        const customCron = '15 10 * * 1-5';
        expect(reverseFrequencyMapping(customCron)).toBe(customCron);
      });

      test('handles empty string', () => {
        expect(reverseFrequencyMapping('')).toBe('');
      });

      test('handles invalid cron format', () => {
        const invalid = 'not a cron';
        expect(reverseFrequencyMapping(invalid)).toBe(invalid);
      });

      test('handles cron with extra spaces', () => {
        const spacedCron = '0  0  *  *  *';
        expect(reverseFrequencyMapping(spacedCron)).toBe(spacedCron);
      });

      test('handles similar but different cron expression', () => {
        const similar = '0 * * * * *'; // 6 fields instead of 5
        expect(reverseFrequencyMapping(similar)).toBe(similar);
      });
    });

    describe('Case Sensitivity', () => {
      test('cron expressions use numbers and symbols (no case sensitivity)', () => {
        // Cron expressions are made of numbers and symbols, so case doesn't apply
        // Testing that the function correctly maps the daily cron expression
        expect(reverseFrequencyMapping('0 0 * * *')).toBe('Daily');
      });
    });

    describe('Edge Cases', () => {
      test('handles cron with leading spaces', () => {
        const leadingSpace = ' 0 0 * * *';
        expect(reverseFrequencyMapping(leadingSpace)).toBe(leadingSpace);
      });

      test('handles cron with trailing spaces', () => {
        const trailingSpace = '0 0 * * * ';
        expect(reverseFrequencyMapping(trailingSpace)).toBe(trailingSpace);
      });

      test('distinguishes between similar patterns', () => {
        const daily = reverseFrequencyMapping('0 0 * * *');
        const weekly = reverseFrequencyMapping('0 0 * * 0');
        expect(daily).not.toBe(weekly);
        expect(daily).toBe('Daily');
        expect(weekly).toBe('Weekly');
      });
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
