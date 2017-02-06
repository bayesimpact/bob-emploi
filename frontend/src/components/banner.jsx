import React from 'react'

import {Icon, RoundButton} from './theme'


class Banner extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    onClose: React.PropTypes.func.isRequired,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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
      <div style={{flex: 1, margin: 'auto', maxWidth: 900, padding: 15}}>
        {children}
      </div>
      <RoundButton
          type="navigationOnImage" style={buttonStyle} onClick={onClose}>
        <Icon style={closeIconStyle} name="close" /> {isMobileVersion ? null : 'Fermer'}
      </RoundButton>
    </div>
  }
}


export {Banner}
