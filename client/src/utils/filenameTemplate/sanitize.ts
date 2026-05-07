const WINDOWS_REPLACEMENTS: Record<string, string> = {
  '<': '＜',
  '>': '＞',
  ':': '：',
  '"': '＂',
  '|': '｜',
  '?': '？',
  '*': '＊',
};

const WINDOWS_REPLACEMENT_RE = /[<>:"|?*]/g;

export function sanitizeWindowsFilename(input: string): string {
  return input.replace(WINDOWS_REPLACEMENT_RE, (ch) => WINDOWS_REPLACEMENTS[ch] ?? ch);
}
