# v4.0.9 Phase 0 containment migration notice

v4.0.9 is a security and correctness patch. Safe SVGs retain the recorded v4.0.8 component output.
Three previously accepted behaviors now fail closed.

## Unsafe raw SVG input

Inputs containing `<script>` elements, `on*` event attributes, or `javascript:` URI values now fail
with `E_UNSAFE_SVG_CONTENT` through every supported processing entry point.

The recommended migration is to fix or replace the source SVG. For a temporary transition only, the
CLI supports explicit stripping:

```sh
svger build ./icons ./components --unsafe-input-policy strip
```

Programmatic and integration callers can pass `unsafeInputPolicy: 'strip'`. A prominent warning is
always emitted. Strip mode is deliberately described as incomplete and should not be treated as a
general untrusted-XML sanitizer.

## Input size ceiling

Raw SVG input is limited to 10 MiB by default. Set a smaller or larger positive integer with
`--max-input-size <bytes>` or the `maxInputSizeBytes` API option. Oversized input fails with
`E_SVG_INPUT_TOO_LARGE`.

## Output root boundary

Generated component and index paths must remain below their designated output root. Existing symlink
artifact destinations are refused. Boundary violations fail with `E_OUTPUT_PATH_ESCAPE`; move the
output root or remove the unsafe symlink instead of bypassing the check.

## Phase 1 gate

No Phase 1 architectural behavior is included in v4.0.9. The proposed behavior classifications are
in `compatibility-ledger-v4.1.md` and require maintainer approval before Phase 1 begins.
