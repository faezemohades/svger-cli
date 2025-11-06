/**
 * Generates a React SVG component template from provided SVG content.
 *
 * This function processes raw SVG content by cleaning it (removing XML declarations,
 * DOCTYPE, extra whitespace, inline styles, and xmlns attributes), then wraps it in
 * a React functional component that accepts standard SVGProps for flexibility.
 *
 * @param options - Configuration object for generating the component.
 * @param options.componentName - The name of the React component (e.g., "IconName").
 * @param options.svgContent - The raw SVG markup as a string.
 * @param [options.defaultWidth=24] - The default width attribute for the SVG.
 * @param [options.defaultHeight=24] - The default height attribute for the SVG.
 * @param [options.defaultFill="currentColor"] - The default fill color for the SVG.
 * @returns A string containing the complete TypeScript code for the React SVG component.
 */
export function reactTemplate({ componentName, svgContent, defaultWidth = 24, defaultHeight = 24, defaultFill = "currentColor", }) {
    const cleaned = svgContent
        .replace(/<\?xml.*?\?>/g, "")
        .replace(/<!DOCTYPE.*?>/g, "")
        .replace(/\r?\n|\r/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/style="[^"]*"/g, "")
        .replace(/\s+xmlns(:xlink)?="[^"]*"/g, "")
        .trim()
        .replace(/^.*?<svg[^>]*>(.*?)<\/svg>.*$/i, "$1");
    return `import type { SVGProps } from "react";
const Svg${componentName} = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 ${defaultWidth} ${defaultHeight}"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    width={props.width || ${defaultWidth}}
    height={props.height || ${defaultHeight}}
    fill={props.fill || "${defaultFill}"}
    stroke={props.stroke || "none"}
    className={props.className}
    {...props}
  >
    ${cleaned}
  </svg>
);
export default Svg${componentName};
`;
}
