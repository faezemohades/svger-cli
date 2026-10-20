# Optional Dependencies

Core SVG-to-component generation does not require the visual rasterizer. The `--validate` feature
uses `pixelmatch`, `pngjs`, and a compatible `sharp` installation to rasterize and compare SVG
renderings.

## Runtime requirements

- Ordinary generation follows the package's declared Node.js floor: `>=18.17.0`.
- Rasterization requires Node.js `>=20.9.0` and `sharp >=0.35.5`.
- `sharp` is not installed automatically. This avoids selecting a native rasterizer version that is
  incompatible with the package's Node 18 generation floor.
- The loader rejects unsupported Node versions and `sharp` versions below the security floor before
  loading the native renderer. Installing an older `sharp` does not bypass this check.

The package manifest lists `pixelmatch` and `pngjs` as optional dependencies. To explicitly prepare
a project for visual validation, install the tested dependency set as development dependencies:

```sh
npm install --save-dev sharp@^0.35.5 pixelmatch pngjs
```

Then run:

```sh
svger build ./icons ./components --validate
```

On Node 18, normal SVG generation remains available, while rasterization is intentionally disabled.
If a required package is absent or incompatible, validation reports that it is unavailable and
provides installation guidance. This documentation does not claim a particular installation speed,
zero installation failures, or pixel identity across rendering environments.

## Package behavior

The rasterizer is loaded only when the visual validation path is requested. It is not a supported
public package subpath; use the CLI `--validate` option. `sharp` is not part of the automatic
package dependency set. No visual validation runs during ordinary generation or documentation page
load.

## Related documentation

- [Visual diff design](./archive/PHASE-6.3-VISUAL-DIFF-DESIGN.md)
- [Support matrix](./SUPPORT-MATRIX.md)
- [README](../README.md)

---

Last reviewed: 2026-10-20. Version 4.1.0 is planned and unreleased.
