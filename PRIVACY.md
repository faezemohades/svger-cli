# Privacy Policy

SVGER-CLI performs all SVG discovery, compilation, caching, migration, and reporting locally. It
does not send telemetry, analytics, SVG content, configuration, diagnostics, file paths, or usage
events over a network.

## Default behavior

- Network telemetry is not implemented and is not permitted by default.
- SVG source bytes and generated component bytes remain on the user's machine.
- Reports may contain local relative paths, but reports are written or transmitted only when the
  user explicitly directs their shell or application to do so.
- The content-addressable cache is local to the compiler working directory by default.

Package installation tools and explicitly configured third-party plugins are outside the compiler's
telemetry boundary. A plugin must document its own behavior; SVGER-CLI does not grant a plugin
implicit permission to transmit SVG content or full paths.

## Future telemetry gate

Any future telemetry proposal must satisfy all of these conditions before implementation:

1. Explicit opt-in; absence of a choice means disabled.
2. A separate privacy review and approval from the privacy code owner.
3. Public documentation of every collected field, retention period, processor, and endpoint.
4. No SVG bytes, generated code, configuration secrets, full file paths, or stable machine/user
   identifiers.
5. A local preview of the exact payload and a reliable way to withdraw consent.
6. Contract tests proving that default and offline modes perform no network operation.

Adding a network-capable import to compiler runtime code triggers the Phase 1 no-telemetry review
gate. See `scripts/check-no-telemetry.mjs`.

## Privacy reports

Report a privacy issue privately using the security contact process in `SECURITY.md`.
