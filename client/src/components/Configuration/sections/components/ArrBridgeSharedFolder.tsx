import React, { ChangeEvent, useId, useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '../../../ui';
import { ARR_APPS, ARR_APP_NAMES, ArrApp, ArrFolderCheck, MAX_RETENTION_DAYS } from '../../utils/arrBridgeSetup';
import { ArrBridgeNumberField } from './ArrBridgeNumberField';

interface ArrBridgeSharedFolderProps {
  /** The staging folder as the user knows it, or null when the downloads folder is unknown. */
  hostFolder: string | null;
  connected: Record<ArrApp, boolean>;
  checks: Partial<Record<ArrApp, ArrFolderCheck>>;
  checking: boolean;
  onRecheck: () => void;
  stagingPath: string;
  /** Whether the path in the field is the saved one, which is what was checked. */
  stagingPathSaved: boolean;
  onStagingPathChange: (path: string) => void;
  retentionDays: number;
  onRetentionDaysChange: (days: number) => void;
}

interface FolderCheckRowProps {
  app: ArrApp;
  connected: boolean;
  check: ArrFolderCheck | undefined;
  checking: boolean;
  hostFolder: string | null;
  /** The path in the field, saved or not. */
  stagingPath: string;
  onUsePath: (path: string) => void;
}

const PATH_EXAMPLES = { windows: 'E:\\Youtube\\.arr-staging', other: '/mnt/media/youtube/.arr-staging' };

interface FolderNotVisibleProps {
  name: string;
  check: ArrFolderCheck;
  hostFolder: string | null;
  stagingPath: string;
  onUsePath: (path: string) => void;
}

// What to do about an app that cannot see the folder. An app that sees it
// under a path Youtarr found only needs that path; otherwise the advice
// follows where the app runs: a volume only helps an app in Docker.
const FolderNotVisible: React.FC<FolderNotVisibleProps> = ({ name, check, hostFolder, stagingPath, onUsePath }) => {
  const { suggestedPath, runsIn } = check;
  const outsideDocker = runsIn === 'windows' || runsIn === 'other';

  return (
    <Alert severity="warning">
      <Typography variant="body2">
        {name} cannot see the folder at <code className="break-all">{check.path}</code>, so it will not be able to
        import a finished grab.
      </Typography>
      {suggestedPath ? (
        <Box className="mt-2 flex flex-col items-start gap-2">
          <Typography variant="body2">
            {name} does see it at <code className="break-all">{suggestedPath}</code>.
          </Typography>
          {stagingPath.trim() === suggestedPath ? (
            <Typography variant="body2">That path is in the field below. Save to use it.</Typography>
          ) : (
            <Button variant="outlined" onClick={() => onUsePath(suggestedPath)}>
              Use this path
            </Button>
          )}
        </Box>
      ) : (
        <ul className="m-0 mt-2 list-disc pl-5 text-sm">
          {!outsideDocker && (
            <li>
              If {name} runs in Docker,{' '}
              {hostFolder ? (
                <>
                  add this to its volumes: <code className="break-all">{`${hostFolder}:${check.path}`}</code>
                </>
              ) : (
                <>
                  mount that folder into {name} at <code className="break-all">{check.path}</code>.
                </>
              )}{' '}
              With the folder as a volume of its own, {name} copies the file at import instead of linking it, so the
              video takes its space twice while Youtarr keeps its copy.
            </li>
          )}
          {outsideDocker ? (
            <li>
              Enter the folder as {name} sees it below and save, for example{' '}
              <code className="break-all">{PATH_EXAMPLES[runsIn]}</code>.
            </li>
          ) : (
            <li>If {name} already sees that folder under another path, enter that path below and save.</li>
          )}
          {runsIn !== 'docker' && (
            <li>
              A Remote Path Mapping in {name} works too, in its Download Clients settings: the Host of its Youtarr
              download client, Remote Path <code className="break-all">{check.path}</code>, and as Local Path the
              folder as {name} sees it.
            </li>
          )}
        </ul>
      )}
    </Alert>
  );
};

// What one app answered. A fix is only spelled out for an app that cannot
// see the folder: most setups already share it and need to change nothing.
const FolderCheckRow: React.FC<FolderCheckRowProps> = ({
  app, connected, check, checking, hostFolder, stagingPath, onUsePath,
}) => {
  const name = ARR_APP_NAMES[app];
  let content: React.ReactNode;

  if (!connected) {
    content = (
      <Typography variant="body2" color="text.secondary">
        {name}: not checked. Connect {name} in step 3 and Youtarr checks this for you.
      </Typography>
    );
  } else if (!check || checking) {
    content = (
      <Typography variant="body2" color="text.secondary">
        Asking {name}...
      </Typography>
    );
  } else if (!check.ok) {
    content = (
      <Alert severity="warning">
        Could not ask {name}. {check.message}
      </Alert>
    );
  } else if (check.visible) {
    content = (
      <Alert severity="success">
        {check.via === 'mapping'
          ? `${name} can see the folder, through its Remote Path Mapping.`
          : `${name} can see the folder.`}
      </Alert>
    );
  } else {
    content = (
      <FolderNotVisible
        name={name}
        check={check}
        hostFolder={hostFolder}
        stagingPath={stagingPath}
        onUsePath={onUsePath}
      />
    );
  }

  return <li aria-label={`${name} folder check`}>{content}</li>;
};

/**
 * The folder Sonarr and Radarr import from. Most of the work here is the
 * check: whether each connected app really sees the folder is the step
 * that otherwise only fails at the first import.
 */
export const ArrBridgeSharedFolder: React.FC<ArrBridgeSharedFolderProps> = ({
  hostFolder,
  connected,
  checks,
  checking,
  onRecheck,
  stagingPath,
  stagingPathSaved,
  onStagingPathChange,
  retentionDays,
  onRetentionDaysChange,
}) => {
  const [pathOpened, setPathOpened] = useState(false);
  const pathPanelId = useId();
  const someAppCannotSeeIt = ARR_APPS.some((app) => checks[app]?.ok && checks[app]?.visible === false);
  const showPath = pathOpened || stagingPath !== '' || someAppCannotSeeIt;
  const anyConnected = ARR_APPS.some((app) => connected[app]);

  return (
    <Box className="flex flex-col gap-4">
      <Typography variant="body2">
        Sonarr and Radarr import a finished grab from the <code>.arr-staging</code> folder inside your downloads
        folder
        {hostFolder && (
          <>
            {' '}
            (<code className="break-all">{hostFolder}</code>)
          </>
        )}
        . They must be able to see that folder, the same way they see the folder of any other download client.
        Youtarr creates it; nothing about Youtarr&apos;s own container needs to change.
      </Typography>

      <Box className="flex flex-col gap-2">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ARR_APPS.map((app) => (
            <FolderCheckRow
              key={app}
              app={app}
              connected={connected[app]}
              check={checks[app]}
              checking={checking}
              hostFolder={hostFolder}
              stagingPath={stagingPath}
              onUsePath={onStagingPathChange}
            />
          ))}
        </ul>
        <Box>
          <Button variant="outlined" disabled={checking || !anyConnected} onClick={onRecheck}>
            Check again
          </Button>
        </Box>
      </Box>

      <Box className="flex flex-col gap-2">
        <Box>
          <Button
            variant="text"
            className="h-auto min-h-10 justify-start whitespace-normal text-left leading-snug"
            aria-expanded={showPath}
            aria-controls={pathPanelId}
            onClick={() => setPathOpened((open) => !open)}
          >
            Sonarr and Radarr see this folder under a different path
          </Button>
        </Box>
        {showPath && (
          <Box id={pathPanelId}>
            <TextField
              fullWidth
              label="The folder's path inside Sonarr and Radarr"
              value={stagingPath}
              placeholder="/downloads/.arr-staging"
              onChange={(event: ChangeEvent<HTMLInputElement>) => onStagingPathChange(event.target.value)}
              helperText={
                stagingPathSaved
                  ? 'An absolute path, such as /downloads/.arr-staging or E:\\Youtube\\.arr-staging. Leave it empty when they see the folder under the same path as Youtarr.'
                  : 'An absolute path, such as /downloads/.arr-staging or E:\\Youtube\\.arr-staging. Save to check this path.'
              }
            />
          </Box>
        )}
      </Box>

      <ArrBridgeNumberField
        label="Remove files nobody imported after (days)"
        value={retentionDays}
        min={1}
        max={MAX_RETENTION_DAYS}
        onChange={onRetentionDaysChange}
        helperText="A file Sonarr or Radarr never imported is removed from this folder after this long. Your library copy stays."
      />
    </Box>
  );
};

export default ArrBridgeSharedFolder;
