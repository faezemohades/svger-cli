import { Component, JSX } from 'solid-js';

export interface TestIconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const TestIcon: Component<TestIconProps> = (props) => (
  <svg
    class={props.className}
    style={props.style}
    width={props.width || 24}
    height={props.height || 24}
    fill={props.fill || 'currentColor'}
    stroke={props.stroke}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

export default TestIcon;
