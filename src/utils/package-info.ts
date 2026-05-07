import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

interface PackageInfo {
  name: string;
  version: string;
}

const PACKAGE_NAME = 'svger-cli';

let cachedPackageRoot: string | null = null;
let cachedPackageInfo: PackageInfo | null = null;

function findPackageRoot(startDir: string): string | null {
  let currentDir = startDir;
  let fallbackRoot: string | null = null;

  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = resolve(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      if (!fallbackRoot) {
        fallbackRoot = currentDir;
      }

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

  return fallbackRoot;
}

export function getPackageRoot(): string {
  if (cachedPackageRoot) {
    return cachedPackageRoot;
  }

  const candidateDirs = new Set<string>();

  if (process.argv[1]) {
    candidateDirs.add(dirname(resolve(process.argv[1])));
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

  cachedPackageRoot = process.cwd();
  return cachedPackageRoot;
}

export function getPackageInfo(): PackageInfo {
  if (cachedPackageInfo) {
    return cachedPackageInfo;
  }

  const packageJsonPath = resolve(getPackageRoot(), 'package.json');
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf-8')
  ) as PackageInfo;

  cachedPackageInfo = packageJson;
  return packageJson;
}
