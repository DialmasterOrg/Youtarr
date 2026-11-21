import React from 'react';
import { cn } from '../../lib/cn';
import { HeaderTrimId } from './HeaderTrim/useHeaderTrim';
import lightsTile from './HeaderTrim/assets/lights.svg';
import webTile from './HeaderTrim/assets/web.svg';
import buntingTile from './HeaderTrim/assets/bunting.svg';
import cornerWeb from './HeaderTrim/assets/corner-web.svg';
import spider from './HeaderTrim/assets/spider.svg';
import spiderOnThread from './HeaderTrim/assets/spider-thread.svg';
import skull from './HeaderTrim/assets/skull.svg';
import bone from './HeaderTrim/assets/bone.svg';

interface HeaderTrimProps {
  trim: HeaderTrimId;
}

interface TrimTile {
  src: string;
  height: number;
  edgeGap: number;
}

interface WebItem {
  key: string;
  src: string;
  left: string;
  top: number;
  width: number;
  rotate: number;
  wideOnly?: boolean;
}

// Keeps the trim off the rounded corners of an inset header.
const HEADER_CORNER_INSET = 'var(--layout-header-border-radius, 0px)';
const CORNER_WEB_SIZE = 48;
const CORNER_WEB_OVERLAP = 4;

const TRIM_TILES: Record<HeaderTrimId, TrimTile> = {
  christmas: { src: lightsTile, height: 24, edgeGap: 0 },
  halloween: { src: webTile, height: 30, edgeGap: CORNER_WEB_SIZE - CORNER_WEB_OVERLAP },
  july4: { src: buntingTile, height: 24, edgeGap: 0 },
};

const WEB_ITEMS: WebItem[] = [
  { key: 'spider-1', src: spider, left: '9%', top: 6, width: 15, rotate: 24 },
  { key: 'bone-1', src: bone, left: '21%', top: 11, width: 12, rotate: -24, wideOnly: true },
  { key: 'spider-2', src: spider, left: '33%', top: 9, width: 13, rotate: -38, wideOnly: true },
  { key: 'skull-1', src: skull, left: '46%', top: 9, width: 11, rotate: -14 },
  { key: 'bone-2', src: bone, left: '48.2%', top: 17, width: 13, rotate: 32 },
  { key: 'spider-3', src: spiderOnThread, left: '62%', top: 0, width: 17, rotate: 0 },
  { key: 'skull-2', src: skull, left: '74%', top: 6, width: 10, rotate: 16, wideOnly: true },
  { key: 'spider-4', src: spider, left: '86%', top: 1, width: 14, rotate: 160, wideOnly: true },
];

const WebExtras: React.FC = () => (
  <>
    <img src={cornerWeb} alt="" width={CORNER_WEB_SIZE} className="absolute left-0 top-0" />
    <img src={cornerWeb} alt="" width={CORNER_WEB_SIZE} className="absolute right-0 top-0 -scale-x-100" />
    {WEB_ITEMS.map((item) => (
      <img
        key={item.key}
        data-testid="header-trim-item"
        src={item.src}
        alt=""
        className={cn('absolute', item.wideOnly && 'hidden sm:block')}
        style={{
          left: item.left,
          top: item.top,
          width: item.width,
          transform: `rotate(${item.rotate}deg)`,
        }}
      />
    ))}
  </>
);

export const HeaderTrim: React.FC<HeaderTrimProps> = ({ trim }) => {
  const tile = TRIM_TILES[trim];

  return (
    <div
      aria-hidden="true"
      data-testid="header-trim"
      data-trim={trim}
      className="pointer-events-none absolute top-full"
      style={{ left: HEADER_CORNER_INSET, right: HEADER_CORNER_INSET }}
    >
      <div
        className="absolute top-0 bg-repeat-x"
        style={{
          left: tile.edgeGap,
          right: tile.edgeGap,
          height: tile.height,
          backgroundImage: `url("${tile.src}")`,
        }}
      />
      {trim === 'halloween' && <WebExtras />}
    </div>
  );
};
