/** Filesystem/display prefix for subfolder names. */
const SUBFOLDER_PREFIX = '__';

/** Ensure a subfolder name is shown with exactly one __ prefix. */
export function addSubfolderPrefix(name: string): string {
  return name.startsWith(SUBFOLDER_PREFIX) ? name : `${SUBFOLDER_PREFIX}${name}`;
}

/** Remove a single leading __ prefix from a subfolder name. */
export function stripSubfolderPrefix(name: string): string {
  return name.replace(/^__/, '');
}
