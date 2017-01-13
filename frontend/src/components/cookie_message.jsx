import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'

import {acceptCookiesUsageAction} from 'store/actions'

import {Routes} from './url'
import {Colors, Icon, RoundButton} from './theme'


class CookieMessageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isMessageShown: React.PropTypes.bool,
    isMobileVersion: React.PropTypes.bool.isRequired,
    style: React.PropTypes.object,
  }

  state = {
    isModalShown: false,
  }

  render() {
    const {isMessageShown, isMobileVersion} = this.props
    if (!isMessageShown) {
      return null
    }
    const cookieBoxStyle = {
      background: Colors.CHARCOAL_GREY,
      color: Colors.SILVER,
      display: 'flex',
      fontSize: 15,
      textAlign: 'center',
      ...this.props.style,
    }
    const tinyLinkStyle = {
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 500,
    }
    const buttonStyle = {
      alignSelf: 'flex-start',
      bottom: isMobileVersion ? 5 : 'initial',
      marginRight: isMobileVersion ? 5 : 15,
      marginTop: isMobileVersion ? 'initial' : 15,
      padding: isMobileVersion ? '6px 6px 4px' : '8px 22px 6px 16px',
    }
    const closeIconStyle = {
      fontSize: 20,
      paddingBottom: 2,
      paddingRight: isMobileVersion ? 'initial' : '.5em',
      verticalAlign: 'middle',
    }
    return <div style={cookieBoxStyle}>
      <div style={{flex: 1, margin: 'auto', maxWidth: 900, padding: 15}}>
        En poursuivant votre navigation sur ce site, vous acceptez l'utilisation
        de cookies pour améliorer la qualité du service et pour réaliser des
        statistiques de visite. Vos données ne seront ni cédées à des tiers, ni
        exploitées à des fins commerciales. <a
            style={tinyLinkStyle}
            onClick={() => browserHistory.push(Routes.COOKIES_PAGE)}>
          En savoir plus
        </a>
      </div>
      <RoundButton
          type="navigationOnImage" style={buttonStyle}
          onClick={() => this.props.dispatch(acceptCookiesUsageAction)}>
        <Icon style={closeIconStyle} name="close" /> {isMobileVersion ? null : 'Fermer'}
      </RoundButton>
    </div>
  }
}
const CookieMessage = connect(({app, user}) => ({
  isMessageShown: !(user.userId || app.userHasAcceptedCookiesUsage),
  isMobileVersion: app.isMobileVersion,
}))(CookieMessageBase)

export {CookieMessage}
