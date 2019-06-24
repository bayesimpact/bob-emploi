import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import {stringify} from 'query-string'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, staticAdvicePageIsShown} from 'store/actions'

import {CardCarousel} from 'components/card_carousel'
import {CookieMessageOverlay} from 'components/cookie_message'
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
  StaticAdviceCard: React.ComponentClass<CardProps>
  Page: React.ComponentClass<AdvicePageProps>
}


const STATIC_ADVICE_MODULES: AdviceModule[] = [
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
}


interface AdviceCardProps extends CardProps {
  children: React.ReactNode
  name: string
  picto: string
}


class StaticAdviceCardBase extends React.PureComponent<AdviceCardProps> {
  public static propTypes = {
    children: PropTypes.node,
    name: PropTypes.string,
    picto: PropTypes.string,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, name, picto, style, ...otherProps} = this.props
    const containerStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      color: '#000',
      flexDirection: 'column',
      textAlign: 'center',
      ...style,
    }

    return <div style={containerStyle} {...otherProps}>
      <img style={{height: 80, marginTop: 30, width: 80}} src={picto} alt={name} />
      <div style={{padding: 40}}>{children}</div>
    </div>
  }
}

class StaticAdviceNavigation extends React.PureComponent<{currentAdviceId?: string}> {
  public static propTypes = {
    currentAdviceId: PropTypes.string,
  }

  public render(): React.ReactNode {
    const adviceCardsToShow = STATIC_ADVICE_MODULES.filter(
      ({adviceId, StaticAdviceCard}): boolean =>
        adviceId !== this.props.currentAdviceId && !!StaticAdviceCard)
    if (!adviceCardsToShow.length) {
      return null
    }
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
    return <section style={sectionStyle}>
      <h2 style={headerStyle}>
        {config.productName} peut aussi augmenter l'efficacité de
        votre <strong>recherche d'emploi</strong> grâce à&nbsp;:
      </h2>
      <CardCarousel maxWidth={MAX_CONTENT_WIDTH}>
        {adviceCardsToShow.map(({StaticAdviceCard, adviceId}): Link =>
          <Link
            style={linkStyle} key={`advice-${adviceId}`}
            to={Routes.STATIC_ADVICE_PAGE + `/${adviceId}`}>
            <StaticAdviceCard style={{height: '100%'}} />
          </Link>)}
      </CardCarousel>
    </section>
  }
}


export interface AdvicePageProps extends RouteComponentProps<{}> {
  hasSeenShareModal?: boolean
}


interface StaticAdvicePageProps extends AdvicePageProps {
  adviceId: string
  children?: React.ReactNode
  dispatch: DispatchAllActions
  testimonials: React.ReactElement<{author: {name: string}}>[]
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

  private shareTimeout: ReturnType<typeof setTimeout>

  private handleVisibilityChange = (isVisible: boolean): void => {
    if (!this.props.hasSeenShareModal && isVisible) {
      clearTimeout(this.shareTimeout)
      this.shareTimeout = setTimeout((): void => {
        this.setState({isShareBobShown: true})
      }, 5000)
    }
  }

  private handleCloseShare = (): void => this.setState({isShareBobShown: false})

  public render(): React.ReactNode {
    const {adviceId, children, dispatch, location: {hash, pathname, search}, testimonials,
      title} = this.props
    const {isShareBobShown} = this.state
    const url = getAbsoluteUrl(Routes.STATIC_ADVICE_PAGE + `/${adviceId}${TRACK_HASH}`)
    if (hash === TRACK_HASH) {
      const newSearch = `${search}${search ? '&' : '?'}${stringify({
        'utm_campaign': hash.substr(1),
        'utm_medium': 'link',
        'utm_source': 'bob-emploi',
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
        title="Ce conseil pourrait aider vos amis&nbsp;?"
        url={url} visualElement={`static-advice-modal-${adviceId}`}
        intro={<React.Fragment>
          <strong>Envoyez-leur directement ce lien&nbsp;!</strong>
        </React.Fragment>} />
    </StaticPage>
  }
}
const StaticAdvicePage = connect()(StaticAdvicePageBase)


class AdviceDetail extends React.PureComponent<{children?: React.ReactNode}> {
  public static propTypes = {
    children: PropTypes.node,
  }

  public render(): React.ReactNode {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      marginBottom: 20,
      marginRight: 50,
    }
    const iconStyle = {
      backgroundColor: colors.GREENISH_TEAL,
      fill: '#fff',
      flexShrink: 0,
      fontSize: 16,
      height: 21,
      marginRight: 20,
      width: 21,
    }
    return <div style={containerStyle}>
      <CheckIcon style={iconStyle} />
      <span>{this.props.children}</span>
    </div>
  }
}


interface AdviceSectionProps {
  adviceId?: string
  children?: React.ReactNode
  image?: string
  title: string
}


class AdviceSection extends React.PureComponent<AdviceSectionProps> {
  public static propTypes = {
    adviceId: PropTypes.string,
    children: PropTypes.node,
    image: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {adviceId, children, image, title} = this.props
    const style: React.CSSProperties = {
      backgroundColor: '#fff',
      color: '#000',
      fontSize: 16,
      minHeight: 365,
      padding: isMobileVersion ? '50px 10px' : `100px ${MIN_CONTENT_PADDING}px`,
      textAlign: 'left',
    }
    const headerStyle: React.CSSProperties = {
      fontSize: isMobileVersion ? 18 : 21,
      fontWeight: 'normal',
      lineHeight: 1,
      marginBottom: 50,
      marginTop: 0,
    }
    const layoutStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'center',
      paddingBottom: 45,
    }
    const carouselStyle: React.CSSProperties = {
      flex: 1,
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
        <h2 style={headerStyle}>
          3 points pour <strong>{title}</strong>
        </h2>
        <div style={layoutStyle}>
          <div style={carouselStyle}>
            {children}
          </div>
          <div style={{flex: 1, position: 'relative'}}>
            <div style={{alignItems: 'center', bottom: 0, display: 'flex', justifyContent: 'center',
              left: 0, position: 'absolute', right: 0, top: 0, zIndex: 1}}>
              <LoginButton
                style={{fontSize: 16, zIndex: 1}}
                isSignUpButton={true} visualElement={`${adviceId}-screenshot`} type="validation">
                Obtenir mes conseils personnalisés
              </LoginButton>
            </div>
            <img
              style={{zIndex: 0, ...Styles.VENDOR_PREFIXED('filter', 'blur(5px)')}}
              src={image || defaultAdviceImage} alt="" />
          </div>
        </div>
        <div style={{marginTop: 25, maxWidth: 700}}>
          Chaque personne est différente, le chemin pour déployer son potentiel l'est aussi.
          <br />
          <br />
          C'est pourquoi <span style={{color: colors.BOB_BLUE}}>
            {config.productName} analyse attentivement votre profil
          </span> et vous propose ensuite des solutions personnalisées et adaptées à vos besoins.
        </div>
      </div>
    </section>
  }
}

export {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage,
  STATIC_ADVICE_MODULES}
