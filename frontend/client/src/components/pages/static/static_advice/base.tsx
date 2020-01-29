import {TFunction} from 'i18next'
import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import {stringify} from 'query-string'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, staticAdvicePageIsShown} from 'store/actions'

import {CardCarousel} from 'components/card_carousel'
import {CookieMessageOverlay} from 'components/cookie_message'
import {Trans} from 'components/i18n'
import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {ShareModal} from 'components/share'
import {StaticPage, TitleSection} from 'components/static'
import {TestimonialStaticSection} from 'components/testimonials'
import {MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  Styles} from 'components/theme'
import {getAbsoluteUrl, Routes} from 'components/url'

import defaultAdviceImage from 'images/improve-resume.png'

import AssociationHelp from './association_help'
import Events from './events'
import Interview from './interview'
import MotivationLetter from './motivation_letter'
import Offers from './offers'
import Relocate from './relocate'
import Resume from './resume'
import SelfConfidence from './confidence'
import Skills from './skills'


interface AdviceModule {
  adviceId: string
  name: string
  StaticAdviceCard: React.ComponentType<CardProps>
  Page: React.ComponentType<AdvicePageProps>
}


const STATIC_ADVICE_MODULES: readonly AdviceModule[] = [
  AssociationHelp,
  Events,
  Interview,
  MotivationLetter,
  Offers,
  Relocate,
  Resume,
  SelfConfidence,
  Skills,
]

const TRACK_HASH = '#sa'


export interface CardProps {
  style?: React.CSSProperties
  t: TFunction
}


interface AdviceCardProps extends CardProps {
  children: React.ReactNode
  name: string
  picto: string
}


const imageCardStyle = {height: 80, marginTop: 30, width: 80}
const childrenCardStyle = {padding: 40}

const StaticAdviceCard = (props: AdviceCardProps): React.ReactElement => {
  const {children, name, picto, style, t: omittedT, ...otherProps} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: '#fff',
    color: '#000',
    flexDirection: 'column',
    textAlign: 'center',
    ...style,
  }), [style])

  return <div style={containerStyle} {...otherProps}>
    <img style={imageCardStyle} src={picto} alt={name} />
    <div style={childrenCardStyle}>{children}</div>
  </div>
}
StaticAdviceCard.ropTypes = {
  children: PropTypes.node,
  name: PropTypes.string,
  picto: PropTypes.string,
  style: PropTypes.object,
}
const StaticAdviceCardBase = React.memo(StaticAdviceCard)


const sectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '20px 0',
  position: 'relative',
}
const headerStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 28 : 33,
  fontWeight: 'normal',
  margin: 'auto',
  maxWidth: 750,
  padding: '80px 10px',
  textAlign: 'center',
}
const linkStyle: React.CSSProperties = {
  borderRadius: 10,
  boxShadow: '0 15px 40px 0 rgba(0, 0, 0, 0.25)',
  textDecoration: 'initial',
}
const staticAdviceCardStyle: React.CSSProperties = {
  height: '100%',
}


const StaticAdviceNavigationBase = (props: {currentAdviceId?: string}): React.ReactElement|null => {
  const {currentAdviceId} = props

  const adviceCardsToShow = useMemo(
    (): readonly AdviceModule[] => STATIC_ADVICE_MODULES.filter(
      ({adviceId, StaticAdviceCard}): boolean =>
        adviceId !== currentAdviceId && !!StaticAdviceCard,
    ),
    [currentAdviceId],
  )
  const {t} = useTranslation('staticAdvice')

  if (!adviceCardsToShow.length) {
    return null
  }
  return <section style={sectionStyle}>
    <Trans parent="h2" style={headerStyle} t={t}>
      {{productName: config.productName}} peut aussi augmenter l'efficacité de
      votre <strong>recherche d'emploi</strong> grâce à&nbsp;:
    </Trans>
    <CardCarousel maxWidth={MAX_CONTENT_WIDTH}>
      {adviceCardsToShow.map(({StaticAdviceCard, adviceId}): ReactStylableElement =>
        <Link
          style={linkStyle} key={`advice-${adviceId}`}
          to={Routes.STATIC_ADVICE_PAGE + `/${adviceId}`}>
          <StaticAdviceCard style={staticAdviceCardStyle} t={t} />
        </Link>)}
    </CardCarousel>
  </section>
}
StaticAdviceNavigationBase.propTypes = {
  currentAdviceId: PropTypes.string,
}
const StaticAdviceNavigation = React.memo(StaticAdviceNavigationBase)


interface AdviceCardConnectedProps {
  hasSeenShareModal?: boolean
}


export interface AdvicePageProps extends RouteComponentProps<{}>, AdviceCardConnectedProps {
  t: TFunction
}


interface StaticAdvicePageProps extends AdvicePageProps {
  adviceId: string
  children?: React.ReactNode
  dispatch: DispatchAllActions
  testimonials: readonly React.ReactElement<{author: {name: string}}>[]
  title?: string
}


interface AdvicePageState {
  isShareBobShown: boolean
}


class StaticAdvicePageBase extends React.PureComponent<StaticAdvicePageProps, AdvicePageState> {
  public static propTypes = {
    adviceId: PropTypes.string.isRequired,
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    hasSeenShareModal: PropTypes.bool,
    location: ReactRouterPropTypes.location.isRequired,
    t: PropTypes.func.isRequired,
    testimonials: PropTypes.arrayOf(PropTypes.element.isRequired),
    title: PropTypes.string.isRequired,
  }

  public state: AdvicePageState = {
    isShareBobShown: false,
  }

  public componentDidMount(): void {
    const {adviceId} = this.props
    this.props.dispatch(staticAdvicePageIsShown(adviceId))
  }

  public componentWillUnmount(): void {
    clearTimeout(this.shareTimeout)
  }

  private shareTimeout?: number

  private handleVisibilityChange = (isVisible: boolean): void => {
    if (!this.props.hasSeenShareModal && isVisible) {
      clearTimeout(this.shareTimeout)
      this.shareTimeout = window.setTimeout((): void => {
        this.setState({isShareBobShown: true})
      }, 5000)
    }
  }

  private handleCloseShare = (): void => this.setState({isShareBobShown: false})

  public render(): React.ReactNode {
    const {adviceId, children, dispatch, location: {hash, pathname, search}, t, testimonials,
      title} = this.props
    const {isShareBobShown} = this.state
    const url = getAbsoluteUrl(Routes.STATIC_ADVICE_PAGE + `/${adviceId}${TRACK_HASH}`)
    if (hash === TRACK_HASH) {
      const newSearch = `${search}${search ? '&' : '?'}${stringify({
        // eslint-disable-next-line @typescript-eslint/camelcase
        utm_campaign: hash.slice(1),
        // eslint-disable-next-line @typescript-eslint/camelcase
        utm_medium: 'link',
        // eslint-disable-next-line @typescript-eslint/camelcase
        utm_source: 'bob-emploi',
      })}`
      return <Redirect to={`${pathname}${newSearch}`} />
    }
    return <StaticPage
      page={`static-${adviceId}`} isContentScrollable={false} isNavBarTransparent={true}
      style={{overflow: 'hidden'}} isChatButtonShown={true}
      isCookieDisclaimerShown={!!isMobileVersion}>

      {isMobileVersion ? null : <CookieMessageOverlay />}

      <div style={{height: 70, position: 'absolute', width: '100%'}} />
      <TitleSection pageContent={{title: title}} />
      {children}
      <VisibilitySensor onChange={this.handleVisibilityChange} partialVisibility={true}>
        <TestimonialStaticSection visualElement={`static-advice-testimonial-${adviceId}`}>
          {testimonials}
        </TestimonialStaticSection>
      </VisibilitySensor>
      <StaticAdviceNavigation currentAdviceId={adviceId} />
      <ShareModal
        onClose={this.handleCloseShare} isShown={isShareBobShown} dispatch={dispatch}
        title={t('Ce conseil pourrait aider vos amis\u00A0?')}
        url={url} visualElement={`static-advice-modal-${adviceId}`}
        intro={<strong>{t('Envoyez-leur directement ce lien\u00A0!')}</strong>} />
    </StaticPage>
  }
}
const StaticAdvicePage = connect(({app: {hasSeenShareModal}}: RootState):
AdviceCardConnectedProps => ({hasSeenShareModal}))(StaticAdvicePageBase)


const adviceDetailContainerStyle = {
  alignItems: 'center',
  display: 'flex',
  marginBottom: 20,
  marginRight: 50,
}
const adviceDetailIconStyle = {
  backgroundColor: colors.GREENISH_TEAL,
  fill: '#fff',
  flexShrink: 0,
  fontSize: 16,
  height: 21,
  marginRight: 20,
  width: 21,
}


const AdviceDetailBase = (props: {children?: React.ReactNode}): React.ReactElement => {
  return <div style={adviceDetailContainerStyle}>
    <CheckIcon style={adviceDetailIconStyle} />
    <span>{props.children}</span>
  </div>
}
AdviceDetailBase.propTypes = {
  children: PropTypes.node,
}
const AdviceDetail = React.memo(AdviceDetailBase)


interface AdviceSectionProps {
  adviceId?: string
  children?: React.ReactNode
  image?: string
  title: string
}


const adviceSectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: '#000',
  fontSize: 16,
  minHeight: 365,
  padding: isMobileVersion ? '50px 10px' : `100px ${MIN_CONTENT_PADDING}px`,
  textAlign: 'left',
}
const adviceSectionHeaderStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 18 : 21,
  fontWeight: 'normal',
  lineHeight: 1,
  marginBottom: 50,
  marginTop: 0,
}
const adviceSectionLayoutStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'center',
  paddingBottom: 45,
}
const carouselStyle: React.CSSProperties = {
  flex: 1,
}


const AdviceSectionBase = (props: AdviceSectionProps): React.ReactElement => {
  const {adviceId, children, image, title} = props
  const {t} = useTranslation('staticAdvice')
  return <section style={adviceSectionStyle}>
    <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
      <Trans style={adviceSectionHeaderStyle} parent="h2" t={t}>
        3 points pour <strong>{{title}}</strong>
      </Trans>
      <div style={adviceSectionLayoutStyle}>
        <div style={carouselStyle}>
          {children}
        </div>
        <div style={{flex: 1, position: 'relative'}}>
          <div style={{alignItems: 'center', bottom: 0, display: 'flex', justifyContent: 'center',
            left: 0, position: 'absolute', right: 0, top: 0, zIndex: 1}}>
            <LoginButton
              style={{fontSize: 16, zIndex: 1}}
              isSignUp={true} visualElement={`${adviceId}-screenshot`} type="validation">
              {t('Obtenir mes conseils personnalisés')}
            </LoginButton>
          </div>
          <img
            style={{zIndex: 0, ...Styles.VENDOR_PREFIXED('filter', 'blur(5px)')}}
            src={image || defaultAdviceImage} alt="" />
        </div>
      </div>
      <Trans style={{marginTop: 25, maxWidth: 700}} t={t}>
        Chaque personne est différente, le chemin pour déployer son potentiel l'est aussi.
        <br />
        <br />
        C'est pourquoi <span style={{color: colors.BOB_BLUE}}>
          {{productName: config.productName}} analyse attentivement votre profil
        </span> et vous propose ensuite des solutions personnalisées et adaptées à vos besoins.
      </Trans>
    </div>
  </section>
}
AdviceSectionBase.propTypes = {
  adviceId: PropTypes.string,
  children: PropTypes.node,
  image: PropTypes.string,
  title: PropTypes.string.isRequired,
}
const AdviceSection = React.memo(AdviceSectionBase)


export {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage,
  STATIC_ADVICE_MODULES}
