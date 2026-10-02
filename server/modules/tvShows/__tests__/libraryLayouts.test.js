const { getLayoutResolver, LAYOUT_VIDEOS } = require('../libraryLayouts');

describe('libraryLayouts', () => {
  it('resolves the main folder and every subfolder to the videos layout', async () => {
    const layoutOf = await getLayoutResolver();
    expect(['', 'TV Shows', 'kids'].map(layoutOf)).toEqual([LAYOUT_VIDEOS, LAYOUT_VIDEOS, LAYOUT_VIDEOS]);
  });
});
