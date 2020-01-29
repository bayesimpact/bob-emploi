import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {SmartLink, useRadium} from 'components/radium'
import {colorToAlpha} from 'components/theme'

const defaultButtonStyle = {
  backgroundColor: colors.MINI_MAGENTA,
  border: 0,
  borderRadius: 15,
  boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
  color: colors.MINI_WHITE,
  cursor: 'pointer',
  display: 'block',
  fontFamily: 'Fredoka One',
  fontSize: 21,
  padding: '15px 70px',
  textDecoration: 'none',
}

type ButtonType = 'back' | 'discreet' | 'validation'

const typedStyles: {[type in ButtonType]?: RadiumCSSProperties} = {
  back: {
    backgroundColor: colors.MINI_FOOTER_GREY,
    color: colors.MINI_PEA,
  },
  discreet: {
    ':hover': {
      boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
    },
    'backgroundColor': 'initial',
    'boxShadow': 'none',
    'color': colors.MINI_PEA,
  },
} as const

const disabledStyle = {
  boxShadow: 'none',
  cursor: 'initial',
}

const smallButtonStyle = {
  fontSize: 15,
  padding: '5px 10px',
}

type ButtonStyle = GetProps<typeof SmartLink> & {
  isSmall?: boolean
  disabled?: boolean
  type?: ButtonType
}


const RadiumButtonBase = (props: React.ComponentPropsWithoutRef<'button'>): React.ReactElement =>
  <button {...useRadium<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(props)[0]} />
const RadiumButton = React.memo(RadiumButtonBase)


const MiniButton: React.FC<ButtonStyle> = (props) => {
  const {children, disabled, isSmall, style, type, ...linkProps} = props
  const buttonStyle = useMemo((): RadiumCSSProperties => {
    const baseStyle = {
      ...defaultButtonStyle,
      ...type && typedStyles[type] || {},
      ...disabled && disabledStyle,
      ...type === 'validation' ? {} : style,
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
      ...disabled && baseStyle.backgroundColor ?
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
MiniButton.propTypes = {
  children: PropTypes.node,
  // Keep disabled as prop for consistent naming with the underlying button.
  // eslint-disable-next-line react/boolean-prop-naming
  disabled: PropTypes.bool,
  isSmall: PropTypes.bool,
  style: PropTypes.object,
  type: PropTypes.oneOf(['back', 'discreet', 'validation']),
}
const Button = React.memo(MiniButton)

export {Button}
