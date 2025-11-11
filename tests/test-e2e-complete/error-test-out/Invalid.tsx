import React from "react";
import type { SVGProps } from "react";

export interface InvalidProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

const Invalid = React.forwardRef<SVGSVGElement, InvalidProps>(
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
        <not-valid-svg
      </svg>
    );
  }
);

Invalid.displayName = "Invalid";

export default Invalid;
