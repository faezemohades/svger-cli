# Generator Language Contract

The framework template engine treats `typescript` as both a source-language and artifact-extension
contract. JavaScript mode emits no TypeScript-only declarations or assertions; TypeScript mode keeps
the framework-specific typings. `getFileExtension()` is the single extension decision used by the
service and Webpack, Vite, Rollup, and Babel integrations.

| Framework                          | JavaScript                              | TypeScript                                               |
| ---------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| React, React Native, Solid, Preact | `.jsx`                                  | `.tsx`                                                   |
| Vue                                | `.vue` with a plain `<script>` block    | `.vue` with `lang="ts"` when configured for script setup |
| Svelte                             | `.svelte` with a plain `<script>` block | `.svelte` with `lang="ts"`                               |
| Lit, Vanilla                       | `.js`                                   | `.ts`                                                    |
| Angular                            | Rejected with `E_UNSUPPORTED_LANGUAGE`  | `.component.ts`                                          |

The conformance test in `tests/phase0/generator-language-contracts.test.mjs` parses every generated
source with the TypeScript parser (including embedded Vue and Svelte scripts) and checks both
language modes. It uses Babel's JavaScript parser, Vue and Svelte compilers, Angular template
parsing, and TypeScript semantic diagnostics. Angular's unsupported JavaScript combination is
asserted as an explicit diagnostic. The semantic typecheck uses narrow ambient declarations for
React-family and Lit types, while Angular uses the actual Angular core declarations. Vue and Svelte
compilers validate their complete generated component syntax.

## Phase 00.3 follow-up

The dual-path `index.ts` artifact-set and content mismatch was resolved in Phase 00.3. The
characterization now requires identical filenames and bytes for common builds; the legacy facade's
deprecation warning and service progress logs are intentionally different. See
[`phase0-artifact-contracts.md`](phase0-artifact-contracts.md) for the canonical artifact and export
contract.
