# SVG Input Security Policy

All generation and optimization entry points use the same bounded XML scanner before optimizer
passes, plugins, cache reuse, or artifact writes. It does not construct a DOM, resolve external
entities, access the filesystem during scanning, or perform network requests. File-based public
entry points inspect the opened file size before reading and cap reads at the configured maximum
plus one byte to handle file growth after the size check.

The accepted input is UTF-8 XML with one SVG root. DTDs, entity declarations, unknown entities,
malformed XML, non-SVG element namespaces, ambiguous attribute namespaces, NUL/replacement
characters, and unsupported XML encodings are rejected. The scanner limits input to the configured
byte maximum, nesting to 256 levels, element count to 100,000, attributes per element to 256, unique
findings to 256, strip edits to 10,000, and each stylesheet to 1 MiB / 10,000 text chunks. XML
predefined and numeric character references are decoded before security checks.

By default (`unsafeInputPolicy: "reject"`), generation rejects event-handler attributes, active
embedded/dynamic elements (`script`, `foreignObject`, `iframe`, `object`, `embed`, media, stylesheet
links, and SVG animation elements), non-fragment resource references in `href`, `src`, `poster`, or
`data`, external `xml:base`, CSS imports/expressions, and non-fragment CSS `url()` references.
Internal fragment references such as `href="#shape"` and simple unquoted `url(#paint)` remain
allowed. Quoted or nested URL functions and escaped CSS newlines are unsupported and fail closed.
External, relative, and data resource references are intentionally disallowed because they can fetch
content or embed active formats. No unsafe construct is silently sanitized.

The explicit `unsafeInputPolicy: "strip"` option removes the complete active element or the specific
unsafe attribute/style block and emits a warning. This can alter SVG appearance and is a
compatibility behavior for callers who deliberately opt in; review source semantics before using it.
Structurally invalid or unsupported XML is always rejected, including in strip mode.

The scanner is a narrow security validator, not a general-purpose XML conformance implementation.
Its scope is the accepted SVG subset described above; inputs using unsupported XML features fail
closed. The scanner introduces no new runtime dependency and uses APIs supported by Node.js 18.17+.
