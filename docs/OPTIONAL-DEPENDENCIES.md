# Optional Dependencies Guide

## Overview

SVGER-CLI follows a **zero-dependency philosophy** for core functionality. However, some advanced
features require optional dependencies that are only loaded when needed.

## Visual Validation Dependencies

The visual diff testing feature (`--validate` flag) requires `pixelmatch`, `pngjs`, and a compatible
`sharp` installation:

- **pixelmatch** - Pixel-perfect image comparison
- **pngjs** - PNG buffer handling
- **sharp** - SVG → PNG rendering; install separately at version `0.35.5` or newer

### Why Are These Optional?

1. **Performance**: These packages include native binaries that take time to compile during
   installation
2. **Size**: Combined package size is ~50MB
3. **Usage**: Most users don't need visual validation in their workflow
4. **Platform**: Some environments may not support native compilation

### Installation

#### Standard Users (No Visual Validation)

```bash
npm install svger-cli
# sharp is not installed automatically
# ✅ All core features work perfectly
```

#### Advanced Users (With Visual Validation)

```bash
npm install svger-cli
npm install --save-dev sharp@^0.35.5 pixelmatch pngjs
# ✅ Enables --validate flag
# ✅ Visual diff testing available
```

`sharp` is intentionally not installed automatically. The patched sharp 0.35 line requires Node
`>=20.9.0`, so SVGER disables rasterization on Node 18 to preserve the package's declared
`>=18.17.0` support for ordinary SVG generation. On Node 20.9 or newer, the loader also checks the
installed sharp version at runtime and refuses versions below `0.35.5`; manually installing an older
version does not bypass this check.

### Usage

#### Without Visual Validation

```bash
svger-cli build src/icons dist/components
# ✅ Works perfectly without optional dependencies
```

#### With Visual Validation

```bash
# Install optional dependencies first
npm install --save-dev sharp@^0.35.5 pixelmatch pngjs

# Use --validate flag
svger-cli build src/icons dist/components --validate
# ✅ Runs visual diff testing
# ✅ Ensures pixel-perfect output
```

### Error Handling

If you try to use `--validate` without installing the optional dependencies, you'll see a clear
error message:

```
Error: Visual diff validation is unavailable. It requires Node >=20.9.0 and separately installed
optional dependencies: sharp >=0.35.5, pixelmatch, and pngjs.
Install them with: npm install --save-dev sharp@^0.35.5 pixelmatch pngjs

Or skip visual validation by removing the --validate flag.
```

## Package Structure

```json
{
  "devDependencies": {
    "@types/pixelmatch": "^5.2.6",
    "@types/pngjs": "^6.0.5"
  },
  "optionalDependencies": {
    "pixelmatch": "^7.1.0",
    "pngjs": "^7.0.0"
  }
}
```

## Benefits

### For Standard Users

- ✅ `sharp` is not installed automatically, avoiding its native package installation unless visual validation is needed
- ✅ **Smaller node_modules** directory
- ✅ **All core features** work perfectly

### For Advanced Users

- ✅ **Opt-in visual validation** when needed
- ✅ **Professional quality assurance** tools
- ✅ **Pixel-perfect comparison** capabilities
- ✅ **Clear installation instructions**

## FAQ

### Q: Do I need these packages?

**A:** Only if you want to use the `--validate` flag for visual diff testing. The core
SVG-to-component conversion works perfectly without them.

### Q: What if I try to use --validate without installing them?

**A:** The command reports that visual validation is unavailable and includes installation
instructions. Ordinary generation does not require these packages.

### Q: Can I use visual validation in CI/CD?

**A:** Yes! Just add the optional dependencies to your `devDependencies` in your project's
`package.json`.

### Q: Will this affect my production builds?

**A:** No. These are development-time tools only. They don't affect your production bundle size.

### Q: What if sharp fails to install on my platform?

**A:** Simply don't use the `--validate` flag. All other features work perfectly without it.

## Technical Details

### Lazy Loading Implementation

Visual validation dependencies are loaded only when the validation path is used. The internal
`visual-diff` module is not listed as a supported package export; use the documented CLI `--validate`
option rather than importing an undeclared `svger-cli/utils/visual-diff` subpath.

## Related Documentation

- [Visual Diff Testing Design](./PHASE-6.3-VISUAL-DIFF-DESIGN.md)
- [Migration Guide](../CHANGELOG.md#401---2026-01-28)
- [Main README](../README.md)

## Support

If you encounter any issues with optional dependencies:

1. Check the error message for installation instructions
2. Visit our [GitHub Issues](https://github.com/faezemohades/svger-cli/issues)
3. Email: faezemohades@gmail.com

---

**Last Updated**: October 20, 2026 (v4.0.9)
