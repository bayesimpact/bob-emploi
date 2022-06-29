import CloseIcon from 'mdi-react/CloseIcon'
import React from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {Link} from 'react-router-dom'

import type {RootState} from 'store/actions'
import {acceptCookiesUsageAction, useDispatch} from 'store/actions'
import isMobileVersion from 'store/mobile'

import Banner from 'components/banner'
import Button from 'components/button'
import Trans from 'components/i18n_trans'
import {SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'


interface CookieMessageStore {
  isMessageShown: boolean
  onAcceptCookieUsage: () => void
}

const useCookieStore = (): CookieMessageStore => {
  const isMessageShown = useSelector(({app}: RootState) =>
    !(app.userHasAcceptedCookiesUsage || !app.areAdsCookieUsageRequested))
  const dispatch = useDispatch()
  const onAcceptCookieUsage = (): void => {
    dispatch(acceptCookiesUsageAction)
  }
  return {isMessageShown, onAcceptCookieUsage}
}


const SimpleCookieMessageBase = ({isShown = true}: {isShown?: boolean}): React.ReactElement => {
  const linkStyle: React.CSSProperties = {
    color: 'inherit',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: isMobileVersion ? 'underline' : 'none',
  }
  if (isMobileVersion) {
    return <Trans ns="components">
      Ce site utilise des <Link
        style={linkStyle} to={Routes.COOKIES_PAGE} tabIndex={isShown ? 0 : -1}>cookies</Link>.
    </Trans>
  }
  return <Trans ns="components">
    En poursuivant votre navigation sur ce site, vous acceptez l'utilisation de cookies pour
    améliorer la qualité du service et pour réaliser des statistiques de visite. Vos données ne
    seront ni cédées à des tiers, ni exploitées à des fins commerciales. <Link
      style={linkStyle} to={Routes.COOKIES_PAGE} tabIndex={isShown ? 0 : -1}>
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
const CookieMessage = React.memo(CookieMessageBase)


const CookieMessageOverlayBase: React.FC = (): React.ReactElement => {
  const {isMessageShown, onAcceptCookieUsage} = useCookieStore()
  const {t} = useTranslation('components')
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
  return <aside style={containerStyle} aria-hidden={!isMessageShown}>
    <Button
      onClick={onAcceptCookieUsage} aria-label={t('Fermer')} style={closeButtonStyle}
      tabIndex={isMessageShown ? 0 : -1}>
      <CloseIcon color={colors.DARK} />
    </Button>
    <SimpleCookieMessage isShown={isMessageShown} />
  </aside>
}
const CookieMessageOverlay = React.memo(CookieMessageOverlayBase)


export {CookieMessage, CookieMessageOverlay}
