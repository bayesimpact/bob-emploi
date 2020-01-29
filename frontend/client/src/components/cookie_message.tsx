import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'

import {RootState, acceptCookiesUsageAction} from 'store/actions'

import {Banner} from 'components/banner'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {Button, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'


const connectCookieMessage = connect(
  ({app, user}: RootState): {isMessageShown: boolean} => ({
    isMessageShown: !(user.userId || app.userHasAcceptedCookiesUsage),
  }),
  (dispatch): {onAcceptCookieUsage: () => void} => ({
    onAcceptCookieUsage: (): void => {
      dispatch(acceptCookiesUsageAction)
    },
  }),
)


const SimpleCookieMessageBase: React.FC<{}> = (): React.ReactElement => {
  const linkStyle: React.CSSProperties = {
    color: 'inherit',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: isMobileVersion ? 'underline' : 'none',
  }
  if (isMobileVersion) {
    return <Trans>
      Ce site utilise des <Link style={linkStyle} to={Routes.COOKIES_PAGE}>cookies</Link>.
    </Trans>
  }
  return <Trans>
    En poursuivant votre navigation sur ce site, vous acceptez l'utilisation de cookies pour
    améliorer la qualité du service et pour réaliser des statistiques de visite. Vos données ne
    seront ni cédées à des tiers, ni exploitées à des fins commerciales. <Link
      style={linkStyle} to={Routes.COOKIES_PAGE}>
      En savoir plus
    </Link>
  </Trans>
}
const SimpleCookieMessage = React.memo(SimpleCookieMessageBase)


interface CookieMessageProps {
  isMessageShown: boolean
  onAcceptCookieUsage: () => void
  style?: React.CSSProperties
}


// TODO(marielaure): Check if this is used in desktop.
const CookieMessageBase: React.FC<CookieMessageProps> =
  (props: CookieMessageProps): React.ReactElement|null => {
    const {isMessageShown, onAcceptCookieUsage} = props
    if (!isMessageShown) {
      return null
    }
    const cookieBoxStyle = {
      background: colors.CHARCOAL_GREY,
      color: isMobileVersion ? '#fff' : colors.SILVER,
      ...props.style,
    }
    return <Banner
      style={cookieBoxStyle} onClose={onAcceptCookieUsage} hasRoundButton={isMobileVersion}>
      <SimpleCookieMessage />
    </Banner>
  }
CookieMessageBase.propTypes = {
  isMessageShown: PropTypes.bool,
  onAcceptCookieUsage: PropTypes.func.isRequired,
  style: PropTypes.object,
}
const CookieMessage = connectCookieMessage(React.memo(CookieMessageBase))




interface CookieMessageOverlayProps {
  isMessageShown: boolean
  onAcceptCookieUsage: () => void
  style?: React.CSSProperties
}


const CookieMessageOverlayBase: React.FC<CookieMessageOverlayProps> =
  (props: CookieMessageOverlayProps): React.ReactElement => {
    const {isMessageShown, onAcceptCookieUsage} = props
    const containerStyle: React.CSSProperties = {
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
    const closeButtonStyle: React.CSSProperties & {':hover': React.CSSProperties} = {
      ':hover': {
        backgroundColor: colors.COOL_GREY,
      },
      'backgroundColor': colors.MODAL_PROJECT_GREY,
      'borderRadius': 50,
      'height': 30,
      'padding': 3,
      'position': 'absolute',
      'right': -15,
      'top': -15,
      'width': 30,
    }
    return <div style={containerStyle}>
      <Button onClick={onAcceptCookieUsage} aria-label="Fermer" style={closeButtonStyle}>
        <CloseIcon color={colors.DARK} />
      </Button>
      <SimpleCookieMessage />
    </div>
  }
CookieMessageOverlayBase.propTypes = {
  isMessageShown: PropTypes.bool.isRequired,
  onAcceptCookieUsage: PropTypes.func.isRequired,
}
const CookieMessageOverlay = connectCookieMessage(React.memo(CookieMessageOverlayBase))


export {CookieMessage, CookieMessageOverlay}
