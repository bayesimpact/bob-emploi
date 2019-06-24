import PropTypes from 'prop-types'
import React from 'react'


interface GenericPageProps {
  bottomButton?: React.ReactNode
  children?: React.ReactNode
  footerSize: number
  style?: React.CSSProperties
}


class GenericPage extends React.PureComponent<GenericPageProps> {
  public static propTypes = {
    bottomButton: PropTypes.node,
    children: PropTypes.node,
    footerSize: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    footerSize: 124,
  }

  private renderFooter(): React.ReactNode {
    const {bottomButton, footerSize} = this.props
    const footerStyle: React.CSSProperties = {
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
    const backgroundStyle: React.CSSProperties = {
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

  public render(): React.ReactNode {
    const {children, style} = this.props
    const pageStyle: React.CSSProperties = {
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
