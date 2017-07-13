import React from 'react'
import PropTypes from 'prop-types'

import {Icon, Button} from './theme'


class Banner extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    onClose: PropTypes.func.isRequired,
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  };

  render() {
    const {children, onClose} = this.props
    const {isMobileVersion} = this.context
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
      padding: isMobileVersion ? '6px 6px 4px' : '8px 22px 6px 16px',
    }
    const closeIconStyle = {
      fontSize: 20,
      paddingBottom: 2,
      paddingRight: isMobileVersion ? 'initial' : '.5em',
      verticalAlign: 'middle',
    }
    return <div style={boxStyle}>
      <div style={{flex: 1}}>
        <div style={{margin: 'auto', maxWidth: 900, padding: 15}}>
          {children}
        </div>
      </div>
      <Button
        type="navigationOnImage" style={buttonStyle} onClick={onClose}>
        <Icon style={closeIconStyle} name="close" /> {isMobileVersion ? null : 'Fermer'}
      </Button>
    </div>
  }
}


export {Banner}
