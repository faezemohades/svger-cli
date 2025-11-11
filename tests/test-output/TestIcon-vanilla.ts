export interface TestIconOptions {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
  [key: string]: any;
}

export function TestIcon(options: TestIconOptions = {}): SVGSVGElement {
  const {
    className = '',
    width = 24,
    height = 24,
    fill = 'currentColor',
    stroke = '',
    ...attrs
  } = options;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('fill', fill);
  if (stroke) svg.setAttribute('stroke', stroke);
  
  Object.entries(attrs).forEach(([key, value]) => {
    svg.setAttribute(key, String(value));
  });
  
  svg.innerHTML = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>`;
  
  return svg;
}
