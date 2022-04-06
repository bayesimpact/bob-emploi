import type React from 'react'

import isMobileVersion from 'store/mobile'

import 'styles/fonts/Lato/font.css'

export const SmoothTransitions = {
  transition: 'all 450ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
} as const

export const FastTransitions = {
  transition: 'all 100ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
} as const

export const PADDED_ON_MOBILE = isMobileVersion ? '0 20px' : 0

// Maximum width of content on super wide screen.
export const MAX_CONTENT_WIDTH = 1000

// Minimum padding between screen borders and content on medium screens.
export const MIN_CONTENT_PADDING = 20


function vendorProperties<K extends keyof React.CSSProperties>(
  property: K, value: React.CSSProperties[K]): React.CSSProperties {
  const style: React.CSSProperties = {}
  const propertySuffix = property.slice(0, 1).toUpperCase() + property.slice(1)
  for (const prefix of ['Moz', 'Ms', 'O', 'Webkit']) {
    // @ts-ignore
    style[prefix + propertySuffix] = value
  }
  style[property] = value
  return style
}


export const Styles = {
  CENTERED_COLUMN: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  // Style for text input.
  // ! Border color is handled in App.css !
  INPUT: {
    background: 'inherit',
    borderRadius: 0,
    color: colors.CHARCOAL_GREY,
    fontSize: 15,
    fontWeight: 'normal',
    height: 41,
    paddingLeft: 15,
    width: '100%',
    ...SmoothTransitions,
  },
  VENDOR_PREFIXED: vendorProperties,
} as const
