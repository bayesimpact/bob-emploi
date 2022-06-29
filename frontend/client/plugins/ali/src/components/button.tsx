import React, {useMemo} from 'react'

import {colorToAlpha} from 'components/colors'
import {SmartLink, useRadium} from 'components/radium'

import type {ConfigColor} from 'config'

type RadiumCSSPropertiesNoBackground = Omit<RadiumCSSProperties, 'background'|'backgroundColor'>
type ButtonCSSProperties = RadiumCSSPropertiesNoBackground & {
  backgroundColor: ConfigColor|'transparent'
}

const defaultButtonStyle: ButtonCSSProperties = {
  backgroundColor: colors.MAGENTA,
  border: 0,
  borderRadius: 15,
  boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
  color: colors.BACKGROUND_GREY,
  cursor: 'pointer',
  display: 'block',
  fontFamily: 'Fredoka One',
  fontSize: 21,
  padding: '15px 70px',
  textDecoration: 'none',
} as const

type ButtonType = 'back' | 'discreet' | 'validation'

const typedStyles: {[type in ButtonType]?: ButtonCSSProperties} = {
  back: {
    backgroundColor: colors.FOOTER_GREY,
    color: colors.PEA,
  },
  discreet: {
    ':hover': {
      boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
    },
    'backgroundColor': 'transparent',
    'boxShadow': 'none',
    'color': colors.PEA,
  },
} as const

const disabledStyle = {
  boxShadow: 'none',
  cursor: 'initial',
} as const

const smallButtonStyle = {
  fontSize: 15,
  padding: '5px 10px',
} as const

type Props = React.ComponentProps<typeof SmartLink> & {
  isSmall?: boolean
  // eslint-disable-next-line react/boolean-prop-naming
  disabled?: boolean
  style?: RadiumCSSPropertiesNoBackground
  type?: ButtonType
}


const RadiumButtonBase = (props: React.ComponentPropsWithoutRef<'button'>): React.ReactElement =>
  <button
    type="button"
    {...useRadium<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(props)[0]} />
const RadiumButton = React.memo(RadiumButtonBase)


const MiniButton = (props: Props) => {
  const {children, disabled, isSmall, style, type, ...linkProps} = props
  const buttonStyle = useMemo((): RadiumCSSProperties => {
    const baseStyle: ButtonCSSProperties = {
      ...defaultButtonStyle,
      ...type && typedStyles[type],
      ...disabled && disabledStyle,
      ...type === 'validation' ? {} : (style as RadiumCSSPropertiesNoBackground),
    }
    if (!isSmall && !disabled) {
      return baseStyle
    }
    return {
      ...baseStyle,
      ...isSmall && smallButtonStyle,
      ...isSmall && baseStyle.boxShadow !== 'none' ?
        {boxShadow: '0px 5px 5px 0 rgba(0, 0, 0, 0.2)'} : {},
      ...disabled && disabledStyle,
      ...disabled && baseStyle.backgroundColor && baseStyle.backgroundColor !== 'transparent' ?
        {backgroundColor: colorToAlpha(baseStyle.backgroundColor, .5)} : {},
    }
  }, [disabled, isSmall, style, type])
  if (type === 'validation') {
    return <SmartLink {...linkProps} style={style}>
      <RadiumButton style={buttonStyle} disabled={disabled} type="submit">
        {children}
      </RadiumButton>
    </SmartLink>
  }
  return <SmartLink {...linkProps} style={buttonStyle}>
    {children}
  </SmartLink>
}


export default React.memo(MiniButton)
