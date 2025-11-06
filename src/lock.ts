import fs from "fs";
import path from "path";

const LOCK_FILE = ".svg-lock";

/**
 * Get the absolute path to the lock file.
 *
 * @returns {string} Absolute path to .svg-lock
 */
function getLockFilePath(): string {
  return path.resolve(LOCK_FILE);
}

/**
 * Read the current locked SVG files from the lock file.
 *
 * @returns {string[]} Array of locked SVG file names.
 */
function readLockFile(): string[] {
  if (!fs.existsSync(getLockFilePath())) return [];
  try {
    const data = fs.readFileSync(getLockFilePath(), "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

/**
 * Write the list of locked SVG files to the lock file.
 *
 * @param {string[]} files - Array of SVG file names to lock.
 */
function writeLockFile(files: string[]) {
  fs.writeFileSync(getLockFilePath(), JSON.stringify(files, null, 2), "utf-8");
}

/**
 * Lock one or more SVG files to prevent them from being processed.
 *
 * @param {string[]} files - Paths to SVG files to lock.
 */
export function lockFiles(files: string[]) {
  const fileNames = files.map(f => path.basename(f));
  const current = readLockFile();
  const newFiles = Array.from(new Set([...current, ...fileNames]));
  writeLockFile(newFiles);
  console.log(`🔒 Locked files: ${newFiles.join(", ")}`);
}

/**
 * Unlock one or more SVG files, allowing them to be processed again.
 *
 * @param {string[]} files - Paths to SVG files to unlock.
 */
export function unlockFiles(files: string[]) {
  const fileNames = files.map(f => path.basename(f));
  const current = readLockFile();
  const remaining = current.filter(f => !fileNames.includes(f));
  writeLockFile(remaining);
  console.log(`🔓 Unlocked files: ${fileNames.join(", ")}`);
}

/**
 * Check if a specific SVG file is locked.
 *
 * @param {string} file - Path to the SVG file to check.
 * @returns {boolean} True if the file is locked, false otherwise.
 */
export function isLocked(file: string): boolean {
  const current = readLockFile();
  return current.includes(path.basename(file));
}
