import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import ModalCloseButton from 'components/modal_close_button'

import starIcon from 'images/star.svg'
import blackStarIcon from 'images/star-black.svg'
import blackStarOutlineIcon from 'images/star-black-outline.svg'
import whiteStarIcon from 'images/star-white.svg'
import starOutlineIcon from 'images/star-outline.svg'
import whiteStarOutlineIcon from 'images/star-outline.svg?stroke=%23fff'
import isMobileVersion from 'store/mobile'


type NumStars = 1|2|3|4|5
export const totalNumStars = 5
export type NumStarsString = '1'|'2'|'3'|'4'|'5'
const starsValues = Array.from({length: totalNumStars}, (unused, index) => (index + 1) as NumStars)


interface StarProps extends
  Omit<React.ComponentPropsWithoutRef<'img'>, 'onClick'|'onMouseEnter'|'onMouseLeave'> {
  alt: string
  numStars: NumStars
  onClick: (numStars: NumStars) => void
  onMouseEnter: (numStars: NumStars) => void
  onMouseLeave?: (numStars: NumStars) => void
}


const starButtonStyle: React.CSSProperties = {
  padding: 5,
}


const FeedbackStarBase = (props: StarProps): React.ReactElement => {
  const {
    'aria-describedby': ariaDescribedby,
    'aria-pressed': ariaPressed,
    alt, numStars, onClick, onMouseEnter, onMouseLeave,
    ...imgProps
  } = props
  const enter = useCallback(() => onMouseEnter(numStars), [numStars, onMouseEnter])
  const leave = useCallback(() => onMouseLeave?.(numStars), [numStars, onMouseLeave])
  const click = useCallback(() => onClick(numStars), [numStars, onClick])
  return <button
    onMouseEnter={isMobileVersion ? undefined : enter}
    onMouseLeave={isMobileVersion ? undefined : leave}
    onFocus={enter} onBlur={leave}
    onClick={click} type="button"
    style={starButtonStyle}
    aria-describedby={ariaDescribedby}
    aria-pressed={ariaPressed}>
    <img alt={alt} {...imgProps} />
  </button>
}
const FeedbackStar = React.memo(FeedbackStarBase)


const noWrapStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
}

interface StarsProps {
  'aria-describedby'?: string
  isDark?: boolean
  isInline?: boolean
  isTabbable?: boolean
  isWhite?: true
  onClose?: () => void
  onStarClick: (star: number) => void
  score: number
  size?: number
  style?: React.CSSProperties
  title: false | string
}

const closeButtonStyle: RadiumCSSProperties = {
  ':focus': {
    opacity: .9,
  },
  ':hover': {
    opacity: .9,
  },
  'boxShadow': 'initial',
  'opacity': .6,
  'right': 10,
  'top': 10,
  'transform': 'initial',
}

const FeedbackStars = (props: StarsProps): React.ReactElement => {
  const {
    'aria-describedby': ariaDescribedby,
    isDark,
    isInline,
    isTabbable,
    isWhite,
    onClose,
    onStarClick,
    score,
    size = 20,
    style,
    title,
  } = props
  const {t} = useTranslation('components')
  const [hoveredStars, setHoveredStars] = useState<0|NumStars>(0)
  const highlightedStars = hoveredStars || score || 0

  const resetHoveredStars = useCallback((): void => setHoveredStars(0), [])

  const starStyle = useMemo((): React.CSSProperties => ({
    height: size + 10,
  }), [size])

  const starsTitleStyle: React.CSSProperties = {
    color: colors.MODAL_SUBTITLE,
    fontWeight: 500,
    marginBottom: isInline ? 0 : 5,
    marginRight: isInline ? 10 : 0,
    marginTop: 0,
  }

  const fullStar = isWhite ? isDark || config.isDark ? whiteStarIcon : blackStarIcon : starIcon
  const emptyStar = isWhite ? isDark || config.isDark ? whiteStarOutlineIcon :
    blackStarOutlineIcon : starOutlineIcon
  const titleId = useMemo(_uniqueId, [])
  return <div style={{textAlign: 'center', ...style}}>
    {title ? <p style={starsTitleStyle} id={titleId}>
      {title}
    </p> : null}
    <div style={noWrapStyle}>
      {starsValues.map((numStars, index): React.ReactElement => <FeedbackStar
        aria-describedby={ariaDescribedby || (title ? titleId : undefined)}
        aria-pressed={numStars === score}
        onMouseEnter={setHoveredStars}
        onMouseLeave={(hoveredStars === numStars) ? resetHoveredStars : undefined}
        style={starStyle}
        alt={t('{{numStars}} étoile', {count: numStars, numStars})}
        onClick={onStarClick}
        src={(index < highlightedStars) ? fullStar : emptyStar}
        key={index}
        numStars={(index + 1) as NumStars}
        tabIndex={isTabbable ? undefined : -1} />)}
    </div>
    {onClose ? <ModalCloseButton
      aria-describedby={ariaDescribedby || (title ? titleId : undefined)}
      onClick={onClose} style={closeButtonStyle} /> : null}
  </div>
}


export default React.memo(FeedbackStars)
