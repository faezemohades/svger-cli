# SVGER-CLI v4.1 Support Matrix

This matrix is the Phase 1 compatibility contract. Versions outside the matrix may work but are not
release-gated.

## Runtime and operating systems

| Runtime           | Ubuntu             | Windows            | macOS              | Status                                     |
| ----------------- | ------------------ | ------------------ | ------------------ | ------------------------------------------ |
| Node 18.17.0      | Core compatibility | Core compatibility | Core compatibility | v4 compatibility floor; Node itself is EOL |
| Node 22.x LTS     | Full               | Full               | Full               | Production supported                       |
| Node 24.x LTS     | Full               | Full               | Full               | Primary production line                    |
| Node 26.x Current | Full               | Full               | Full               | Current-line support                       |

Node 18.17 remains only because the published v4 package contract declares `>=18.17.0`. It no longer
receives upstream Node security fixes and is not recommended for production. Node 20 is EOL and is
not a release-gated line. Production users should use Node 22 or 24 LTS. Runtime status is tracked
against the [official Node.js release table](https://nodejs.org/en/about/previous-releases).

CI runs the core Phase 1 suite on all twelve runtime/OS combinations.

## TypeScript

| TypeScript | Status                         | Gate                 |
| ---------- | ------------------------------ | -------------------- |
| 5.6.3      | Minimum compiler compatibility | `tsc --noEmit`       |
| 5.9.3      | Primary compiler               | Full type/build gate |
| 7.0.2      | Current compiler compatibility | `tsc --noEmit`       |

The project uses `moduleResolution: Bundler`, which is supported across this range and avoids the
removed `node10` resolution alias in TypeScript 7.

## Framework adapters

SVGER-CLI generates source without taking runtime framework dependencies. Phase 1 gates the built-in
adapter contracts for React/React Native, Vue 3, Angular 17+, Svelte 4+, Solid 1, Preact 10, Lit 3,
and standards-based vanilla output. Compilation and runtime-render conformance against exact
upstream framework patch versions is the separately gated Phase 2 conformance program.

## Build-tool integrations

| Integration | Supported major line |
| ----------- | -------------------- |
| Webpack     | 5                    |
| Vite        | 6–8                  |
| Rollup      | 4                    |
| Babel       | 7                    |
| Next.js     | 14–16                |
| Jest        | 29–30                |

The release gate runs the repository's integration contracts and tarball consumer smoke test. An
integration outside these lines requires an explicit compatibility review.

## Matrix change policy

- Removing a supported runtime or renumbering an existing exit code requires a major release.
- Adding a runtime, operating system, compiler, framework, or bundler line is a minor change.
- CI and this document must change in the same reviewed commit.
