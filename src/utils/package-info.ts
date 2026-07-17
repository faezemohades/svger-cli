import { existsSync, readFileSync, realpathSync } from 'fs';
import { dirname, resolve } from 'path';

interface PackageInfo {
  name: string;
  version: string;
}

const PACKAGE_NAME = 'svger-cli';
const PACKAGE_VERSION = '4.0.9';

let cachedPackageRoot: string | null = null;
let cachedPackageInfo: PackageInfo | null = null;

function findPackageRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = resolve(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf-8')
        ) as Partial<PackageInfo>;
        if (packageJson.name === PACKAGE_NAME) {
          return currentDir;
        }
      } catch {
        // Ignore invalid package.json files and continue searching upward.
      }
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

export function getPackageRoot(): string {
  if (cachedPackageRoot) {
    return cachedPackageRoot;
  }

  const candidateDirs = new Set<string>();

  if (process.argv[1]) {
    const entryPath = resolve(process.argv[1]);
    candidateDirs.add(
      dirname(existsSync(entryPath) ? realpathSync(entryPath) : entryPath)
    );
  }

  if (typeof require !== 'undefined' && require.main?.filename) {
    candidateDirs.add(dirname(resolve(require.main.filename)));
  }

  candidateDirs.add(process.cwd());

  for (const candidateDir of candidateDirs) {
    const packageRoot = findPackageRoot(candidateDir);
    if (packageRoot) {
      cachedPackageRoot = packageRoot;
      return packageRoot;
    }
  }

  return process.cwd();
}

export function getPackageInfo(): PackageInfo {
  if (cachedPackageInfo) {
    return cachedPackageInfo;
  }

  const packageRoot = getPackageRoot();
  const packageJsonPath = resolve(packageRoot, 'package.json');
  const packageJson = existsSync(packageJsonPath)
    ? (JSON.parse(
        readFileSync(packageJsonPath, 'utf-8')
      ) as Partial<PackageInfo>)
    : {};

  cachedPackageInfo =
    packageJson.name === PACKAGE_NAME && typeof packageJson.version === 'string'
      ? (packageJson as PackageInfo)
      : { name: PACKAGE_NAME, version: PACKAGE_VERSION };
  return cachedPackageInfo;
}
