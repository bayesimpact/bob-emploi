import CloseIcon from 'mdi-react/CloseIcon'
import React, {useMemo} from 'react'

import {useTranslation} from 'react-i18next'

import useKeyListener from 'hooks/key_listener'
import isMobileVersion from 'store/mobile'

import {useRadium} from 'components/radium'
import {SmoothTransitions} from 'components/theme'


interface ButtonProps {
  ['aria-describedby']?: string
  onClick: () => void
  shouldCloseOnEscape?: boolean
  style?: RadiumCSSProperties
  tabIndex?: number
}


const ModalCloseButton = (props: ButtonProps): React.ReactElement => {
  const {t} = useTranslation('components')
  const {shouldCloseOnEscape, onClick, style, ...otherProps} = props
  const closeButtonStyle: RadiumCSSProperties = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      backgroundColor: colors.MODAL_CLOSE_BACKGROUND_HOVER,
    },
    'alignItems': 'center',
    'backgroundColor': colors.CHARCOAL_GREY,
    'borderRadius': '100%',
    'bottom': '100%',
    'boxShadow': '0 0 25px 0 rgba(0, 0, 0, 0.5)',
    'color': '#fff',
    'cursor': 'pointer',
    'display': 'flex',
    'fontSize': 19,
    'height': 35,
    'justifyContent': 'center',
    'position': 'absolute',
    'right': isMobileVersion ? 5 : 0,
    'transform': 'translate(50%, 50%)',
    'width': 35,
    'zIndex': 1,
    ...SmoothTransitions,
    ...style,
  }), [style])
  const [radiumProps] = useRadium<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    {style: closeButtonStyle})
  useKeyListener('Escape', shouldCloseOnEscape ? onClick : undefined, undefined, 'keydown')
  return <button {...otherProps} {...radiumProps} onClick={onClick} type="button">
    <CloseIcon size={19} aria-label={t('Fermer')} role="img" />
  </button>
}


export default React.memo(ModalCloseButton)
