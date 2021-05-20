import React, {useMemo} from 'react'

import {Modal} from 'components/modal'
import ModalCloseButton from 'components/modal_close_button'

interface ModalProps extends React.ComponentProps<typeof Modal> {
  onClose: () => void
  style?: React.CSSProperties
}

const buttonStyle: RadiumCSSProperties = {
  ':hover': {
    backgroundColor: '#fff',
  },
  'backgroundColor': '#fff',
  'boxShadow': 'initial',
  'color': colors.CHARCOAL_GREY,
  'transform': 'translate(50%, 50%)',
}
const UpskillingModal = (props: ModalProps): React.ReactElement|null => {
  const {children, onClose, style, ...otherProps} = props
  const modalStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.PURPLISH_BROWN,
    color: '#fff',
    fontSize: 19,
    margin: '30px 20px',
    maxWidth: 600,
    padding: 50,
    ...style,
  }), [style])
  return <Modal style={modalStyle} {...otherProps}>
    <ModalCloseButton shouldCloseOnEscape={true} style={buttonStyle} onClick={onClose} />
    {children}
  </Modal>
}
export default React.memo(UpskillingModal)
