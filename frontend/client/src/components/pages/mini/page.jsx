import PropTypes from 'prop-types'
import React from 'react'


class GenericPage extends React.Component {
  static propTypes = {
    bottomButton: PropTypes.node,
    children: PropTypes.node,
    footerSize: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  static defaultProps = {
    footerSize: 124,
  }

  renderFooter() {
    const {bottomButton, footerSize} = this.props
    const footerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      height: footerSize,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      zIndex: 0,
    }
    const backgroundStyle = {
      backgroundColor: colors.MINI_FOOTER_GREY,
      borderRadius: '100% 100% 0 0',
      height: '150%',
      left: '50%',
      position: 'absolute',
      top: 0,
      transform: 'translateX(-50%)',
      width: '200%',
      zIndex: -1,
    }
    return <div style={footerStyle}>
      <div style={backgroundStyle} />
      {bottomButton}
    </div>
  }

  render() {
    const {children, style} = this.props
    const pageStyle = {
      alignItems: 'center',
      backgroundColor: colors.MINI_BACKGROUND_GREY,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      ...style,
    }
    return <div style={pageStyle}>
      {children}
      {this.renderFooter()}
    </div>
  }
}


export {GenericPage}
