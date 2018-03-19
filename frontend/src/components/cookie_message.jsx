import CloseIcon from 'mdi-react/CloseIcon'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {acceptCookiesUsageAction} from 'store/actions'

import {Banner} from './banner'
import {Routes} from './url'
import {Button, Colors, SmoothTransitions} from './theme'


const connectCookieMessage = connect(
  ({app, user}) => ({
    isMessageShown: !(user.userId || app.userHasAcceptedCookiesUsage),
  }),
  dispatch => ({
    onAcceptCookieUsage: () => dispatch(acceptCookiesUsageAction),
  }),
)


class SimpleCookieMessage extends React.Component {
  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
  }

  render() {
    const {history} = this.context
    const linkStyle = {
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: 500,
      textDecoration: 'none',
    }
    return <div>
      En poursuivant votre navigation sur ce site, vous acceptez l'utilisation
      de cookies pour améliorer la qualité du service et pour réaliser des
      statistiques de visite. Vos données ne seront ni cédées à des tiers, ni
      exploitées à des fins commerciales. <a
        style={linkStyle}
        onClick={() => history.push(Routes.COOKIES_PAGE)}>
        En savoir plus
      </a>
    </div>
  }
}


class CookieMessageBase extends React.Component {
  static propTypes = {
    isMessageShown: PropTypes.bool,
    onAcceptCookieUsage: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {isMessageShown, onAcceptCookieUsage} = this.props
    if (!isMessageShown) {
      return null
    }
    const cookieBoxStyle = {
      background: Colors.CHARCOAL_GREY,
      color: Colors.SILVER,
      ...this.props.style,
    }
    return <Banner style={cookieBoxStyle} onClose={onAcceptCookieUsage}>
      <SimpleCookieMessage />
    </Banner>
  }
}
const CookieMessage = connectCookieMessage(CookieMessageBase)


class CookieMessageOverlayBase extends React.Component {
  static propTypes = {
    isMessageShown: PropTypes.bool.isRequired,
    onAcceptCookieUsage: PropTypes.func.isRequired,
  }

  render() {
    const {isMessageShown, onAcceptCookieUsage} = this.props
    const containerStyle = {
      backgroundColor: '#fff',
      borderRadius: 2,
      bottom: isMessageShown ? 15 : -200,
      boxShadow: '0 18px 25px 0 rgba(0, 0, 0, 0.15)',
      color: Colors.DARK,
      fontSize: 14,
      left: 15,
      opacity: isMessageShown ? 1 : 0,
      padding: '25px 20px',
      position: 'fixed',
      width: 360,
      zIndex: 1,
      ...SmoothTransitions,
    }
    const closeButtonStyle = {
      ':hover': {
        backgroundColor: Colors.COOL_GREY,
      },
      backgroundColor: Colors.LIGHT_MODAL_GREY,
      borderRadius: 50,
      height: 30,
      padding: 3,
      position: 'absolute',
      right: -15,
      top: -15,
      width: 30,
    }
    return <div style={containerStyle}>
      <Button onClick={onAcceptCookieUsage} aria-label="Fermer" style={closeButtonStyle}>
        <CloseIcon />
      </Button>
      <SimpleCookieMessage />
    </div>
  }
}
const CookieMessageOverlay = connectCookieMessage(CookieMessageOverlayBase)


export {CookieMessage, CookieMessageOverlay}
