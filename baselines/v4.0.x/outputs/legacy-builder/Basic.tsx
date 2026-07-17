import React from "react";
import type { SVGProps } from "react";

export interface BasicProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

const Basic = React.forwardRef<SVGSVGElement, BasicProps>(
  ({ size, className, style, ...props }, ref) => {
    const dimensions = size ? { width: size, height: size } : {
      width: props.width || 24,
      height: props.height || 24
    };

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width={dimensions.width}
        height={dimensions.height}
        fill={props.fill || "currentColor"}
        className={className}
        style={style}
        {...props}
      >
        <path fill="#123456" d="M3 12l6 6L21 6"/>
      </svg>
    );
  }
);

Basic.displayName = "Basic";

export default Basic;
