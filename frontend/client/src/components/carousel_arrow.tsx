import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {SmoothTransitions} from 'components/theme'


interface Props {
  chevronSize?: number
  handleClick: () => void
  isLeft?: boolean
  isVisible?: boolean
  style?: React.CSSProperties
}


// TODO(sil): Find a way to refactor carousels. There are too many custom ones.
const CarouselArrow = (props: Props): React.ReactElement => {
  const {chevronSize, handleClick, isLeft, isVisible, style} = props
  const {t} = useTranslation('components')
  const chevronContainerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: colors.BOB_BLUE,
    borderRadius: 25,
    boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
    cursor: isVisible ? 'pointer' : 'auto',
    display: 'flex',
    height: 45,
    justifyContent: 'center',
    opacity: isVisible ? 1 : 0,
    width: 45,
    ...SmoothTransitions,
    ...style,
  }), [isVisible, style])
  return <button
    style={chevronContainerStyle} type="button"
    onClick={handleClick} aria-hidden={!isVisible} tabIndex={isVisible ? 0 : -1}>
    {isLeft ? <ChevronLeftIcon color="#fff" size={chevronSize} aria-label={t('Précédent')} /> :
      <ChevronRightIcon color="#fff" size={chevronSize} aria-label={t('Suivant')} />}
  </button>
}


export default React.memo(CarouselArrow)
