# Phase 00.3 Artifact Contract

Build planning produces one deterministic artifact manifest before component generation. Each
planned artifact records its role, final filename and output path; component artifacts also carry
the framework export style and exported symbol. A build barrel is planned alongside its components,
so collisions fail before cache work, output creation, transaction journals, or staging.

## Framework exports

| Framework                          | Component module                             | Barrel declaration                                         |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| React, React Native, Solid, Preact | Default export                               | `export { default as Name }`                               |
| Vue                                | SFC default export                           | `export { default as Name } from './Name.vue'`             |
| Svelte                             | Component default export                     | `export { default as Name } from './Name.svelte'`          |
| Angular                            | Named `NameComponent` in `Name.component.ts` | `export { NameComponent as Name } from './Name.component'` |
| Lit                                | Named class `Name`                           | `export { Name }` (JavaScript uses `.js` specifiers)       |
| Vanilla                            | Named function `Name`                        | `export { Name }` (JavaScript uses `.js` specifiers)       |

The barrel is emitted as `index.ts` or `index.js` according to the selected language mode. Framework
extensions remain centralized in the framework artifact contract. Component names used in generated
source remain valid identifiers; `kebab` naming affects output filenames rather than making source
identifiers invalid.

## Collision and compatibility behavior

The planner rejects case- and Unicode-normalized output collisions, file/directory prefix conflicts,
and component names that would collide with the generated barrel stem (including `index.svg`).
Component name collisions retain the existing `E_NAME_COLLISION` diagnostic; collisions involving
planned artifacts use `E_ARTIFACT_COLLISION`. Both identify conflicting filenames and fail before
the output transaction begins.

The compiler facade and `SVGService.buildAll()` now use the same framework-aware barrel and generate
the same artifact set for their common flat-build contract. Their operational logs remain
intentionally different; the legacy builder facade also retains its deprecation warning. Single-file
generation does not create a barrel.

Repeated builds sort barrel exports by public component name, yielding stable artifact content
independent of source discovery or worker completion order.

Repository-wide lint baseline status is tracked separately in
[`phase0-quality-gates.md`](phase0-quality-gates.md); artifact changes introduce no violations in
the targeted files.
