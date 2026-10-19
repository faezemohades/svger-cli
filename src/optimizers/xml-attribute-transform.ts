/**
 * Conservative XML start-tag walker for attribute-only rewrites. It never
 * interprets character data and returns the original input on ambiguous XML.
 */
export type SVGAttributeTransform = (
  elementName: string,
  attributeName: string,
  value: string,
  quote: '"' | "'"
) => string | { name?: string; value?: string; raw?: string } | undefined;

interface AttributeSpan {
  name: string;
  value: string;
  nameStart: number;
  nameEnd: number;
  attributeStart: number;
  attributeEnd: number;
  quote: '"' | "'";
  start: number;
  end: number;
}

export interface SVGRootParts {
  attributes: Array<{ name: string; value: string }>;
  innerContent: string;
}

function findTagEnd(source: string, start: number): number {
  let quote = '';
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '>') return index + 1;
  }
  return -1;
}

function parseStartTag(
  source: string,
  start: number,
  end: number
): { name: string; attributes: AttributeSpan[] } | null {
  let index = start + 1;
  const nameStart = index;
  while (index < end && !/[\s/>]/.test(source[index])) index++;
  const name = source.slice(nameStart, index);
  if (!name) return null;
  const attributes: AttributeSpan[] = [];

  while (index < end - 1) {
    while (/\s/.test(source[index] ?? '')) index++;
    if (source[index] === '/' || source[index] === '>') break;
    const attrStart = index;
    while (index < end && !/[\s=/>]/.test(source[index])) index++;
    const attrName = source.slice(attrStart, index);
    if (!attrName) return null;
    while (/\s/.test(source[index] ?? '')) index++;
    if (source[index++] !== '=') return null;
    while (/\s/.test(source[index] ?? '')) index++;
    const quote = source[index++];
    if (quote !== '"' && quote !== "'") return null;
    const valueStart = index;
    while (index < end && source[index] !== quote) index++;
    if (index >= end) return null;
    attributes.push({
      name: attrName,
      value: source.slice(valueStart, index),
      nameStart: attrStart,
      nameEnd: attrStart + attrName.length,
      attributeStart: attrStart,
      attributeEnd: index + 1,
      quote,
      start: valueStart,
      end: index,
    });
    index++;
  }

  return { name, attributes };
}

/** Extract the top-level SVG body without trimming or rewriting character data. */
export function extractSVGRootParts(source: string): SVGRootParts | null {
  let position = 0;
  let rootName = '';
  let rootAttributes: Array<{ name: string; value: string }> = [];
  let rootContentStart = -1;
  const elementStack: string[] = [];

  while (position < source.length) {
    const start = source.indexOf('<', position);
    if (start < 0) return null;
    if (source.startsWith('<!--', start)) {
      const close = source.indexOf('-->', start + 4);
      if (close < 0) return null;
      position = close + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', start)) {
      const close = source.indexOf(']]>', start + 9);
      if (close < 0) return null;
      position = close + 3;
      continue;
    }
    if (source.startsWith('<?', start)) {
      const close = source.indexOf('?>', start + 2);
      if (close < 0) return null;
      position = close + 2;
      continue;
    }
    if (source.startsWith('</', start)) {
      const end = findTagEnd(source, start + 2);
      if (end < 0 || elementStack.length === 0) return null;
      const closingTag = source.slice(start, end);
      const closingName = closingTag.match(
        /^<\/([A-Za-z_:][\w.:-]*)\s*>$/
      )?.[1];
      if (!closingName || elementStack.at(-1) !== closingName) return null;
      elementStack.pop();
      if (elementStack.length === 0) {
        if (closingName !== rootName) return null;
        return {
          attributes: rootAttributes,
          innerContent: source.slice(rootContentStart, start),
        };
      }
      position = end;
      continue;
    }
    if (source.startsWith('<!', start)) {
      const end = findTagEnd(source, start + 2);
      if (end < 0) return null;
      position = end;
      continue;
    }

    const end = findTagEnd(source, start + 1);
    if (end < 0) return null;
    const nameMatch = source.slice(start, end).match(/^<([A-Za-z_:][\w.:-]*)/);
    if (!nameMatch) return null;
    const name = nameMatch[1];
    const selfClosing = /\/\s*>$/.test(source.slice(start, end));
    if (elementStack.length === 0) {
      if (name.toLowerCase() !== 'svg') return null;
      const tag = parseStartTag(source, start, end);
      if (!tag) return null;
      rootName = tag.name;
      rootContentStart = end;
      rootAttributes = tag.attributes.map(({ name, value }) => ({
        name,
        value,
      }));
      if (selfClosing) return { attributes: rootAttributes, innerContent: '' };
      if (!selfClosing) elementStack.push(name);
    } else if (!selfClosing) elementStack.push(name);
    position = end;
  }

  return null;
}

/** Minify only inter-element formatting whitespace outside text/preserve contexts. */
export function normalizeSVGFormattingWhitespace(source: string): string {
  const output: string[] = [];
  const stack: Array<{
    name: string;
    preserveWhitespace: boolean;
    textContext: boolean;
  }> = [];
  const textSensitive = new Set([
    'text',
    'tspan',
    'textpath',
    'title',
    'desc',
    'style',
  ]);
  let position = 0;

  while (position < source.length) {
    const start = source.indexOf('<', position);
    const textEnd = start < 0 ? source.length : start;
    const text = source.slice(position, textEnd);
    if (stack.at(-1)?.preserveWhitespace || stack.at(-1)?.textContext)
      output.push(text);
    else output.push(/^\s+$/.test(text) && text.length > 0 ? ' ' : text);
    if (start < 0) break;

    if (source.startsWith('<!--', start)) {
      const close = source.indexOf('-->', start + 4);
      if (close < 0) return source;
      output.push(source.slice(start, close + 3));
      position = close + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', start)) {
      const close = source.indexOf(']]>', start + 9);
      if (close < 0) return source;
      output.push(source.slice(start, close + 3));
      position = close + 3;
      continue;
    }
    if (source.startsWith('<?', start)) {
      const close = source.indexOf('?>', start + 2);
      if (close < 0) return source;
      output.push(source.slice(start, close + 2));
      position = close + 2;
      continue;
    }

    const end = findTagEnd(source, start + 1);
    if (end < 0) return source;
    const tagText = source.slice(start, end);
    output.push(tagText);
    if (tagText.startsWith('</')) {
      stack.pop();
    } else if (!tagText.startsWith('<!')) {
      const tag = parseStartTag(source, start, end);
      if (!tag) return source;
      const parentPreserve = stack.at(-1)?.preserveWhitespace ?? false;
      const parentTextContext = stack.at(-1)?.textContext ?? false;
      const space = tag.attributes.find(
        attribute => attribute.name.toLowerCase() === 'xml:space'
      )?.value;
      const preserveWhitespace =
        space === 'preserve' || (space !== 'default' && parentPreserve);
      const textContext =
        parentTextContext || textSensitive.has(tag.name.toLowerCase());
      if (!/\/\s*>$/.test(tagText))
        stack.push({ name: tag.name, preserveWhitespace, textContext });
    }
    position = end;
  }

  return output.join('');
}

/** Remove XML comments without matching comment-looking text or CDATA. */
export function removeSVGXMLComments(source: string): string {
  const output: string[] = [];
  let position = 0;
  while (position < source.length) {
    const start = source.indexOf('<', position);
    if (start < 0) {
      output.push(source.slice(position));
      break;
    }
    output.push(source.slice(position, start));
    if (source.startsWith('<!--', start)) {
      const close = source.indexOf('-->', start + 4);
      if (close < 0) return source;
      position = close + 3;
    } else if (source.startsWith('<![CDATA[', start)) {
      const close = source.indexOf(']]>', start + 9);
      if (close < 0) return source;
      output.push(source.slice(start, close + 3));
      position = close + 3;
    } else {
      const end = findTagEnd(source, start + 1);
      if (end < 0) return source;
      output.push(source.slice(start, end));
      position = end;
    }
  }
  return output.join('');
}

export function transformSVGAttributeValues(
  source: string,
  transform: SVGAttributeTransform
): string {
  const replacements: Array<{
    start: number;
    end: number;
    value: string;
    quote?: '"' | "'";
    escapeValue?: boolean;
  }> = [];
  let position = 0;

  while (position < source.length) {
    const start = source.indexOf('<', position);
    if (start < 0) break;
    if (source.startsWith('<!--', start)) {
      const close = source.indexOf('-->', start + 4);
      if (close < 0) return source;
      position = close + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', start)) {
      const close = source.indexOf(']]>', start + 9);
      if (close < 0) return source;
      position = close + 3;
      continue;
    }
    if (source.startsWith('<?', start)) {
      const close = source.indexOf('?>', start + 2);
      if (close < 0) return source;
      position = close + 2;
      continue;
    }
    if (source.startsWith('</', start) || source.startsWith('<!', start)) {
      const end = findTagEnd(source, start + 2);
      if (end < 0) return source;
      position = end;
      continue;
    }

    const end = findTagEnd(source, start + 1);
    if (end < 0) return source;
    const tag = parseStartTag(source, start, end);
    if (!tag) return source;
    for (const attribute of tag.attributes) {
      const rewritten = transform(
        tag.name,
        attribute.name,
        attribute.value,
        attribute.quote
      );
      if (typeof rewritten === 'string' && rewritten !== attribute.value) {
        replacements.push({
          start: attribute.start,
          end: attribute.end,
          value: rewritten,
          quote: attribute.quote,
          escapeValue: true,
        });
      } else if (rewritten && typeof rewritten === 'object') {
        if (rewritten.raw !== undefined) {
          replacements.push({
            start: attribute.attributeStart,
            end: attribute.attributeEnd,
            value: rewritten.raw,
          });
          continue;
        }
        if (rewritten.name && rewritten.name !== attribute.name) {
          replacements.push({
            start: attribute.nameStart,
            end: attribute.nameEnd,
            value: rewritten.name,
          });
        }
        if (
          rewritten.value !== undefined &&
          rewritten.value !== attribute.value
        ) {
          replacements.push({
            start: attribute.start,
            end: attribute.end,
            value: rewritten.value,
            quote: attribute.quote,
            escapeValue: true,
          });
        }
      }
    }
    position = end;
  }

  if (replacements.length === 0) return source;
  let result = '';
  let cursor = 0;
  for (const replacement of replacements) {
    let escaped = replacement.value;
    if (replacement.escapeValue) {
      escaped = escaped
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      escaped =
        replacement.quote === '"'
          ? escaped.replace(/"/g, '&quot;')
          : escaped.replace(/'/g, '&apos;');
    }
    result += source.slice(cursor, replacement.start) + escaped;
    cursor = replacement.end;
  }
  return result + source.slice(cursor);
}
