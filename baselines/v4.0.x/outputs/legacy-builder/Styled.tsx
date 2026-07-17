import React from "react";
import type { SVGProps } from "react";

export interface StyledProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

const Styled = React.forwardRef<SVGSVGElement, StyledProps>(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || 32,
      height: props.height || 32
    };

    return (
      <svg
        ref={ref}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || "currentColor"}
        className={className}
        style={style}
        {...props}
      >
        <g id="layer" style={{fill: 'none', stroke: '#abcdef', strokeWidth: '2px'}}> <circle cx="16" cy="16" r="12" fillRule="evenodd"/> </g>
      </svg>
    );
  }
);

Styled.displayName = "Styled";

export default Styled;
