import { h, FunctionComponent } from 'preact';
import { JSX } from 'preact/jsx-runtime';

export interface TestIconProps extends JSX.SVGAttributes<SVGSVGElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
}

const TestIcon: FunctionComponent<TestIconProps> = ({ 
  className, 
  style, 
  width, 
  height, 
  fill, 
  stroke, 
  ...props 
}) => {
  return (
    <svg
      class={className}
      style={style}
      width={width || 24}
      height={height || 24}
      fill={fill || 'currentColor'}
      stroke={stroke}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  );
};

export default TestIcon;
