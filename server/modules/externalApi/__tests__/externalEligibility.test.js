const {
  effectiveRating,
  isMediaTypeEligible,
  isRatingEligible,
  normalizeExternalPolicy,
  ratingPolicy,
} = require('../externalEligibility');

describe('shared external eligibility', () => {
  const policy = {
    maxRatingLevel: 2,
    allowUnrated: false,
    allowedMediaTypes: ['video', 'short'],
  };

  test('uses the channel default only when the video rating is absent', () => {
    expect(effectiveRating(null, 'TV-Y7')).toBe('TV-Y7');
    expect(effectiveRating('', 'TV-Y7')).toBe('TV-Y7');
    expect(effectiveRating('TV-PG', 'TV-Y')).toBe('TV-PG');
  });

  test('drives the same rating allow-list used by SQL and request validation', () => {
    const ratings = ratingPolicy(policy);
    expect(ratings.allowedRatings).toContain('TV-Y7');
    expect(ratings.allowedRatings).not.toContain('TV-14');
    expect(isRatingEligible(policy, null, 'TV-Y7')).toBe(true);
    expect(isRatingEligible(policy, 'TV-14', 'TV-Y')).toBe(false);
    expect(isRatingEligible(policy, 'unknown', null)).toBe(false);
  });

  test('fails closed on invalid policy and unsupported media', () => {
    expect(() => normalizeExternalPolicy({
      ...policy,
      allowedMediaTypes: ['audio'],
    })).toThrow('Invalid external API key policy');
    expect(isMediaTypeEligible(policy, 'short')).toBe(true);
    expect(isMediaTypeEligible(policy, 'livestream')).toBe(false);
    expect(isMediaTypeEligible(policy, 'audio')).toBe(false);
  });
});
