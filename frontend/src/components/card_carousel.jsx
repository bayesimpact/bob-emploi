import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {SmoothTransitions} from 'components/theme'


const ARROW_WIDTH = 45
const ARROW_PADDING = 40
const CONTAINER_PADDING = 30


class CardCarousel extends React.Component {
  static propTypes = {
    backGroundColor: PropTypes.string,
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
    isLarge: PropTypes.bool,
    // The maximum preferred width of the carousel. Note that if there's enough
    // room, this component will also use extra width to show the arrows
    // outside this width.
    maxWidth: PropTypes.number,
  }

  state = {
    carouselWidth: 320,
    containerWidth: 0,
    indexFirstShown: 0,
    isTransitioning: false,
  }

  componentDidMount() {
    this.handleWidthChange()
  }

  containerRef = React.createRef()

  adjustIndex = (desiredIndex, numCardsShown) =>
    Math.max(0, Math.min(
      desiredIndex,
      this.props.children.length - (numCardsShown || this.numCardsToShow(this.state.carouselWidth))
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
    if (!this.containerRef.current || isMobileVersion) {
      return
    }
    const availableWidth = this.containerRef.current.offsetWidth
    const arrowsRequiredWidth = 2 * (ARROW_WIDTH + CONTAINER_PADDING + ARROW_PADDING)
    const containerWidth = this.props.maxWidth ?
      Math.min(availableWidth, this.props.maxWidth + arrowsRequiredWidth) : availableWidth
    const carouselWidth = containerWidth - arrowsRequiredWidth
    this.setState(({indexFirstShown}) => ({
      carouselWidth,
      containerWidth,
      indexFirstShown: this.adjustIndex(indexFirstShown, this.numCardsToShow(carouselWidth)),
    }))
  }

  numCardsToShow = totalWidth => {
    const cardMinWidth = this.props.isLarge ? 300 : 240
    const cardPlusMarginWidth = cardMinWidth * 8 / 7
    return Math.floor((totalWidth - cardMinWidth) / cardPlusMarginWidth) + 1
  }

  render() {
    const {backGroundColor, children, isLarge} = this.props
    if (isMobileVersion) {
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

    const {carouselWidth, containerWidth, indexFirstShown, isTransitioning} = this.state
    const numCardsShown = this.numCardsToShow(carouselWidth)
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
      margin: `0 auto ${isLarge ? '' : '90px'}`,
      maxWidth: containerWidth || 'initial',
      padding: `0 ${CONTAINER_PADDING}px`,
    }
    const fixedCardsContainerStyle = {
      overflowX: 'hidden',
      padding: `30px ${ARROW_PADDING}px 40px`,
      position: 'relative',
      width: containerWidth ? 'initial' : carouselWidth,
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
      backgroundColor: colors.BOB_BLUE,
      borderRadius: 25,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
      cursor: isVisible ? 'pointer' : 'auto',
      display: 'flex',
      flexShrink: 0,
      height: ARROW_WIDTH,
      justifyContent: 'center',
      opacity: isVisible ? 1 : 0,
      width: ARROW_WIDTH,
      ...SmoothTransitions,
    })
    const disappearingStyle = isLeft => ({
      background: `linear-gradient(
        to ${isLeft ? 'right' : 'left'}, ${backGroundColor || '#fff'}, transparent)`,
      bottom: 0,
      position: 'absolute',
      [isLeft ? 'left' : 'right']: 0,
      top: 0,
      width: 40,
      zIndex: 1,
    })
    return <div style={carouselStyle} ref={this.containerRef}>
      <div
        style={chevronContainerStyle(indexFirstShown)}
        onClick={this.getCarouselMover(-numCardsShown)}>
        <ChevronLeftIcon style={{fill: '#fff'}} />
      </div>
      <div style={fixedCardsContainerStyle}>
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
        <ChevronRightIcon style={{fill: '#fff'}} />
      </div>
    </div>
  }
}


export {CardCarousel}
