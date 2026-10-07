import React, { useId, useMemo, useState } from 'react';
import { Info } from '../../../../lib/icons';
import { Button, Dialog, DialogActions, DialogTitle, MenuItem, Select } from '../../../ui';
import { cn } from '../../../../lib/cn';
import { useLibraryPage } from '../../LibraryFoldersContext';
import { folderLabel, followersLine } from '../../folderText';
import {
  FULL_GUIDE_URL, PathKey, WATCH_STATE_FIRST, WATCH_STATE_REBUILD, YoutarrAction, detectSetup, pathOptions, pathSteps, setupLines,
} from '../../tvSetupPaths';
import { ChannelLinks } from '../ChannelLinks';
import { CopyButton } from '../CopyButton';
import { SetupBox } from '../SetupBox';

/** Start using TV shows: the detected setup, the paths that apply and their steps (UI 7.6). */
export function StartTvShowsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const page = useLibraryPage();
  const titleId = useId();
  const radioName = useId();
  const folderLabelId = useId();
  const setup = useMemo(() => detectSetup(page.folders, page.check.data, page.servers), [page.folders, page.check.data, page.servers]);
  const options = pathOptions(setup, page.servers);
  const firstAvailable = options.find((option) => !option.disabledReason)?.key ?? 'A';
  const [chosen, setChosen] = useState<PathKey>(firstAvailable);
  // The page mounts the panel only while it is open, so these start fresh on every open.
  const [cFolder, setCFolder] = useState(setup.videoSubfolders[0]?.name ?? '');
  const { mainDetail } = page;
  const followers = mainDetail ? followersLine(mainDetail.followers, mainDetail.channels.length > 0) : null;

  const steps = pathSteps(chosen, setup, { folder: cFolder });
  const act = (action: YoutarrAction) => {
    onClose();
    if (action.kind === 'addTvFolder') page.openAddFolder('tv');
    else if (action.kind === 'mainFolderTv') { page.selectFolder(''); page.openMainFolderTv(); }
    else page.selectFolder(action.folder);
  };
  const full = page.phone ? 'min-h-[44px] w-full' : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={page.phone} aria-labelledby={titleId}>
      <DialogTitle id={titleId} onClose={onClose}>Start using TV shows</DialogTitle>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 text-[13px]">
        <p>
          TV show folders save each channel as a show: Season folders by upload year, episodes numbered by upload time, an .nfo for every
          episode. Your Video folders keep working as they are.
        </p>
        <div className="rounded-ui border border-border bg-background p-3">
          <h3 className="font-semibold">Your setup now</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{setupLines(setup).map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
        <fieldset>
          <legend className="font-semibold">Choose a path</legend>
          <div className="mt-1.5 flex flex-col gap-2">
            {options.map((option) => (
              <div key={option.key} className={cn('flex flex-col gap-1 rounded-ui border p-3',
                chosen === option.key ? 'border-primary bg-primary/5' : 'border-border', option.disabledReason && 'opacity-60')}>
                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <input type="radio" name={radioName} value={option.key} checked={chosen === option.key}
                      disabled={Boolean(option.disabledReason)} onChange={() => setChosen(option.key)} />
                    <span className="font-semibold">{option.title}</span>
                    {option.recommended && <span className="rounded-ui border border-primary px-1.5 text-[11px] text-primary">Recommended</span>}
                  </span>
                  <span className="text-muted-foreground">{option.disabledReason ?? option.description}</span>
                  {option.note && <span className="text-muted-foreground">{option.note}</span>}
                </label>
                {option.key === 'C' && chosen === 'C' && (
                  <div className={cn('mt-1 flex gap-2', page.phone ? 'flex-col' : 'items-center')}>
                    <span id={folderLabelId}>Folder</span>
                    <Select value={cFolder} labelId={folderLabelId} triggerRole="combobox" size="small" fullWidth={page.phone}
                      onChange={(event) => setCFolder(String(event.target.value))}
                      className={page.phone ? 'min-h-[44px] text-[13px]' : 'h-[30px] min-h-0 text-[13px]'}>
                      {setup.videoSubfolders.map((entry) => <MenuItem key={entry.name} value={entry.name}>{folderLabel(entry.name)}</MenuItem>)}
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>
        <div>
          <h3 className="font-semibold">In Youtarr</h3>
          <ol className="mt-1 list-decimal space-y-1.5 pl-5">
            {steps.youtarr.map((step) => (
              <li key={step.text}>
                {step.text}
                {step.channelLinks && mainDetail && <> <ChannelLinks channels={mainDetail.channels} /></>}
                {step.channelLinks && followers && <span className="mt-0.5 block">{followers}</span>}
                {step.action && (
                  <div className="mt-1">
                    <Button variant="outlined" size="sm" onClick={() => act(step.action as YoutarrAction)} className={full}>{step.actionLabel}</Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
        {steps.servers.map((group) => (
          <div key={group.serverType}>
            <h3 className="font-semibold">On {group.name}</h3>
            <ol className="mt-1 list-decimal space-y-1.5 pl-5">
              {group.steps.map((step) => (
                <li key={step.text}>
                  {step.text}
                  {step.paths && step.paths.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {step.paths.map((path) => (
                        <li key={path.text} className={cn('flex items-center gap-1', path.copyable && 'font-mono text-xs')}>
                          <span className="[overflow-wrap:anywhere]">{path.text}</span>{path.copyable && <CopyButton text={path.text} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {step.after && <> {step.after}</>}
                  {step.setup && (
                    <details className="mt-1">
                      <summary className={cn('cursor-pointer text-primary', page.phone && 'min-h-[44px]')}>Library settings</summary>
                      <div className="mt-1.5"><SetupBox server={group.serverType} layout={step.setup.layout} path={step.setup.path} showCheckAgain={false} /></div>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
        <p className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />{WATCH_STATE_FIRST} {WATCH_STATE_REBUILD}
        </p>
      </div>
      <DialogActions className={cn('border-t border-border px-5 py-3', page.phone && 'flex-col gap-2')}>
        <a href={FULL_GUIDE_URL} target="_blank" rel="noopener noreferrer" className={cn('text-[13px] text-primary underline', page.phone && 'flex min-h-[44px] items-center')}>
          Read the full guide
        </a>
        {!page.phone && <span className="flex-1" />}
        <Button variant="text" onClick={onClose} className={full}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
