import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'

import {FeatureLikeDislikeButtons} from 'components/like'
import {Colors, Icon, SmoothTransitions} from 'components/theme'


class AdviceBox extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    feature: PropTypes.string.isRequired,
    header: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, feature, header, style} = this.props
    const {padding, ...outerStyle} = style
    const containerStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      ...outerStyle,
    }
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: '4px 4px 0 0',
      display: 'flex',
      fontSize: 16,
      justifyContent: 'center',
      padding: 30,
      textAlign: 'center',
    }
    const contentStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      fontSize: 13,
      padding: (padding || padding === 0) ? padding : '20px 35px',
      position: 'relative',
    }
    return <div style={containerStyle}>
      <header style={headerStyle}>
        {header}
      </header>

      <div style={contentStyle}>
        <FeatureLikeDislikeButtons
          style={{position: 'absolute', right: 30, top: -16}}
          feature={feature} />
        {children}
      </div>
    </div>
  }
}


class ToolCardBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    href: PropTypes.string.isRequired,
    imageSrc: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {children, imageSrc, href, style} = this.props
    const cardStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      cursor: 'pointer',
      display: 'flex',
      padding: 10,
      ...SmoothTransitions,
      ...style,
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      fontSize: 14,
      fontWeight: 'bold',
    }
    return <div style={cardStyle} onClick={() => window.open(href, '_blank')}>
      <div style={titleStyle}>
        <img src={imageSrc}
          style={{height: 55, width: 55}} />
        <div style={{paddingLeft: 20}}>{children}</div>
      </div>
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }
}
const ToolCard = Radium(ToolCardBase)


export {AdviceBox, ToolCard}
