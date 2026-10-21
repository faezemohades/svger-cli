# Sample SVGs and local testing

The repository's `assets/svges/` directory is a development corpus containing 606 SVG files. It is
used by repository tests and the optional local comparison tool. It is deliberately excluded from
the npm package, so installing `svger-cli` does not install this corpus or increase a consumer's
package footprint by these fixtures.

## Test the installed package with synthetic files

The `test-svger` executable is included in the package. It generates temporary synthetic SVG
fixtures by default, then invokes the installed SVGER CLI. Generated components go to
`./svger-test-output` unless `--output` is set. Temporary inputs are removed when the command exits.

```sh
npm install --save-dev svger-cli
npx test-svger --count 10 --framework react
npx test-svger --count 50 --framework vue --typescript --output ./tmp/vue-components
```

The count is bounded to 1–170. For your own SVGs, pass a local input directory; only its immediate
`.svg` files are considered, sorted by file name, and at most the selected count are processed.

```sh
npx test-svger --input ./assets/my-icons --count 50 --framework svelte --output ./generated
```

Run `npx test-svger --help` for current options. Angular requires TypeScript. The utility does not
benchmark another package and its elapsed command time is not a controlled performance result.

## Run the real local SVGER-CLI vs SVGR comparison

The static documentation site offers a real comparison page, but GitHub Pages cannot run Node
packages or measure process CPU/RAM. A user must explicitly start the loopback companion from a
trusted source checkout. It reads the repository corpus without copying it into package output and
runs SVGER-CLI and SVGR in separate local child processes.

```sh
npm run build
npm --prefix tools/site-benchmark ci --ignore-scripts
npm run benchmark:site
```

Open the site's `benchmark.html`, choose 50, 100, or 170, and start the run. The companion binds only
to `127.0.0.1:4317`, accepts exact fixture counts and approved browser origins, and reports actual
wall time, process CPU time, sampled peak RSS, output bytes, success/failure counts, versions, and a
fixture digest. No benchmark runs on page load; no report or source corpus is uploaded. Do not start
the tool from an untrusted checkout. See the [Pages site guide](https://github.com/faezemohades/svger-cli/blob/main/docs-site/README.md)
measurement scope and limitations.

The comparison describes the selected workload and host only. It excludes package import/startup
and filesystem writes; short RSS peaks may be missed by sampling. Different transform semantics,
configuration, Node versions, machines, thermal state, and background load can change results. No
engine is assumed to win.

## Repository-only corpus

The corpus remains in source control at `assets/svges/` for deterministic project tests and local
benchmarking. Package smoke and archive-conformance tests assert that **zero** files from
`assets/svges/` appear in the npm tarball. Do not add this path back to the root package's `files`
allowlist without a separately reviewed package-contract decision.
