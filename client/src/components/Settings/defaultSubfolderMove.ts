import isEqual from 'lodash/isEqual';
import { ConfigState, TRACKABLE_CONFIG_KEYS } from '../../config/configSchema';

const SAVE_AGAIN_NOTICE = 'The default subfolder changed. Save again to apply your other changes.';

/**
 * What to tell the user once a move applied the default subfolder change:
 * the rest of the form is saved by saving again, so ask only when it holds
 * other unsaved changes.
 */
export function defaultSubfolderMoveNotice(form: ConfigState, saved: ConfigState, movedTo: string): string | null {
  const savedAfterMove = { ...saved, defaultSubfolder: movedTo };
  const otherChanges = TRACKABLE_CONFIG_KEYS.some((key) => !isEqual(form[key], savedAfterMove[key]));
  return otherChanges ? SAVE_AGAIN_NOTICE : null;
}
