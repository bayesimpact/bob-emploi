import CloseIcon from 'mdi-react/CloseIcon'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'

import {acceptCookiesUsageAction} from 'store/actions'

import {Banner} from 'components/banner'
import {isMobileVersion} from 'components/mobile'
import {Button, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'


const connectCookieMessage = connect(
  ({app, user}) => ({
    isMessageShown: !(user.userId || app.userHasAcceptedCookiesUsage),
  }),
  dispatch => ({
    onAcceptCookieUsage: () => dispatch(acceptCookiesUsageAction),
  }),
)


class SimpleCookieMessage extends React.Component {
  render() {
    const linkStyle = {
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: 600,
      textDecoration: isMobileVersion ? 'underline' : 'none',
    }
    return <div>
      {isMobileVersion ? 'Ce site utilise des ' : 'En poursuivant votre navigation sur ce ' +
      "site, vous acceptez l'utilisation de cookies pour améliorer la qualité du service et pour " +
      'réaliser des statistiques de visite. Vos données ne seront ni cédées à des tiers, ni ' +
      'exploitées à des fins commerciales.'} <Link
        style={linkStyle}
        to={Routes.COOKIES_PAGE}>
        {isMobileVersion ? 'cookies.' : 'En savoir plus'}
      </Link>
    </div>
  }
}


// TODO(marielaure): Check if this is used in desktop.
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
      background: colors.CHARCOAL_GREY,
      color: isMobileVersion ? '#fff' : colors.SILVER,
      ...this.props.style,
    }
    return <Banner
      style={cookieBoxStyle} onClose={onAcceptCookieUsage} hasRoundButton={isMobileVersion}>
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
      color: colors.DARK,
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
        backgroundColor: colors.COOL_GREY,
      },
      backgroundColor: colors.MODAL_PROJECT_GREY,
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
        <CloseIcon color={colors.DARK} />
      </Button>
      <SimpleCookieMessage />
    </div>
  }
}
const CookieMessageOverlay = connectCookieMessage(CookieMessageOverlayBase)


export {CookieMessage, CookieMessageOverlay}
