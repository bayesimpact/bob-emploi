import { ComponentType, HTMLProps } from 'react';

type SVGProps = HTMLProps<SVGElement>

type ReservedProps = 'size' | 'width' | 'height' | 'fill' | 'viewBox'

export interface MdiReactIconProps extends Pick<SVGProps, Exclude<keyof SVGProps, ReservedProps>> {
  color?: string;
  size?: number | string;
  // should not have any children
  children?: never;
}
export type MdiReactIconComponentType = ComponentType<MdiReactIconProps>;
