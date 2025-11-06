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
export declare function reactTemplate({ componentName, svgContent, defaultWidth, defaultHeight, defaultFill, }: {
    componentName: string;
    svgContent: string;
    defaultWidth?: number;
    defaultHeight?: number;
    defaultFill?: string;
}): string;
