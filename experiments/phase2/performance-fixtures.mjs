import { Buffer } from 'node:buffer';

const SEED = 0x5a17c0de;

function svg(body, attributes = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;
}

function makeFixtures() {
  // All variation is deterministic; the seed is recorded to make future
  // fixture revisions explicit, not to introduce runtime randomness.
  const small = svg('<path d="M0 0h24v24z" fill="#123456"/>');
  const medium = svg(
    '<defs><linearGradient id="paint"><stop offset="0" stop-color="#123"/><stop offset="1" stop-color="#abc"/></linearGradient></defs>' +
      '<g class="icon"><path fill="url(#paint)" d="M0 0h24v24z"/><use href="#shape"/></g>' +
      '<style>.icon{stroke:#123;stroke-width:2}</style>'.repeat(8)
  );
  const large = svg(
    Array.from(
      { length: 120 },
      (_, group) =>
        `<g id="g${group}">${Array.from(
          { length: 40 },
          (_, item) =>
            `<path d="M${item} ${group}h1v1z" data-seq="${group * 40 + item}"/>`
        ).join('')}</g>`
    ).join('')
  );
  const textHeavy = svg(
    Array.from(
      { length: 160 },
      (_, index) =>
        `<text xml:space="preserve">  row ${index} &amp; café 😀 <![CDATA[<literal ${index}>]]><tspan> tail\n</tspan></text>`
    ).join('')
  );
  const attrHeavy = svg(
    Array.from(
      { length: 96 },
      (_, element) =>
        `<g ${Array.from(
          { length: 120 },
          (_, attribute) => `data-${attribute}="v${element}-${attribute}"`
        ).join(' ')}><path d="M0 0h1v1z"/></g>`
    ).join('')
  );
  const nearDepth = svg(
    `${'<g>'.repeat(240)}<path d="M0 0h1v1z"/>${'</g>'.repeat(240)}`
  );
  const nearBytes = svg(
    `<!-- deterministic near-input-limit seed=${SEED} -->${'x'.repeat(9 * 1024 * 1024)}`
  );

  const accepted = [
    ['small', small],
    ['medium', medium],
    ['large', large],
    ['text-heavy', textHeavy],
    ['attribute-heavy', attrHeavy],
    ['near-depth-limit', nearDepth],
    ['near-byte-limit', nearBytes],
  ].map(([name, source]) => ({
    name,
    source,
    bytes: Buffer.byteLength(source, 'utf8'),
    codeUnits: source.length,
    seed: SEED,
  }));

  const rejected = [
    ['malformed-tag', '<svg><g></svg>'],
    ['excessive-depth', svg(`${'<g>'.repeat(257)}${'</g>'.repeat(257)}`)],
    [
      'doctype-entity',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    ],
    ['active-content', '<svg><script>alert(1)</script></svg>'],
    ['over-byte-limit', svg('x'.repeat(10 * 1024 * 1024))],
  ].map(([name, source]) => ({
    name,
    source,
    bytes: Buffer.byteLength(source, 'utf8'),
    codeUnits: source.length,
    seed: SEED,
  }));
  return { accepted, rejected };
}

export const performanceFixtures = makeFixtures();

export function describeStructure(source) {
  let elements = 0;
  let attributes = 0;
  let textBytes = 0;
  let depth = 0;
  let maxDepth = 0;
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+/gu;
  for (const match of source.matchAll(tokens)) {
    const token = match[0];
    if (token.startsWith('<![CDATA[')) {
      textBytes += Buffer.byteLength(token.slice(9, -3), 'utf8');
    } else if (token.startsWith('<')) {
      if (
        token.startsWith('</') ||
        token.startsWith('<!') ||
        token.startsWith('<?')
      )
        continue;
      const nameEnd = token.search(/[\s/>]/u);
      const inside = token.slice(nameEnd < 0 ? token.length : nameEnd, -1);
      elements++;
      attributes += (inside.match(/(?:^|\s)[A-Za-z_:][\w.:-]*\s*=/gu) ?? [])
        .length;
      maxDepth = Math.max(maxDepth, ++depth);
      if (/\/\s*>$/u.test(token)) depth--;
    } else {
      textBytes += Buffer.byteLength(token, 'utf8');
    }
  }
  // A second closing-tag pass computes nesting without treating lexical
  // fragments inside comments/CDATA as markup.
  depth = 0;
  maxDepth = 0;
  for (const match of source.matchAll(tokens)) {
    const token = match[0];
    if (
      !token.startsWith('<') ||
      token.startsWith('<!--') ||
      token.startsWith('<![CDATA[') ||
      token.startsWith('<!') ||
      token.startsWith('<?')
    )
      continue;
    if (token.startsWith('</')) depth--;
    else {
      maxDepth = Math.max(maxDepth, ++depth);
      if (/\/\s*>$/u.test(token)) depth--;
    }
  }
  return { elements, attributes, textBytes, maxDepth };
}
