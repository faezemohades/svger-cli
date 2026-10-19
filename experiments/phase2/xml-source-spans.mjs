/**
 * Experimental lexical index for XML source. Offsets are JavaScript UTF-16
 * code-unit indexes into the untouched input string. This scanner does not
 * parse XML semantics; the strict XML parser remains responsible for that.
 */
export function indexXMLSourceSpans(source) {
  const tokens = [];
  const add = (type, start, end, extra = {}) =>
    tokens.push({ type, start, end, raw: source.slice(start, end), ...extra });
  const addEntityReferences = (start, end, owner) => {
    const expression = /&(?:#(?:x[\da-f]+|\d+)|[A-Za-z_:][\w.:-]*);/giu;
    const value = source.slice(start, end);
    for (
      let match = expression.exec(value);
      match;
      match = expression.exec(value)
    ) {
      const referenceStart = start + match.index;
      add(
        'entity-reference',
        referenceStart,
        referenceStart + match[0].length,
        {
          owner,
        }
      );
    }
  };
  const scanTagEnd = start => {
    let quote = '';
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '>') return index + 1;
    }
    return source.length;
  };
  const scanAttributes = (tagStart, tagEnd, nameEnd) => {
    const attributes = [];
    let cursor = nameEnd;
    while (cursor < tagEnd - 1) {
      const leadingStart = cursor;
      while (/\s/u.test(source[cursor] ?? '')) cursor++;
      if (cursor >= tagEnd - 1 || source[cursor] === '/') break;
      const attributeStart = cursor;
      while (cursor < tagEnd && !/[\s=/>]/u.test(source[cursor])) cursor++;
      if (cursor === attributeStart) break;
      const name = source.slice(attributeStart, cursor);
      while (/\s/u.test(source[cursor] ?? '')) cursor++;
      if (source[cursor] !== '=') break;
      cursor++;
      while (/\s/u.test(source[cursor] ?? '')) cursor++;
      const quote = source[cursor];
      if (quote !== '"' && quote !== "'") break;
      const valueStart = ++cursor;
      while (cursor < tagEnd && source[cursor] !== quote) cursor++;
      const valueEnd = cursor;
      if (source[cursor] === quote) cursor++;
      const attributeEnd = cursor;
      const attribute = {
        name,
        start: attributeStart,
        end: attributeEnd,
        leadingStart,
        nameStart: attributeStart,
        nameEnd: attributeStart + name.length,
        valueStart,
        valueEnd,
        quote,
      };
      attributes.push(attribute);
      addEntityReferences(valueStart, valueEnd, 'attribute');
    }
    return attributes;
  };

  let cursor = 0;
  while (cursor < source.length) {
    if (source.startsWith('<!--', cursor)) {
      const close = source.indexOf('-->', cursor + 4);
      const end = close < 0 ? source.length : close + 3;
      add('comment', cursor, end, {
        contentStart: cursor + 4,
        contentEnd: close < 0 ? end : close,
      });
      cursor = end;
      continue;
    }
    if (source.startsWith('<![CDATA[', cursor)) {
      const close = source.indexOf(']]>', cursor + 9);
      const end = close < 0 ? source.length : close + 3;
      add('cdata', cursor, end, {
        contentStart: cursor + 9,
        contentEnd: close < 0 ? end : close,
      });
      cursor = end;
      continue;
    }
    if (source.startsWith('<?', cursor)) {
      const close = source.indexOf('?>', cursor + 2);
      const end = close < 0 ? source.length : close + 2;
      add('processing-instruction', cursor, end);
      cursor = end;
      continue;
    }
    if (source[cursor] !== '<') {
      const next = source.indexOf('<', cursor);
      const end = next < 0 ? source.length : next;
      add('text', cursor, end);
      addEntityReferences(cursor, end, 'text');
      cursor = end;
      continue;
    }
    if (source.startsWith('</', cursor)) {
      const end = scanTagEnd(cursor + 2);
      add('end-tag', cursor, end);
      cursor = end;
      continue;
    }
    if (source.startsWith('<!', cursor)) {
      // Declarations (notably DTDs) are kept opaque; the admission boundary
      // rejects them before this candidate parser/index is used.
      const end = scanTagEnd(cursor + 2);
      add('declaration', cursor, end);
      cursor = end;
      continue;
    }

    const end = scanTagEnd(cursor + 1);
    let nameEnd = cursor + 1;
    while (nameEnd < end && !/[\s/>]/u.test(source[nameEnd])) nameEnd++;
    const name = source.slice(cursor + 1, nameEnd);
    add('start-tag', cursor, end, {
      name,
      attributes: scanAttributes(cursor, end, nameEnd),
      selfClosing: /\/\s*>$/u.test(source.slice(cursor, end)),
    });
    cursor = end;
  }
  return tokens.sort(
    (left, right) => left.start - right.start || left.end - right.end
  );
}
