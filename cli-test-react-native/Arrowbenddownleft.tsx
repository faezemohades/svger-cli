import React from "react";
import Svg, { G, Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
import { StyleProp, ViewStyle } from "react-native";
export interface ArrowbenddownleftProps extends SvgProps {
  width?: number | string;
  height?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  style?: StyleProp<ViewStyle>;
}

const Arrowbenddownleft = React.forwardRef<React.ComponentRef<typeof Svg>, ArrowbenddownleftProps>(
  ({ width = 24, height = 24, fill = "currentColor", stroke, strokeWidth, style, ...props }, ref) => {
    return (
      <Svg
        ref={ref}
        viewBox="0 0 24 24"
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={style}
        {...props}
      >
        <G id="surface1"><Path  d="M 2.25 5.25 C 2.253906 7.835938 3.28125 10.3125 5.109375 12.140625 C 6.9375 13.96875 9.414062 14.996094 12 15 L 19.1875 15 L 15.96875 18.21875 C 15.828125 18.359375 15.75 18.550781 15.75 18.75 C 15.75 18.949219 15.828125 19.140625 15.96875 19.28125 C 16.109375 19.421875 16.300781 19.5 16.5 19.5 C 16.699219 19.5 16.890625 19.421875 17.03125 19.28125 L 21.53125 14.78125 C 21.601562 14.710938 21.65625 14.628906 21.691406 14.539062 C 21.730469 14.445312 21.75 14.347656 21.75 14.25 C 21.75 14.152344 21.730469 14.054688 21.691406 13.960938 C 21.65625 13.871094 21.601562 13.789062 21.53125 13.71875 L 17.03125 9.21875 C 16.890625 9.078125 16.699219 9 16.5 9 C 16.300781 9 16.109375 9.078125 15.96875 9.21875 C 15.828125 9.359375 15.75 9.550781 15.75 9.75 C 15.75 9.949219 15.828125 10.140625 15.96875 10.28125 L 19.1875 13.5 L 12 13.5 C 9.8125 13.496094 7.714844 12.628906 6.167969 11.082031 C 4.621094 9.535156 3.75 7.4375 3.75 5.25 C 3.75 5.050781 3.671875 4.859375 3.53125 4.71875 C 3.390625 4.578125 3.199219 4.5 3 4.5 C 2.800781 4.5 2.609375 4.578125 2.46875 4.71875 C 2.328125 4.859375 2.25 5.050781 2.25 5.25 Z M 2.25 5.25 "/></G>
      </Svg>
    );
  }
);

Arrowbenddownleft.displayName = "Arrowbenddownleft";

export default Arrowbenddownleft;
