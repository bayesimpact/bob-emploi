import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {CarouselArrow, SmoothTransitions} from 'components/theme'


const ARROW_WIDTH = 45
const ARROW_PADDING = 40
const CONTAINER_PADDING = 30


interface CarouselProps {
  backGroundColor?: string
  children: ReactStylableElement[]
  isLarge?: boolean
  maxWidth?: number
}


interface CarouselState {
  carouselWidth?: number
  containerWidth?: number
  indexFirstShown?: number
  isTransitioning?: boolean
}


class CardCarousel extends React.PureComponent<CarouselProps, CarouselState> {
  public static propTypes = {
    backGroundColor: PropTypes.string,
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
    isLarge: PropTypes.bool,
    // The maximum preferred width of the carousel. Note that if there's enough
    // room, this component will also use extra width to show the arrows
    // outside this width.
    maxWidth: PropTypes.number,
  }

  public state: CarouselState = {
    carouselWidth: 320,
    containerWidth: 0,
    indexFirstShown: 0,
    isTransitioning: false,
  }

  public componentDidMount(): void {
    this.handleWidthChange()
  }

  private containerRef: React.RefObject<HTMLDivElement> = React.createRef()

  private adjustIndex = (desiredIndex, numCardsShown?): number =>
    Math.max(0, Math.min(
      desiredIndex,
      this.props.children.length - (numCardsShown || this.numCardsToShow(this.state.carouselWidth))
    ))

  private getCarouselMover = _memoize((delta): (() => void) => (): void => {
    const {indexFirstShown} = this.state
    const firstIndexToShow = this.adjustIndex(indexFirstShown + delta)
    if (indexFirstShown !== firstIndexToShow) {
      this.setState({
        indexFirstShown: firstIndexToShow,
        isTransitioning: true,
      })
    }
  })

  private onTransitionEnd = (): void => this.setState({isTransitioning: false})

  private handleWidthChange = (): void => {
    if (!this.containerRef.current || isMobileVersion) {
      return
    }
    const availableWidth = this.containerRef.current.offsetWidth
    const arrowsRequiredWidth = 2 * (ARROW_WIDTH + CONTAINER_PADDING + ARROW_PADDING)
    const containerWidth = this.props.maxWidth ?
      Math.min(availableWidth, this.props.maxWidth + arrowsRequiredWidth) : availableWidth
    const carouselWidth = containerWidth - arrowsRequiredWidth
    this.setState(({indexFirstShown}): CarouselState => ({
      carouselWidth,
      containerWidth,
      indexFirstShown: this.adjustIndex(indexFirstShown, this.numCardsToShow(carouselWidth)),
    }))
  }

  private numCardsToShow = (totalWidth: number): number => {
    const cardMinWidth = this.props.isLarge ? 300 : 240
    const cardPlusMarginWidth = cardMinWidth * 8 / 7
    return Math.floor((totalWidth - cardMinWidth) / cardPlusMarginWidth) + 1
  }

  public render(): React.ReactNode {
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
        {children.map((child): React.ReactNode => React.cloneElement(child, {
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
    const carouselStyle: React.CSSProperties = {
      alignItems: 'stretch',
      display: 'flex',
      margin: `0 auto ${isLarge ? '' : '90px'}`,
      maxWidth: containerWidth || 'initial',
      padding: `0 ${CONTAINER_PADDING}px`,
    }
    const fixedCardsContainerStyle: React.CSSProperties = {
      overflowX: 'hidden',
      padding: `30px ${ARROW_PADDING}px 40px`,
      position: 'relative',
      width: containerWidth ? 'initial' : carouselWidth,
      zIndex: 0,
    }
    const firstShownCardOffset = (cardWidth + spaceBetweenCards) * indexFirstShown
    const slidingCardsContainerStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      transform: `translateX(${-firstShownCardOffset}px)`,
      width: spaceBetweenCards * (children.length - 1) + cardWidth * children.length,
      ...SmoothTransitions,
    }
    const cardStyle = (isVisible): React.CSSProperties => ({
      flexShrink: 0,
      width: cardWidth,
      // Hide box-shadow on hidden cards except during transition.
      ...isTransitioning || isVisible ? {} : {boxShadow: 'none'},
    })
    const disappearingStyle = (isLeft): React.CSSProperties => ({
      background: `linear-gradient(
        to ${isLeft ? 'right' : 'left'}, ${backGroundColor || '#fff'}, transparent)`,
      bottom: 0,
      position: 'absolute',
      [isLeft ? 'left' : 'right']: 0,
      top: 0,
      width: 40,
      zIndex: 1,
    })
    const arrowStyle = {
      alignSelf: 'center',
      flexShrink: 0,
      height: ARROW_WIDTH,
      width: ARROW_WIDTH,
    }
    return <div style={carouselStyle} ref={this.containerRef}>
      <CarouselArrow
        isVisible={!!indexFirstShown} isLeft={true}
        handleClick={this.getCarouselMover(-numCardsShown)}
        style={arrowStyle} />
      <div style={fixedCardsContainerStyle}>
        <div style={disappearingStyle(true)} />
        <div
          style={slidingCardsContainerStyle}
          onTransitionEnd={this.onTransitionEnd}>
          {children.map((child, index): React.ReactNode => React.cloneElement(child, {
            style: {
              ...child.props.style,
              ...cardStyle(index >= indexFirstShown && index < indexFirstShown + numCardsShown),
            },
          }))}
        </div>
        <div style={disappearingStyle(false)} />
      </div>
      <CarouselArrow
        isVisible={indexFirstShown + numCardsShown < children.length}
        handleClick={this.getCarouselMover(numCardsShown)} style={arrowStyle} />
    </div>
  }
}


export {CardCarousel}
