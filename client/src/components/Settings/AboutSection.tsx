import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Typography } from '../ui';
import { ConfigurationCard } from '../Configuration/common/ConfigurationCard';
import { SupportLinkButtons } from '../shared/SupportLinkButtons';
import packageJson from '../../../package.json';

const DOCS_URL = 'https://dialmasterorg.github.io/Youtarr/';
const GITHUB_URL = 'https://github.com/DialmasterOrg/Youtarr';
const DISCORD_URL = 'https://discord.gg/68rvWnYMtD';

const EXTERNAL_LINKS = [
  { label: 'Documentation', href: DOCS_URL },
  { label: 'GitHub', href: GITHUB_URL },
  { label: 'Discord', href: DISCORD_URL },
];

const LINK_CLASS_NAME = 'text-primary underline';

export function AboutSection() {
  return (
    <div className="flex flex-col">
      <ConfigurationCard title="About Youtarr">
        <div className="flex flex-col gap-3">
          <Typography variant="body2">
            Youtarr automatically downloads videos from the YouTube channels and playlists you follow, and
            organizes them for Plex, Jellyfin and Emby. It is free and open source.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Version v{packageJson.version}
          </Typography>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {EXTERNAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS_NAME}
              >
                {link.label}
              </a>
            ))}
            <RouterLink to="/changelog" className={LINK_CLASS_NAME}>
              Changelog
            </RouterLink>
          </div>
        </div>
      </ConfigurationCard>

      <ConfigurationCard title="How Youtarr started">
        <div className="flex flex-col gap-3">
          <Typography variant="body2">
            Youtarr started around 2021 as a parenting project: I didn't like what my kids were exposed to on
            YouTube. The first version was nothing more than a handful of shell scripts wrapped around yt-dlp
            that automatically downloaded videos from a list of channels.
          </Typography>
          <Typography variant="body2">
            Those scripts kept growing... They gained features, then a web UI, and by 2023 Youtarr had become
            something I thought other people might find useful too, so I published it on GitHub.
          </Typography>
          <Typography variant="body2">
            It has not stopped growing since. What began as a tool for just me is now shaped by the ideas, bug
            reports and contributions of the people who use it.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chris Dial
          </Typography>
        </div>
      </ConfigurationCard>

      <ConfigurationCard title="Support Youtarr">
        <div className="flex flex-col gap-3">
          <Typography variant="body2">
            Youtarr is built and maintained in my spare time. If it is useful to you, please consider supporting
            its development. Every contribution helps keep the project free and actively developed.
          </Typography>
          <SupportLinkButtons />
        </div>
      </ConfigurationCard>
    </div>
  );
}

export default AboutSection;
