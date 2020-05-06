import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {isMobileVersion} from 'components/mobile'
import {Img, SmoothTransitions} from 'components/theme'
import manImage from 'images/man-icon.svg'
import womanImage from 'images/woman-icon.svg'


const useTimeout =
(callback: () => void, periodMs: number, ...cacheBusters: readonly unknown[]): void => {
  useEffect((): (() => void) => {
    const timeout = window.setTimeout(callback, periodMs)
    return (): void => {
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, periodMs, ...cacheBusters])
}


interface RotateVars {
  gotoIndex: (index: number) => void
  index: number
  isNew: boolean
  previous: number
}


// Hook to rotate through items regularly. It returns the current index, the previous one and a
// callback to manually set the index. It trigger a re-render (by state change) each time the index
// is modified, and then immediately after (to update the isNew state).
// @param numItems: number of items to cycle through. The results will always be between 0 and
// numItems - 1.
// @param periodMs: number of milliseconds to wait before each new value. If the value is set
// manually, the timer is reset and we'll wait for another periodMs milliseconds before going to
// the next one.
// @return the current index, the previous index, a flag whether we've just changed index, a
// callback to manually set the index.
function useRotate(numItems: number, periodMs: number): RotateVars {
  const [state, setState] = useState({index: 0, isNew: true, previous: 0})
  const {index, isNew, previous} = state
  const [numManualTimeReset, setNumManualTimeReset] = useState(0)

  const gotoIndex = useCallback((newIndex: number, isAuto?: boolean): void => {
    if (!isAuto) {
      setNumManualTimeReset((value: number): number => value + 1)
    }
    if (newIndex % numItems === index % numItems) {
      return
    }
    setState({
      index: newIndex % numItems,
      isNew: true,
      previous: index % numItems,
    })
  }, [index, numItems])

  const setNextIndex = useCallback((): void => {
    gotoIndex(index + 1, true)
  }, [index, gotoIndex])

  useEffect((): void => {
    if (state.isNew) {
      setState({...state, isNew: false})
    }
  }, [state])

  useTimeout(setNextIndex, periodMs, numManualTimeReset)

  return {gotoIndex, index: index % numItems, isNew, previous: previous % numItems}
}


interface BulletProps {
  index: number
  isSelected: boolean
  onClick: (index: number) => void
}

const bulletStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, .6)',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-block',
  height: 6,
  margin: 4,
  width: 6,
}

const selectedBulletStyle: React.CSSProperties = {
  ...bulletStyle,
  backgroundColor: '#fff',
}


const BulletBase = (props: BulletProps): React.ReactElement => {
  const {index, isSelected, onClick} = props
  const handleClick = useCallback((): void => onClick(index), [index, onClick])
  return <li onClick={handleClick} style={isSelected ? selectedBulletStyle : bulletStyle} />
}
const Bullet = React.memo(BulletBase)


interface TestimonialsProps {
  cardStyle?: React.CSSProperties
  carouselAutoRotationDurationMs?: number
  children: ReactStylableElement[]
}


const TestimonialsBase = (props: TestimonialsProps): React.ReactElement => {
  const {cardStyle, carouselAutoRotationDurationMs = 5000, children} = props

  const {
    gotoIndex: setIndex,
    index: shownTestimonialIndex,
    isNew: isNewIndex,
    previous: previousTestimonialIndex,
  } = useRotate(children.length, carouselAutoRotationDurationMs)

  const isTransitionBlocked = isNewIndex

  const styledTestimonials = useMemo((): readonly ReactStylableElement[] => {
    const style = {
      margin: 'auto',
      ...cardStyle,
    }
    return children.map(child => React.cloneElement(child, {style}))
  }, [cardStyle, children])

  const shownTestimonial = styledTestimonials[shownTestimonialIndex]
  const previousTestimonial = styledTestimonials[previousTestimonialIndex]

  const style: React.CSSProperties = {
    height: 200,
    margin: 'auto',
    overflow: 'hidden',
    padding: isMobileVersion ? '45px 30px 10px' : '30px 100px 10px',
    position: 'relative',
  }
  const containerStyle: React.CSSProperties = {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    ...SmoothTransitions,
  }
  const leavingStyle: React.CSSProperties = {
    opacity: isTransitionBlocked ? 1 : 0,
    transform: `translateX(${isTransitionBlocked ? '0' : '-500px'})`,
    ...containerStyle,
  }
  const arrivingStyle: React.CSSProperties = {
    opacity: isTransitionBlocked ? 0 : 1,
    transform: `translateX(${isTransitionBlocked ? '500px' : '0'})`,
    ...containerStyle,
  }
  const bulletsContainerStyle: React.CSSProperties = {
    marginBottom: 0,
    padding: 0,
    textAlign: 'center',
  }
  return <div>
    <div style={style}>
      {previousTestimonialIndex === shownTestimonialIndex ? null : <div
        style={leavingStyle} key={previousTestimonialIndex}>
        {previousTestimonial}
      </div>}
      <div style={arrivingStyle} key={shownTestimonialIndex}>
        {shownTestimonial}
      </div>
    </div>
    <ol style={bulletsContainerStyle}>
      {children.map((card, i): React.ReactNode => <Bullet
        key={'bullet-' + i} onClick={setIndex} index={i}
        isSelected={i === shownTestimonialIndex} />)}
    </ol>
  </div>
}
TestimonialsBase.propTypes = {
  cardStyle: PropTypes.object,
  carouselAutoRotationDurationMs: PropTypes.number,
  children: PropTypes.arrayOf(PropTypes.node.isRequired).isRequired,
}
const Testimonials = React.memo(TestimonialsBase)


interface CardProps {
  author: {
    age?: number
    imageLink?: string
    isMan?: boolean
    jobName?: string
    name: string
  }
  children: React.ReactNode
  isLong?: boolean
  style?: React.CSSProperties
}


const TestimonialCardBase: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {author, children, isLong, style} = props
  const {t} = useTranslation()
  const horizontalPadding = isMobileVersion && !isLong ? 30 : 75
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: '#fff',
    borderRadius: 5,
    boxShadow: '0 25px 40px 0 rgba(0, 0, 0, 0.15)',
    color: isLong ? colors.DARK : colors.DARK_TWO,
    fontSize: isLong ? 16 : 18,
    lineHeight: 1.44,
    margin: isLong ? '10px 10px' : 'initial',
    maxWidth: isLong ? 320 : 600,
    minHeight: isLong ? 'initial' : 150,
    padding: isMobileVersion || isLong ? '30px 30px' : `40px ${horizontalPadding}px`,
    position: isLong ? 'initial' : 'relative',
    ...style,
  }), [horizontalPadding, isLong, style])
  const authorStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: isLong ? colors.VERY_LIGHT_BLUE : 'initial',
    borderTopLeftRadius: isLong ? 5 : 'initial',
    borderTopRightRadius: isLong ? 5 : 'initial',
    color: isLong ? 'inherit' : '#fff',
    display: 'flex',
    fontSize: 14,
    fontStyle: isLong ? 'initial' : 'italic',
    justifyContent: isLong ? 'initial' : 'center',
    left: 0,
    margin: isLong ? '-30px -30px 20px -30px' : '15px 0 0',
    minHeight: isLong ? 85 : 'initial',
    padding: isLong ? author.imageLink ? '10px 30px' : '0 30px' : `0 ${horizontalPadding}px`,
    position: isLong ? 'initial' : 'absolute',
    right: 0,
    top: isLong ? 'initial' : '100%',
  }), [author.imageLink, horizontalPadding, isLong])
  const authorPicto = <Img
    style={{height: 'auto', marginRight: 15, maxHeight: 100, maxWidth: 100, width: 'auto'}}
    src={author.imageLink ? author.imageLink : author.isMan ? manImage : womanImage}
    fallbackSrc={author.isMan ? manImage : womanImage}
    // We don't always have the isMan flag, so we cannot say for sure when it's a woman.
    alt={author.name || author.isMan ? 'homme' : ''} />

  const authorName = author.age || author.jobName ? `${author.name},` : author.name
  const authorAge = author.age ? t(' {{age}} ans', {age: author.age}) : ''
  const authorJobName = author.jobName ? `${author.jobName}` : ''

  return <div style={containerStyle}>
    {isLong ?
      <div style={authorStyle}>
        {authorPicto} {authorName}{authorAge}<br />{authorJobName}
      </div> : null}
    {children}
    {isLong ? null : <div style={authorStyle}> {authorName}{authorAge} {authorJobName}</div>}
  </div>
}
TestimonialCardBase.propTypes = {
  author: PropTypes.shape({
    age: PropTypes.number,
    imageLink: PropTypes.string,
    isMan: PropTypes.bool,
    jobName: PropTypes.string,
    name: PropTypes.string.isRequired,
  }).isRequired,
  children: PropTypes.node,
  isLong: PropTypes.bool,
  style: PropTypes.object,
}
const TestimonialCard = React.memo(TestimonialCardBase)


export {TestimonialCard, Testimonials}
