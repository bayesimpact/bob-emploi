import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {Link} from 'react-router-dom'

import useFastForward from 'hooks/fast_forward'
import {DispatchAllActions, startAsGuest} from 'store/actions'

import facebookImage from 'images/facebook.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=%23fff'
import twitterImage from 'images/twitter.svg'

import Button from 'components/button'
import {useHelpDeskLinkProps} from 'components/help_desk_link'
import Trans from 'components/i18n_trans'
import isMobileVersion from 'store/mobile'
import {PageWithNavigationBar, PageWithNavigationBarProps,
  WithScrollNavBar} from 'components/navigation'
import {STATIC_ADVICE_MODULES} from 'components/pages/static/static_advice/base'
import {RadiumExternalLink, SmartLink} from 'components/radium'
import {MIN_CONTENT_PADDING, MAX_CONTENT_WIDTH, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'


type FooterLinkProps = React.ComponentProps<typeof SmartLink> & {
  isSelected?: boolean
}


interface RadiumCSSProperties extends React.CSSProperties {
  ':focus': React.CSSProperties
  ':hover': React.CSSProperties
}


const FooterLinkBase: React.FC<FooterLinkProps> = (props: FooterLinkProps): React.ReactElement => {
  const {isSelected, style, ...linkProps} = props
  const linkStyle = useMemo((): RadiumCSSProperties => ({
    ':focus': {
      color: '#fff',
    },
    ':hover': {
      color: '#fff',
    },
    'color': isSelected ? '#fff' : colors.COOL_GREY,
    'display': 'block',
    'fontSize': 13,
    'fontWeight': 'bold',
    'padding': '5px 0',
    ...SmoothTransitions,
    ...style,
  }), [isSelected, style])
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <SmartLink style={linkStyle} {...linkProps} />
}
FooterLinkBase.propTypes = {
  isSelected: PropTypes.bool,
  style: PropTypes.object,
  to: PropTypes.string,
}
const FooterLink = React.memo(FooterLinkBase)


interface FooterProps {
  page?: string
  style?: React.CSSProperties
}

interface FooterSectionProps {
  children: React.ReactNode
  title: React.ReactNode
}

const footerLinkPadding = isMobileVersion ? 12 : 10
const footerSectionStyle: React.CSSProperties = {
  paddingBottom: footerLinkPadding,
  paddingTop: footerLinkPadding,
  width: isMobileVersion ? 170 : 130,
}
const footerSectionHeaderStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 11,
  marginBottom: 15,
  textTransform: 'uppercase',
}
const FooterSectionBase: React.FC<FooterSectionProps> = ({children, title}): React.ReactElement =>
  <section style={footerSectionStyle}>
    <header style={footerSectionHeaderStyle}>
      {title}
    </header>

    {children}
  </section>
FooterSectionBase.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.node.isRequired,
}
const FooterSection = React.memo(FooterSectionBase)

const FooterBase: React.FC<FooterProps> = ({page, style}) => {
  const {t} = useTranslation()
  const {t: translate} = useTranslation('staticAdviceTitle')
  const footerSectionStyle: React.CSSProperties = {
    backgroundColor: colors.DARK_BLUE,
    color: colors.COOL_GREY,
    padding: isMobileVersion ? '35px 0' : `80px ${MIN_CONTENT_PADDING}px`,
    textAlign: isMobileVersion ? 'center' : 'left',
    ...style,
  }
  const linksfooterSectionStyle: React.CSSProperties = {
    alignItems: isMobileVersion ? 'center' : 'stretch',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    fontWeight: 'bold',
    justifyContent: 'space-between',
    padding: '20px 0',
  }
  const logoStyle: React.CSSProperties = {
    height: 30,
    marginBottom: isMobileVersion ? 35 : 0,
  }
  const iconPadding = 8
  const iconStyle: RadiumCSSProperties = {
    ':focus': {opacity: 1},
    ':hover': {opacity: 1},
    'alignItems': 'center',
    'cursor': 'pointer',
    'display': 'block',
    'fontSize': 'inherit',
    'fontWeight': 'inherit',
    'marginLeft': 'initial',
    'opacity': .5,
    'paddingBottom': iconPadding,
    'paddingLeft': iconPadding,
    'paddingRight': iconPadding,
    'paddingTop': iconPadding,
    ...SmoothTransitions,
  }
  const helpDeskLinkProps = useHelpDeskLinkProps()
  return <footer style={footerSectionStyle}>
    <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
      <div style={{textAlign: isMobileVersion ? 'center' : 'initial'}}>
        <img src={logoProductWhiteImage} style={logoStyle} alt={config.productName} />
      </div>

      <div style={linksfooterSectionStyle}>
        <FooterSection title={config.productName}>
          <FooterLink to={Routes.ROOT} isSelected={page === 'landing'}>
            {t('Découvrir')}
          </FooterLink>

          <FooterLink to={Routes.TRANSPARENCY_PAGE} isSelected={page === 'transparency'}>
            {t('Métriques')}
          </FooterLink>

          <FooterLink to={Routes.VISION_PAGE} isSelected={page === 'vision'}>
            {t('Notre mission')}
          </FooterLink>
        </FooterSection>

        <FooterSection title={t('À propos')}>
          <FooterLink to={Routes.TEAM_PAGE} isSelected={page === 'equipe'}>
            {t('Équipe')}
          </FooterLink>

          <FooterLink href="https://www.bayesimpact.org">
            Bayes Impact
          </FooterLink>

          <FooterLink to={Routes.PARTNERS_PAGE} isSelected={page === 'partners'}>
            {t('Partenaires')}
          </FooterLink>
        </FooterSection>

        <FooterSection title={t('Aide')}>
          <FooterLink {...helpDeskLinkProps}>{t('Nous contacter')}</FooterLink>

          <FooterLink to={Routes.PROFESSIONALS_PAGE} isSelected={page === 'professionals'}>
            {t('Accompagnateurs')}
          </FooterLink>

          <FooterLink to={Routes.CONTRIBUTION_PAGE} isSelected={page === 'contribution'}>
            {t('Contribuer')}
          </FooterLink>
        </FooterSection>

        <FooterSection title={t('Légal')}>
          <FooterLink to={Routes.TERMS_AND_CONDITIONS_PAGE} isSelected={page === 'terms'}>
            {t('CGU')}
          </FooterLink>

          <FooterLink to={Routes.PRIVACY_PAGE} isSelected={page === 'privacy'}>
            {t('Vie privée')}
          </FooterLink>

          <FooterLink to={Routes.COOKIES_PAGE} isSelected={page === 'cookies'}>
            {t('Cookies')}
          </FooterLink>
        </FooterSection>

        <FooterSection title={t('Nos conseils')}>
          {STATIC_ADVICE_MODULES.map(({adviceId, name}): React.ReactNode =>
            <FooterLink
              to={Routes.STATIC_ADVICE_PAGE + `/${adviceId}`}
              isSelected={page === `static-${adviceId}`} key={adviceId}>
              {translate(...name)}
            </FooterLink>)}
        </FooterSection>

        <div style={{alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between'}}>
          <RadiumExternalLink style={iconStyle} href="https://www.facebook.com/bobemploi">
            <img src={facebookImage} alt="Facebook" />
          </RadiumExternalLink>

          <RadiumExternalLink
            style={{...iconStyle, paddingRight: isMobileVersion ? iconPadding : 0}}
            href="https://twitter.com/bobemploi">
            <img src={twitterImage} alt="Twitter" />
          </RadiumExternalLink>
        </div>
      </div>
    </div>
  </footer>
}
FooterBase.propTypes = {
  page: PropTypes.string.isRequired,
  style: PropTypes.object,
}
const Footer = React.memo(FooterBase)


const blueStyle = {color: colors.BOB_BLUE}
const StrongTitleBase: React.FC<{children: React.ReactNode}> =
({children}: {children: React.ReactNode}): React.ReactElement => <strong style={blueStyle}>
  {children}
</strong>
StrongTitleBase.propTypes = {
  children: PropTypes.node,
}
const StrongTitle = React.memo(StrongTitleBase)


interface StaticPageProps extends PageWithNavigationBarProps {
  children: React.ReactNode
  isContentScrollable?: boolean
  page: string
  style?: React.CSSProperties
  title?: React.ReactNode
}


const pageStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: colors.CHARCOAL_GREY,
  margin: 'auto',
  maxWidth: 1200,
  overflowX: 'hidden',
}
const separatorStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_GREY,
  border: 'none',
  height: 1,
  width: '100%',
}
const noFlexShrink = {flexShrink: 0}


const StaticPageBase: React.FC<StaticPageProps> = (props: StaticPageProps): React.ReactElement => {
  const {children, isContentScrollable = true, page, style, title, ...extraProps} = props
  const footerSectionHeaderStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    alignSelf: 'center',
    color: colors.SLATE,
    display: 'flex',
    fontFamily: style && style.fontFamily || 'inherit',
    fontSize: 50,
    justifyContent: 'center',
    lineHeight: 1,
    minHeight: 200,
    padding: isMobileVersion ? '20px 0' : 'initial',
    textAlign: 'center',
  }), [style])
  const contentStyle = useMemo((): React.CSSProperties => ({
    flex: 1,
    padding: isMobileVersion ? 20 : 100,
    ...style,
  }), [style])
  const needsScrollNavBar = useMemo((): boolean => isContentScrollable === false,
    [isContentScrollable])
  const contentPage = useMemo((): React.ReactNode => {
    return <React.Fragment>
      {title ? (
        <div style={pageStyle}>
          <header style={footerSectionHeaderStyle}>
            {title}
          </header>

          <hr style={separatorStyle} />

          <div style={contentStyle}>
            {children}
          </div>
        </div>
      ) : <div style={noFlexShrink}>{children}</div>}
      <Footer page={page} style={noFlexShrink} />
    </React.Fragment>
  }, [children, contentStyle, footerSectionHeaderStyle, page, title])
  return <PageWithNavigationBar
    style={{...(title ? {} : style)}}
    page={page} isContentScrollable={isContentScrollable} {...extraProps}>
    {needsScrollNavBar ? <WithScrollNavBar>{contentPage}</WithScrollNavBar>
      : contentPage}
  </PageWithNavigationBar>
}
StaticPageBase.propTypes = {
  children: PropTypes.node,
  page: PropTypes.string.isRequired,
  style: PropTypes.object,
  // The title of the page. If not set, the layout is quite different as we
  // drop not only the title but also the separator and the "paper sheet"
  // style.
  title: PropTypes.node,
}
const StaticPage = React.memo(StaticPageBase)


interface TitleSectionProps {
  isLoginButtonShown?: boolean
  pageContent: {
    fontSize?: number
    subtitle?: string
    title: React.ReactNode
  }
  style?: React.CSSProperties
}


const buttonGroupStyle: React.CSSProperties = isMobileVersion ? {} : {
  alignItems: 'center',
  display: 'inline-flex',
  flexDirection: 'column',
  margin: isMobileVersion ? 'auto' : 0,
  width: 'fit-content',
}
const startDiagnosticButtonStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 15 : 18,
  fontWeight: 'bold',
  padding: isMobileVersion ? '19px 40px 18px' : '19px 50px 18px',
  ...isMobileVersion ? {width: '100%'} : {},
}
const subButtonTextStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 16,
  marginLeft: 8,
  marginTop: 12,
  // To center vertically the Lato font.
  paddingTop: '.25em',
  textAlign: 'center',
}


const TitleLoginButtons: React.FC = () => {
  const {t} = useTranslation()
  const dispatch = useDispatch<DispatchAllActions>()
  const onClick = useCallback((): void => {
    dispatch(startAsGuest('title'))
  }, [dispatch])
  useFastForward(
    (): void => void dispatch(startAsGuest('fast-forward')),
    [dispatch], Routes.INTRO_PAGE)
  return <div style={buttonGroupStyle}>
    <Link to={Routes.INTRO_PAGE} onClick={onClick}>
      <Button type="navigation" style={startDiagnosticButtonStyle}>
        {t('Je débloque ma recherche')}
      </Button>
    </Link>
    <div style={subButtonTextStyle}>
      {t("En plus c'est gratuit\u00A0!")}
    </div>
  </div>
}

const TitleSectionBase: React.FC<TitleSectionProps> = (props): React.ReactElement => {
  const {isLoginButtonShown, pageContent, style} = props
  const {fontSize, subtitle, title} = pageContent
  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    color: colors.DARK_TWO,
    fontSize: isMobileVersion ? 39 : (fontSize || 55),
    padding: isMobileVersion ? '30px 30px 60px' : `110px ${MIN_CONTENT_PADDING}px 60px`,
    position: 'relative',
    textAlign: 'left',
    // Make sure that the suggestions in the search bar go over the next section.
    zIndex: 1,
    ...style,
  }
  const titleStyle: React.CSSProperties = {
    fontSize: isMobileVersion ? 43 : 55,
    fontWeight: 900,
    margin: '0 0 55px',
  }
  const subTitleStyle: React.CSSProperties = {
    fontSize: isMobileVersion ? 20 : 18,
    maxWidth: 400,
    padding: '20px 0 70px',
  }
  const containerStyle: React.CSSProperties = isMobileVersion ? {
    margin: 0,
    position: 'relative',
  } : {
    margin: '0 auto',
    maxWidth: MAX_CONTENT_WIDTH,
    position: 'relative',
  }
  return <section style={sectionStyle}>
    <div style={containerStyle}>
      <h1 style={titleStyle}>{title ? title : <Trans parent="span">
        En 5 minutes, découvrez comment<br />
        débloquer votre recherche d'emploi&nbsp;!
      </Trans>}</h1>
      {isLoginButtonShown ? <React.Fragment>
        {subtitle ? <div style={subTitleStyle}>{subtitle}</div> : null}
        <TitleLoginButtons />
      </React.Fragment> : null}
    </div>
  </section>
}
TitleSectionBase.propTypes = {
  isLoginButtonShown: PropTypes.bool,
  pageContent: PropTypes.shape({
    fontSize: PropTypes.number,
    subtitle: PropTypes.string,
    title: PropTypes.node.isRequired,
  }).isRequired,
  style: PropTypes.object,
}
const TitleSection = React.memo(TitleSectionBase)


export {StaticPage, StrongTitle, TitleSection}
