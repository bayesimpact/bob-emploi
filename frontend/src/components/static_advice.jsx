import CheckIcon from 'mdi-react/CheckIcon'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React from 'react'
import PropTypes from 'prop-types'

import config from 'config'

import {CookieMessageOverlay} from 'components/cookie_message'
import {LoginButton} from 'components/login'
import {StaticPage, TitleWavesSection} from 'components/static'
import {Colors, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions,
  Styles} from 'components/theme'
import {Routes} from 'components/url'

import defaultAdviceImage from 'images/improve-resume.png'

import AssociationHelp from './static_advice/association_help'
import Events from './static_advice/events'
import Interview from './static_advice/interview'
import MotivationLetter from './static_advice/motivation_letter'
import Offers from './static_advice/offers'
import Relocate from './static_advice/relocate'
import Resume from './static_advice/resume'
import SelfConfidence from './static_advice/confidence'
import Skills from './static_advice/skills'


const STATIC_ADVICE_MODULES = [
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


const CAROUSEL_CARD_MIN_WIDTH = 240


class StaticAdviceCardBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    name: PropTypes.string,
    picto: PropTypes.string,
    style: PropTypes.object,
  }

  render() {
    const {children, name, picto, style, ...otherProps} = this.props
    const containerStyle = {
      backgroundColor: '#fff',
      borderRadius: 10,
      boxShadow: '0 15px 40px 0 rgba(0, 0, 0, 0.25)',
      flexDirection: 'column',
      textAlign: 'center',
      width: 280,
      ...style,
    }

    return <div style={containerStyle} {...otherProps}>
      <img style={{height: 80, marginTop: 30, width: 80}} src={picto} alt={name} />
      <div style={{padding: 40}}>{children}</div>
    </div>
  }
}


const numCardsToShow = totalWidth => Math.floor(totalWidth / CAROUSEL_CARD_MIN_WIDTH)


class CardCarousel extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    carouselWidth: 920,
    indexFirstShown: 0,
    isTransitioning: false,
  }

  componentDidMount() {
    this.handleWidthChange()
  }

  adjustIndex = (desiredIndex, numCardsShown) =>
    Math.max(0, Math.min(
      desiredIndex,
      this.props.children.length - (numCardsShown || numCardsToShow(this.state.carouselWidth))
    ))

  getCarouselMover = delta => () => {
    const {indexFirstShown} = this.state
    const firstIndexToShow = this.adjustIndex(indexFirstShown + delta)
    if (indexFirstShown !== firstIndexToShow) {
      this.setState({
        indexFirstShown: firstIndexToShow,
        isTransitioning: true,
      })
    }
  }

  onTransitionEnd = () => this.setState({isTransitioning: false})

  handleWidthChange = () => {
    if (!this.context.isMobileVersion && this.cardsContainerDom) {
      // Remove padding from outer div for inner div width.
      const totalWidth = this.cardsContainerDom.offsetWidth - 80
      this.setState(({indexFirstShown}) => ({
        carouselWidth: totalWidth,
        indexFirstShown: this.adjustIndex(indexFirstShown, numCardsToShow(totalWidth)),
      }))
    }
  }

  render() {
    const {children} = this.props
    if (this.context.isMobileVersion) {
      const cardStyle = {
        marginBottom: 40,
      }
      // TODO(cyrille): Don't show all cards at once on mobile.
      return <div style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        margin: '0 auto 60px',
        maxWidth: 320,
        padding: 30,
      }}>
        {children.map(child => React.cloneElement(child, {
          style: {...child.props.style, ...cardStyle},
        }))}
      </div>
    }

    const {carouselWidth, indexFirstShown, isTransitioning} = this.state
    const numCardsShown = numCardsToShow(carouselWidth)
    // The carousel width will be the size of n cards and (n-1) spaces between:
    //   carouselWidth = spaceBetweenCards * (numCardsShown - 1) + cardWidth * numCardsShown
    // To make it nice we choose an interval that is 1/7 width of a card, so
    //   carouselWidth = spaceBetweenCards * (numCardsShown - 1 + 7 * numCardsShown)
    // So we can deduce:
    const spaceBetweenCards = carouselWidth / (8 * numCardsShown - 1)
    const cardWidth = spaceBetweenCards * 7
    const carouselStyle = {
      alignItems: 'stretch',
      display: 'flex',
      margin: '0 auto 90px',
      // 1000 carousel + 2 * 45 side buttons + 2 * 30 side padding
      // TODO(cyrille): Discuss with John what should happen for chevron on smaller screen
      // TODO(pascal): Harmonize the maxwidth and padding.
      maxWidth: 1150,
      padding: '0 30px',
    }
    const fixedCardsContainerStyle = {
      overflowX: 'hidden',
      padding: '30px 40px 40px',
      position: 'relative',
      zIndex: 0,
    }
    const firstShownCardOffset = (cardWidth + spaceBetweenCards) * indexFirstShown
    const slidingCardsContainerStyle = {
      display: 'flex',
      justifyContent: 'space-between',
      transform: `translateX(${-firstShownCardOffset}px)`,
      width: spaceBetweenCards * (children.length - 1) + cardWidth * children.length,
      ...SmoothTransitions,
    }
    const cardStyle = isVisible => ({
      flexShrink: 0,
      width: cardWidth,
      // Hide box-shadow on hidden cards except during transition.
      ...isTransitioning || isVisible ? {} : {boxShadow: 'none'},
    })
    const chevronContainerStyle = isVisible => ({
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: Colors.BOB_BLUE,
      borderRadius: 25,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
      cursor: isVisible ? 'pointer' : 'auto',
      display: 'flex',
      flexShrink: 0,
      height: 45,
      justifyContent: 'center',
      opacity: isVisible ? 1 : 0,
      width: 45,
      ...SmoothTransitions,
    })
    const disappearingStyle = isLeft => ({
      background: `linear-gradient(to ${isLeft ? 'right' : 'left'}, #fff, transparent)`,
      bottom: 0,
      position: 'absolute',
      [isLeft ? 'left' : 'right']: 0,
      top: 0,
      width: 40,
      zIndex: 1,
    })
    return <div style={carouselStyle}>
      <div
        style={chevronContainerStyle(indexFirstShown)}
        onClick={this.getCarouselMover(-numCardsShown)}>
        <ChevronLeftIcon fill="#fff" />
      </div>
      <div style={fixedCardsContainerStyle} ref={dom => this.cardsContainerDom = dom}>
        <div style={disappearingStyle(true)} />
        <div
          style={slidingCardsContainerStyle}
          onTransitionEnd={this.onTransitionEnd}>
          {children.map((child, index) => React.cloneElement(child, {
            style: {
              ...child.props.style,
              ...cardStyle(index >= indexFirstShown && index < indexFirstShown + numCardsShown),
            },
          }))}
        </div>
        <div style={disappearingStyle(false)} />
      </div>
      <div
        style={chevronContainerStyle(
          indexFirstShown + numCardsShown < children.length
        )}
        onClick={this.getCarouselMover(numCardsShown)}>
        <ChevronRightIcon fill="#fff" />
      </div>
    </div>
  }

}


class StaticAdviceNavigation extends React.Component {
  static propTypes = {
    currentAdviceId: PropTypes.string,
  }

  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const adviceCardsToShow = STATIC_ADVICE_MODULES.filter(({adviceId, StaticAdviceCard}) =>
      adviceId !== this.props.currentAdviceId && StaticAdviceCard)
    if (!adviceCardsToShow.length) {
      return null
    }
    const {history, isMobileVersion} = this.context
    const sectionStyle = {
      backgroundColor: '#fff',
      padding: '20px 0',
      position: 'relative',
    }
    const headerStyle = {
      fontFamily: 'Lato, Helvetica',
      fontSize: isMobileVersion ? 28 : 33,
      fontWeight: 'normal',
      margin: 'auto',
      maxWidth: 750,
      padding: '80px 10px',
      textAlign: 'center',
    }
    return <section style={sectionStyle}>
      <h2 style={headerStyle}>
        {config.productName} peut aussi augmenter l'efficacité de
        votre <strong>recherche d'emploi</strong> grâce à&nbsp;:
      </h2>
      <CardCarousel>
        {/* TODO(pascal): Replace history.push with <react-redux-router.Link> */}
        {adviceCardsToShow.map(({StaticAdviceCard, adviceId}) =>
          <StaticAdviceCard
            onClick={() => history.push(Routes.STATIC_ADVICE_PAGE(adviceId))}
            key={`advice-${adviceId}`} style={{cursor: 'pointer'}} />)}
      </CardCarousel>
    </section>
  }
}


class StaticAdvicePage extends React.Component {
  static propTypes = {
    adviceId: PropTypes.string.isRequired,
    children: PropTypes.node,
    title: PropTypes.string.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  renderCookieBanner() {
  }

  render() {
    const {adviceId, children, title} = this.props
    const {isMobileVersion} = this.context
    return <StaticPage
      page={`static-${adviceId}`} isContentScrollable={false} isNavBarTransparent={true}
      style={{overflow: 'hidden'}} isChatButtonShown={true}
      isCookieDisclaimerShown={!!isMobileVersion}>

      {isMobileVersion ? null : <CookieMessageOverlay />}

      <div style={{height: 70, position: 'absolute', width: '100%'}} />
      <TitleWavesSection
        isNarrow={true}
        pageContent={{title: title}} />
      {children}
      <StaticAdviceNavigation currentAdviceId={adviceId} />
    </StaticPage>
  }
}


class AdviceDetail extends React.Component {
  static propTypes = {
    children: PropTypes.node,
  }

  render() {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      marginBottom: 20,
      marginRight: 50,
    }
    const iconStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
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


class AdviceSection extends React.Component {
  static propTypes = {
    adviceId: PropTypes.string,
    children: PropTypes.node,
    image: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {adviceId, children, image, title} = this.props
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: '#fff',
      color: '#000',
      fontFamily: 'Lato, Helvetica',
      fontSize: 16,
      minHeight: 365,
      padding: isMobileVersion ? '50px 10px' : `100px ${MIN_CONTENT_PADDING}px`,
      textAlign: 'left',
    }
    const headerStyle = {
      fontSize: isMobileVersion ? 18 : 21,
      fontWeight: 'normal',
      lineHeight: 1,
      marginBottom: 50,
      marginTop: 0,
    }
    const layoutStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'center',
      paddingBottom: 45,
    }
    const carouselStyle = {
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
          C'est pourquoi <span style={{color: Colors.BOB_BLUE}}>
            {config.productName} analyse attentivement votre profil
          </span> et vous propose ensuite des solutions personnalisées et adaptées à vos besoins.
        </div>
      </div>
    </section>
  }
}


export {AdviceDetail, AdviceSection, StaticAdviceCardBase, STATIC_ADVICE_MODULES, StaticAdvicePage}
