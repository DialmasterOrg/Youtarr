// Playlist fetch and selection limits. Both the webpage and InnerTube fetch
// paths share this cap; channel listing limits are independent.
module.exports = {
  MAX_PLAYLIST_VIDEOS: 5000,
  MAX_SELECTED_DOWNLOAD_IDS: 1000,
  DEFAULT_PREVIEW_COUNT: 5,
  FETCH_IN_PROGRESS_MESSAGE: 'A refresh is already in progress for this playlist. Wait for it to finish, then try again.',
};
