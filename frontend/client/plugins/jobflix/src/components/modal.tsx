import React, {useMemo} from 'react'

import {Modal} from 'components/modal'
import ModalCloseButton from 'components/modal_close_button'

interface ModalProps extends React.ComponentProps<typeof Modal> {
  onClose: () => void
  style?: React.CSSProperties
}

const buttonStyle: RadiumCSSProperties = {
  ':focus': {
    boxShadow:
    `0px 0px 0px 2px ${colors.MODAL_BACKGROUND}, 0px 0px 0px 5px ${colors.MODAL_CLOSE_BACKGROUND}`,
  },
  ':hover': {
    boxShadow:
    `0px 0px 0px 2px ${colors.MODAL_BACKGROUND}, 0px 0px 0px 5px ${colors.MODAL_CLOSE_BACKGROUND}`,
  },
  'backgroundColor': colors.MODAL_CLOSE_BACKGROUND,
  'boxShadow': 'initial',
  'color': colors.MODAL_CLOSE_ICON,
  'transform': 'translate(50%, 50%)',
  'transition': 'none',
}
const UpskillingModal = (props: ModalProps): React.ReactElement|null => {
  const {children, onClose, skipFocusOnFirstElements = 0, style, ...otherProps} = props
  const modalStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.MODAL_BACKGROUND,
    color: colors.TEXT,
    fontSize: 19,
    margin: '30px 20px',
    maxWidth: 600,
    padding: 50,
    ...style,
  }), [style])
  return <Modal
    style={modalStyle} skipFocusOnFirstElements={skipFocusOnFirstElements + 1}
    {...otherProps}>
    <ModalCloseButton
      shouldCloseOnEscape={true} style={buttonStyle} onClick={onClose}
      aria-describedby={otherProps['aria-labelledby']} />
    {children}
  </Modal>
}
export default React.memo(UpskillingModal)
