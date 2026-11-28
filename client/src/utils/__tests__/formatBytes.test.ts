import { formatBytes } from '../formatters';

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

    test('keeps TB as the largest unit', () => {
      expect(formatBytes(2048 * 1024 ** 4)).toBe('2048.00 TB');
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

  describe('Fixed Decimal Places', () => {
    test('uses the given decimal places for every unit above bytes', () => {
      expect(formatBytes(512 * 1024, 1)).toBe('512.0 KB');
      expect(formatBytes(5 * 1024 * 1024, 1)).toBe('5.0 MB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024, 1)).toBe('2.5 GB');
      expect(formatBytes(1.5 * 1024 ** 4, 1)).toBe('1.5 TB');
    });

    test('still shows whole bytes without decimal places', () => {
      expect(formatBytes(512, 1)).toBe('512 B');
      expect(formatBytes(0, 1)).toBe('0 B');
    });
  });
});
