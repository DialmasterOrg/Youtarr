import { normalizePolicy, ApiKeyPolicy } from './useApiKeys';

const basePolicy: ApiKeyPolicy = {
  role: 'view',
  allowVideoRequests: false,
  allowChannelRequests: false,
  allowDeleteVideoRequests: false,
  autoApproveVideoRequests: false,
  autoApproveChannelRequests: false,
  autoApproveDeleteRequests: false,
  maxRatingLevel: 3,
  allowUnrated: false,
  allowedMediaTypes: ['video'],
  maxActiveJobs: 5,
  hourlyWriteLimit: 30,
  dailyWriteLimit: 200,
};

describe('normalizePolicy', () => {
  test.each([
    ['maxActiveJobs', '0'],
    ['hourlyWriteLimit', '31'],
    ['dailyWriteLimit', '1.5'],
    ['maxActiveJobs', ''],
  ] as const)('rejects invalid %s value %s', (field, value) => {
    const result = normalizePolicy({ ...basePolicy, [field]: value });
    expect(result.policy).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it('keeps draft strings editable and normalizes valid integer values', () => {
    const result = normalizePolicy({
      ...basePolicy,
      maxActiveJobs: '4',
      hourlyWriteLimit: '12',
      dailyWriteLimit: '180',
    });
    expect(result.error).toBeUndefined();
    expect(result.policy).toMatchObject({ maxActiveJobs: 4, hourlyWriteLimit: 12, dailyWriteLimit: 180 });
  });
});
