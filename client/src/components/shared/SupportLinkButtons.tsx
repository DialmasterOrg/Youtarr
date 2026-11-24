import React from 'react';
import { Button } from '../ui';
import { Heart as HeartIcon } from '../../lib/icons';

export const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/DialmasterOrg';
export const PATREON_URL = 'https://www.patreon.com/cw/ChrisDial';
export const ABOUT_PAGE_PATH = '/settings/about';

interface SupportLinkButtonsProps {
  onLinkClick?: () => void;
}

export const SupportLinkButtons: React.FC<SupportLinkButtonsProps> = ({ onLinkClick }) => (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="contained">
      <a href={GITHUB_SPONSORS_URL} target="_blank" rel="noopener noreferrer" onClick={onLinkClick}>
        <HeartIcon className="h-4 w-4" aria-hidden="true" />
        GitHub Sponsors
      </a>
    </Button>
    <Button asChild variant="outlined">
      <a href={PATREON_URL} target="_blank" rel="noopener noreferrer" onClick={onLinkClick}>
        <HeartIcon className="h-4 w-4" aria-hidden="true" />
        Patreon
      </a>
    </Button>
  </div>
);

export default SupportLinkButtons;
