import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useRef, useState} from 'react'

import {isMobileVersion} from 'components/mobile'
import {CarouselArrow, SmoothTransitions} from 'components/theme'


const ARROW_WIDTH = 45
const ARROW_PADDING = 40
const CONTAINER_PADDING = 30

const numCardsToShow = (totalWidth: number, isLarge?: boolean): number => {
  const cardMinWidth = isLarge ? 300 : 240
  const cardPlusMarginWidth = cardMinWidth * 8 / 7
  return Math.floor((totalWidth - cardMinWidth) / cardPlusMarginWidth) + 1
}


interface CarouselProps {
  backGroundColor?: string
  children: readonly ReactStylableElement[]
  isLarge?: boolean
  maxWidth?: number
}

const CardCarouselBase: React.FC<CarouselProps> = (props: CarouselProps): React.ReactElement => {
  const {backGroundColor, children, isLarge, maxWidth} = props
  const [carouselWidth, setCarouselWidth] = useState(320)
  const [containerWidth, setContainerWidth] = useState(0)
  const [indexFirstShown, setIndexFirstShown] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const container = containerRef.current
  const hasContainer = !!container
  useEffect(() => {
    if (!hasContainer || isMobileVersion) {
      return
    }
    // The check above makes sure container is not null but Typescript does not see it.
    const availableWidth = (container as HTMLDivElement).offsetWidth
    const arrowsRequiredWidth = 2 * (ARROW_WIDTH + CONTAINER_PADDING + ARROW_PADDING)
    const newContainerWidth = maxWidth ?
      Math.min(availableWidth, maxWidth + arrowsRequiredWidth) : availableWidth
    const newCarouselWidth = newContainerWidth - arrowsRequiredWidth
    setCarouselWidth(newCarouselWidth)
    setContainerWidth(newContainerWidth)
    // TODO(cyrille): Consider doing it again at some point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContainer, maxWidth])
  useEffect(() => {
    const adjustedIndex = Math.max(0, Math.min(indexFirstShown,
      children.length - numCardsToShow(carouselWidth, isLarge)))
    if (adjustedIndex !== indexFirstShown) {
      setIndexFirstShown(adjustedIndex)
      setIsTransitioning(true)
    }
  }, [carouselWidth, children.length, indexFirstShown, isLarge])
  const getCarouselMover = useCallback((delta): (() => void) => (): void =>
    setIndexFirstShown(indexFirstShown + delta), [indexFirstShown, setIndexFirstShown])
  const onTransitionEnd = useCallback((): void => setIsTransitioning(false), [setIsTransitioning])
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

  const numCardsShown = numCardsToShow(carouselWidth, isLarge)
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
  const cardStyle = (isVisible: boolean): React.CSSProperties => ({
    flexShrink: 0,
    width: cardWidth,
    // Hide box-shadow on hidden cards except during transition.
    ...isTransitioning || isVisible ? {} : {boxShadow: 'none'},
  })
  const disappearingStyle = (isLeft: boolean): React.CSSProperties => ({
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
  return <div style={carouselStyle} ref={containerRef}>
    <CarouselArrow
      isVisible={!!indexFirstShown} isLeft={true}
      handleClick={getCarouselMover(-numCardsShown)}
      style={arrowStyle} />
    <div style={fixedCardsContainerStyle}>
      <div style={disappearingStyle(true)} />
      <div
        style={slidingCardsContainerStyle}
        onTransitionEnd={onTransitionEnd}>
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
      handleClick={getCarouselMover(numCardsShown)} style={arrowStyle} />
  </div>
}
CardCarouselBase.propTypes = {
  backGroundColor: PropTypes.string,
  children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
  isLarge: PropTypes.bool,
  // The maximum preferred width of the carousel. Note that if there's enough
  // room, this component will also use extra width to show the arrows
  // outside this width.
  maxWidth: PropTypes.number,
}
const CardCarousel = React.memo(CardCarouselBase)


export {CardCarousel}
