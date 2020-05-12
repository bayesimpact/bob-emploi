import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {useSelector} from 'react-redux'
import {Link} from 'react-router-dom'

import {RootState, acceptCookiesUsageAction, useDispatch} from 'store/actions'

import {Banner} from 'components/banner'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {Button, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'


interface CookieMessageStore {
  isMessageShown: boolean
  onAcceptCookieUsage: () => void
}

const useCookieStore = (): CookieMessageStore => {
  const isMessageShown = useSelector(({app, user}: RootState) =>
    !(user.userId || app.userHasAcceptedCookiesUsage))
  const dispatch = useDispatch()
  const onAcceptCookieUsage = (): void => {
    dispatch(acceptCookiesUsageAction)
  }
  return {isMessageShown, onAcceptCookieUsage}
}


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
  style?: React.CSSProperties
}


const CookieMessageBase: React.FC<CookieMessageProps> =
  ({style}: CookieMessageProps): React.ReactElement|null => {
    const {isMessageShown, onAcceptCookieUsage} = useCookieStore()
    if (!isMessageShown) {
      return null
    }
    const cookieBoxStyle = {
      background: colors.CHARCOAL_GREY,
      color: isMobileVersion ? '#fff' : colors.SILVER,
      ...style,
    }
    return <Banner
      style={cookieBoxStyle} onClose={onAcceptCookieUsage} hasRoundButton={isMobileVersion}>
      <SimpleCookieMessage />
    </Banner>
  }
CookieMessageBase.propTypes = {
  style: PropTypes.object,
}
const CookieMessage = React.memo(CookieMessageBase)


const CookieMessageOverlayBase: React.FC = (): React.ReactElement => {
  const {isMessageShown, onAcceptCookieUsage} = useCookieStore()
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
const CookieMessageOverlay = React.memo(CookieMessageOverlayBase)


export {CookieMessage, CookieMessageOverlay}
