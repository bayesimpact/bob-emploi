import React from 'react'

import {Colors, RoundButton} from 'components/theme'
import {ShortKey} from 'components/shortkey'


class Step extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    contentStyle: React.PropTypes.object,
    fastForward: React.PropTypes.func.isRequired,
    isNextButtonDisabled: React.PropTypes.bool,
    nextButtonContent: React.PropTypes.node,
    onNextButtonClick: React.PropTypes.func.isRequired,
    onPreviousButtonClick: React.PropTypes.func,
    style: React.PropTypes.object,
    subheader: React.PropTypes.node,
  }

  render() {
    const {children, fastForward, nextButtonContent, onPreviousButtonClick,
           onNextButtonClick, contentStyle, style, subheader,
           isNextButtonDisabled} = this.props
    const stepStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    const subheaderStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 11,
      fontWeight: 'bold',
      letterSpacing: 1.2,
      lineHeight: 1.8,
      textAlign: 'center',
      textTransform: 'uppercase',
    }
    const containerStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      marginTop: 33,
      padding: '0 60px',
      width: 480,
      ...contentStyle,
    }
    return <div style={stepStyle}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={fastForward} />
      {subheader ? <div style={subheaderStyle}>{subheader}</div> : null}
      <div style={containerStyle}>
        {children}
      </div>
      <div style={{display: 'flex', marginBottom: 40, marginTop: 70}}>
        {onPreviousButtonClick ? <RoundButton
            type="back" onClick={onPreviousButtonClick} style={{marginRight: 20}}>
          Précédent
        </RoundButton> : null}
        <RoundButton type="validation" onClick={onNextButtonClick} disabled={isNextButtonDisabled}>
          {nextButtonContent || 'Suivant'}
        </RoundButton>
      </div>
    </div>
  }
}


export {Step}
