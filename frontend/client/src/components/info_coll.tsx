// TODO(pascal): Check if it is used and maybe cleanup.
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'

import {isMobileVersion} from 'components/mobile'
import {ModalCloseButton} from 'components/modal'
import {Button, SmoothTransitions} from 'components/theme'


interface BoxProps {
  isShown?: boolean
  onClose?: () => void
  style?: React.CSSProperties
}

const closeStyle: React.CSSProperties = {
  bottom: 'initial',
  fontSize: 10,
  height: 15,
  opacity: .6,
  right: 10,
  top: 10,
  transform: 'initial',
  width: 15,
}
const buttonStyle: RadiumCSSProperties = {
  ':hover': {
    backgroundColor: '#fff',
  },
  'backgroundColor': 'rgba(255, 255, 255, .8)',
  'color': colors.BOB_BLUE,
  'display': 'block',
  'marginTop': 25,
}


const InfoCollNotificationBoxBase: React.FC<BoxProps> =
(props: BoxProps): React.ReactElement|null => {
  const {isShown, onClose, style} = props
  const [isHiding, setIsHiding] = useState(false)
  const isVisible = isShown && !isHiding

  const close = useCallback((): void => {
    setIsHiding(true)
    if (onClose) {
      // Wait for the end of the transition to close it.
      setTimeout(onClose, 500)
    }
  }, [onClose])

  const handleClick = useCallback((): void => {
    window.open('https://projects.invisionapp.com/boards/SK39VCS276T8J/', '_blank')
    close()
  }, [close])

  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.BOB_BLUE,
    borderRadius: 4,
    bottom: 20,
    boxShadow: '0 3px 14px 0 rgba(0, 0, 0, 0.2)',
    color: '#fff',
    fontSize: 15,
    left: 20,
    lineHeight: 1.3,
    opacity: isVisible ? 1 : 0,
    padding: '25px 40px 25px 25px',
    position: 'fixed',
    textAlign: 'left',
    transform: `translateX(${isVisible ? '0' : '-100%'})`,
    ...SmoothTransitions,
    ...style,
  }), [isVisible, style])
  if (isMobileVersion) {
    return null
  }
  return <div style={containerStyle}>
    {onClose ? <ModalCloseButton onClick={close} style={closeStyle} /> : null}
    <strong>Vous êtes un conseiller Pôle emploi&nbsp;?</strong><br />
    Trouvez ici nos ressources pour présenter {config.productName}
    <Button style={buttonStyle} onClick={handleClick}>Voir les ressources</Button>
  </div>
}
InfoCollNotificationBoxBase.propTypes = {
  isShown: PropTypes.bool,
  onClose: PropTypes.func,
  style: PropTypes.object,
}
const InfoCollNotificationBox = React.memo(InfoCollNotificationBoxBase)


export {InfoCollNotificationBox}
