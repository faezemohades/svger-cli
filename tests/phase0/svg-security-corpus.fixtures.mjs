export const safeCorpus = [
  '<svg viewBox="0 0 24 24"><path fill="url(#paint)" d="M0 0h1v1z"/></svg>',
  '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><title>A &amp; B</title><path d="M0 0"/></svg>',
  '<svg><style>.icon{fill:url(#paint)}</style><defs><linearGradient id="paint"/></defs><use href="#shape"/></svg>',
  '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><g><use xlink:href="#shape"/></g></svg>',
  '<svg><text><![CDATA[<script>not markup</script>]]></text></svg>',
  '<svg><style>.x::after{content:"url(https://example.invalid/)";fill:url(#paint)}</style></svg>',
];

export const rejectedCorpus = [
  [
    'entity-obfuscated-scheme',
    '<svg><a href="java&#x73;cript:alert(1)">x</a></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'external-image',
    '<svg><image href="https://example.invalid/a.png"/></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'external-xml-base',
    '<svg xml:base="https://example.invalid/"><use href="#remote"/></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'external-css',
    '<svg><style>.x{fill:u\\72l(https://example.invalid/a)}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'comment-obfuscated-css-url',
    '<svg><style>.x{fill:u/**/rl(https://example.invalid/a)}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'css-comment-marker-in-string',
    '<svg><style>.x{content:"/*";@import url(https://example.invalid/a) */}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'css-out-of-range-escape',
    '<svg><style>.x{fill:url(\\110000https://example.invalid/a)}</style></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'nested-style-markup',
    '<svg><style>.x{fill:url(#a)}<g/></style></svg>',
    'E_INVALID_SVG_XML',
  ],
  [
    'malformed-css-escape',
    '<svg><style>.x{color:red}\\</style></svg>',
    'E_UNSUPPORTED_SVG_CSS',
  ],
  [
    'malformed-css-string',
    '<svg><style>.x{content:"unterminated}</style></svg>',
    'E_UNSUPPORTED_SVG_CSS',
  ],
  [
    'event-handler',
    '<svg><path onload="alert(1)"/></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'active-foreign-content',
    '<svg><foreignObject><div/></foreignObject></svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  [
    'doctype',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    'E_UNSAFE_SVG_CONTENT',
  ],
  ['unknown-entity', '<svg><title>&custom;</title></svg>', 'E_INVALID_SVG_XML'],
  ['mismatched-tag', '<svg><g></svg>', 'E_INVALID_SVG_XML'],
  ['unquoted-attribute', '<svg viewBox=0/>', 'E_INVALID_SVG_XML'],
  ['whitespace-in-tag-delimiter', '< svg/>', 'E_INVALID_SVG_XML'],
  ['missing-attribute-separator', '<svg a="1"b="2"/>', 'E_INVALID_SVG_XML'],
  ['foreign-namespace', '<x:svg xmlns:x="urn:foreign"/>', 'E_INVALID_SVG_XML'],
  [
    'unsupported-encoding',
    '<?xml version="1.0" encoding="UTF-16"?><svg/>',
    'E_UNSUPPORTED_SVG_ENCODING',
  ],
];
