# Framework Generation Guide

SVGER-CLI generates framework source files from admitted SVG input. The list below describes
implemented legacy generation targets; it is not a claim that every generated artifact has been
validated against every framework version. See the [support matrix](SUPPORT-MATRIX.md) for the
release-gated checks.

## Targets

| Target       | Typical output  | Production status                                                  |
| ------------ | --------------- | ------------------------------------------------------------------ |
| React        | `.tsx` / `.jsx` | Legacy generator                                                   |
| React Native | `.tsx` / `.jsx` | Legacy generator                                                   |
| Vue          | `.vue`          | Legacy generator                                                   |
| Angular      | `.ts`           | Legacy generator                                                   |
| Svelte       | `.svelte`       | Legacy generator by default; optional `ir-v1` mode described below |
| Solid        | `.tsx` / `.jsx` | Legacy generator                                                   |
| Preact       | `.tsx` / `.jsx` | Legacy generator                                                   |
| Lit          | `.ts` / `.js`   | Legacy generator                                                   |
| Vanilla      | `.ts` / `.js`   | Legacy generator                                                   |

The Phase 04 IR emitters for frameworks other than Svelte are experimental and are not routed
through production generation.

## CLI

```sh
svger build ./icons ./components --framework react --typescript
svger build ./icons ./components --framework vue --no-typescript
svger generate ./icons/search.svg ./components --framework svelte --no-typescript
```

Use `svger build --help` for the installed command's complete options. TypeScript is the CLI
default; `--no-typescript` requests JavaScript output. Framework-specific language constraints are
validated and report an actionable diagnostic when unsupported.

## Svelte compiler modes

The planned 4.1.0 source adds `svelteCompiler: "ir-v1"` as an opt-in configuration setting. It is
available only when `framework` is `svelte`; omitting it selects the legacy generator. There is no
dedicated CLI flag, so set it in `.svgconfig.json`:

```json
{
  "framework": "svelte",
  "typescript": false,
  "svelteCompiler": "ir-v1"
}
```

The public compiler service accepts the same option:

```js
await compiler.build({
  src: './icons',
  out: './components',
  framework: 'svelte',
  typescript: false,
  svelteCompiler: 'ir-v1',
});
```

`ir-v1` lowers admitted static SVG through the bounded internal IR. It fails explicitly for input
outside its qualified subset and does not fall back to legacy generation. Its output contract is not
a claim of full dynamic Svelte, browser rendering, CSS-cascade, or accessibility equivalence.

## Input safety and optimization

All public generation paths use the SVG admission policy before generation. Unsafe active content is
rejected by default. `unsafeInputPolicy: "strip"` is an explicit compatibility escape hatch that
warns and removes selected constructs; it is not a complete sanitizer. Optimization remains
independent of framework selection. See [SVG input security](phase0-svg-input-security.md) and the
[optimizer guide](QUICK-REFERENCE.md).

## Evidence

Run `npm run test:phase4` for Svelte IR generation, compatibility, native compilation, and build
contracts. The [local evaluation guide](EVALUATION.md) describes reproducible performance, quality,
and security measurements. Historical benchmark files are retained as records but are not current
performance guarantees.
