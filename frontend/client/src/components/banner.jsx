import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {Button} from 'components/theme'


class Banner extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    hasRoundButton: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    style: PropTypes.object,
  }


  render() {
    const {children, hasRoundButton, onClose} = this.props
    const boxStyle = {
      display: 'flex',
      fontSize: 14,
      textAlign: 'center',
      ...this.props.style,
    }
    const buttonStyle = {
      alignSelf: 'flex-start',
      bottom: isMobileVersion ? 5 : 'initial',
      marginRight: isMobileVersion ? 5 : 15,
      marginTop: isMobileVersion ? 5 : 15,
      padding: hasRoundButton ? '6px 6px 6px' :
        isMobileVersion ? '6px 6px 4px' : '9px 22px 5px 16px',
    }
    const closeIconStyle = {
      fill: '#fff',
      height: 24,
      paddingBottom: hasRoundButton ? 0 : 3,
      paddingRight: isMobileVersion ? 'initial' : '10px',
      verticalAlign: 'middle',
      width: hasRoundButton ? 24 : 30,
    }
    return <div style={boxStyle}>
      <div style={{flex: 1}}>
        <div style={{margin: 'auto', maxWidth: 900, padding: 15}}>
          {children}
        </div>
      </div>
      <Button
        type="navigationOnImage" style={buttonStyle} onClick={onClose}
        isNarrow={hasRoundButton} isRound={hasRoundButton}
        aria-label="Fermer">
        <CloseIcon style={closeIconStyle} /> {isMobileVersion ? null : 'Fermer'}
      </Button>
    </div>
  }
}


export {Banner}
