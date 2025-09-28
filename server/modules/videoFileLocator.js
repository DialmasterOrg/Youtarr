const fs = require('fs');
const path = require('path');

const fsPromises = fs.promises;

const DEFAULT_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.m4v', '.avi'];

async function pathExists(candidatePath) {
  try {
    await fsPromises.access(candidatePath);
    return true;
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return false;
    }
    throw err;
  }
}

async function tryStat(candidatePath, triedPaths) {
  if (!candidatePath || triedPaths.has(candidatePath)) {
    return null;
  }

  triedPaths.add(candidatePath);

  try {
    const stats = await fsPromises.stat(candidatePath);
    return { path: candidatePath, stats };
  } catch (err) {
    if (!err || (err.code !== 'ENOENT' && err.code !== 'ENOTDIR')) {
      throw err;
    }
    return null;
  }
}

async function gatherChannelDirectories(baseOutputPath, channelName) {
  if (!baseOutputPath) {
    return [];
  }

  const directories = [];

  if (channelName) {
    const directChannelPath = path.join(baseOutputPath, channelName);
    if (await pathExists(directChannelPath)) {
      directories.push(directChannelPath);
    }
  }

  if (directories.length === 0) {
    try {
      const entries = await fsPromises.readdir(baseOutputPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          directories.push(path.join(baseOutputPath, entry.name));
        }
      }
    } catch (err) {
      if (!err || err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return directories;
}

async function resolveVideoFilePath({
  expectedFullPath,
  baseOutputPath,
  channelName,
  videoId,
  alternativeExtensions = []
}) {
  if (!expectedFullPath && (!baseOutputPath || !videoId)) {
    return null;
  }

  const extensions = Array.from(
    new Set([
      path.extname(expectedFullPath || ''),
      ...alternativeExtensions,
      ...DEFAULT_EXTENSIONS
    ]
      .filter(Boolean)
      .map((ext) => ext.toLowerCase()))
  );

  const triedPaths = new Set();

  if (expectedFullPath) {
    const directResult = await tryStat(expectedFullPath, triedPaths);
    if (directResult) {
      return directResult;
    }

    const baseName = expectedFullPath.slice(
      0,
      expectedFullPath.length - path.extname(expectedFullPath).length
    );

    for (const ext of extensions) {
      const candidate = `${baseName}${ext}`;
      if (candidate === expectedFullPath) {
        continue;
      }
      const result = await tryStat(candidate, triedPaths);
      if (result) {
        return result;
      }
    }
  }

  if (!baseOutputPath || !videoId) {
    return null;
  }

  const channelDirs = await gatherChannelDirectories(baseOutputPath, channelName);

  for (const channelDir of channelDirs) {
    let folderEntries;
    try {
      folderEntries = await fsPromises.readdir(channelDir, { withFileTypes: true });
    } catch (err) {
      if (!err || (err.code !== 'ENOENT' && err.code !== 'ENOTDIR')) {
        throw err;
      }
      continue;
    }

    const folderSuffix = ` - ${videoId}`;
    const candidateFolders = folderEntries.filter(
      (entry) => entry.isDirectory() && entry.name.endsWith(folderSuffix)
    );

    for (const folderEntry of candidateFolders) {
      const folderPath = path.join(channelDir, folderEntry.name);
      let fileEntries;
      try {
        fileEntries = await fsPromises.readdir(folderPath, { withFileTypes: true });
      } catch (err) {
        if (!err || err.code !== 'ENOENT') {
          throw err;
        }
        continue;
      }

      const candidateFiles = [];
      for (const fileEntry of fileEntries) {
        if (!fileEntry.isFile()) {
          continue;
        }
        const ext = path.extname(fileEntry.name).toLowerCase();
        if (!extensions.includes(ext)) {
          continue;
        }
        if (!fileEntry.name.includes(`[${videoId}]`)) {
          continue;
        }
        candidateFiles.push(path.join(folderPath, fileEntry.name));
      }

      for (const ext of extensions) {
        const match = candidateFiles.find((filePath) => path.extname(filePath).toLowerCase() === ext);
        if (!match) {
          continue;
        }
        const result = await tryStat(match, triedPaths);
        if (result) {
          return result;
        }
      }

      for (const filePathCandidate of candidateFiles) {
        const result = await tryStat(filePathCandidate, triedPaths);
        if (result) {
          return result;
        }
      }
    }
  }

  return null;
}

module.exports = {
  resolveVideoFilePath
};
