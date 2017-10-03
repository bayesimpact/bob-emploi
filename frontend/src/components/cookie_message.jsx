import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {acceptCookiesUsageAction} from 'store/actions'

import {Banner} from './banner'
import {Routes} from './url'
import {Colors} from './theme'


class CookieMessageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isMessageShown: PropTypes.bool,
    style: PropTypes.object,
  }
  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
  }

  state = {
    isModalShown: false,
  }

  render() {
    const {isMessageShown} = this.props
    const {history} = this.context
    if (!isMessageShown) {
      return null
    }
    const cookieBoxStyle = {
      background: Colors.CHARCOAL_GREY,
      color: Colors.SILVER,
      ...this.props.style,
    }
    const tinyLinkStyle = {
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 500,
    }
    return <Banner
      style={cookieBoxStyle}
      onClose={() => this.props.dispatch(acceptCookiesUsageAction)}>
      En poursuivant votre navigation sur ce site, vous acceptez l'utilisation
      de cookies pour améliorer la qualité du service et pour réaliser des
      statistiques de visite. Vos données ne seront ni cédées à des tiers, ni
      exploitées à des fins commerciales. <a
        style={tinyLinkStyle}
        onClick={() => history.push(Routes.COOKIES_PAGE)}>
        En savoir plus
      </a>
    </Banner>
  }
}
const CookieMessage = connect(({app, user}) => ({
  isMessageShown: !(user.userId || app.userHasAcceptedCookiesUsage),
}))(CookieMessageBase)

export {CookieMessage}
