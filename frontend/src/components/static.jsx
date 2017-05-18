import React from 'react'
import PropTypes from 'prop-types'

import {Footer, PageWithNavigationBar} from 'components/navigation'
import {Colors} from 'components/theme'


class StrongTitle extends React.Component {
  static propTypes = {
    children: PropTypes.node,
  }

  render() {
    return <strong style={{color: Colors.SKY_BLUE}}>
      {this.props.children}
    </strong>
  }
}


class StaticPage extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    page: PropTypes.string.isRequired,
    style: PropTypes.object,
    // The title of the page. If not set, the layout is quite different as we
    // drop not only the title but also the separator and the "paper sheet"
    // style.
    title: PropTypes.node,
  }

  render() {
    const {children, page, style, title} = this.props
    const pageStyle = {
      backgroundColor: '#fff',
      color: Colors.CHARCOAL_GREY,
      margin: 'auto',
      maxWidth: 1200,
      overflowX: 'hidden',
    }
    const headerStyle = {
      alignItems: 'center',
      alignSelf: 'center',
      color: Colors.SLATE,
      display: 'flex',
      fontSize: 50,
      height: 200,
      justifyContent: 'center',
      lineHeight: 1,
      textAlign: 'center',
    }
    const separatorStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      border: 'none',
      height: 1,
      width: '100%',
    }
    return <PageWithNavigationBar
        style={{...(title ? {} : style)}}
        page={page}  isContentScrollable={true}>
      {title ? (
        <div style={pageStyle}>
          <header style={headerStyle}>
            {title}
          </header>

          <hr style={separatorStyle} />

          <div style={{flex: 1, padding: 100, ...style}}>
            {children}
          </div>
        </div>
      ) : <div style={{flexShrink: 0}}>{children}</div>}

      <Footer page={page} style={{flexShrink: 0}} />
    </PageWithNavigationBar>
  }
}

export {StaticPage, StrongTitle}
