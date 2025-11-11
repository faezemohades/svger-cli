import { Component, JSX } from 'solid-js';

export interface LogoProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const Logo: Component<LogoProps> = (props) => (
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
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

export default Logo;
