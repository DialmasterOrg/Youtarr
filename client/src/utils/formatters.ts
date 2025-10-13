export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes) {
    return '';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)}GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
};

export const decodeHtml = (html: string): string => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};
