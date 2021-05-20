import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useRef} from 'react'


interface Props extends React.HTMLProps<HTMLDivElement> {
  children: React.ReactElement
  onOutsideClick?: () => void
}


// A component to handle when mouse is clicked outside its children.
// All clicks on children won't be handled. All clicks outside will trigger onOutsideClick. You can
// also add other props such as style.
const OutsideClickHandler = (props: Props): React.ReactElement => {
  const {children, onOutsideClick, ...extraProps} = props

  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent): void => {
    if (event.target && wrapperRef.current?.contains(event.target as Node)) {
      return
    }
    onOutsideClick?.()
  }, [onOutsideClick])

  useEffect((): (() => void) => {
    document.addEventListener('mousedown', handleClickOutside)
    return (): void => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  return <div ref={wrapperRef} {...extraProps}>
    {children}
  </div>
}
OutsideClickHandler.propTypes = {
  children: PropTypes.element.isRequired,
  onOutsideClick: PropTypes.func,
}


export default React.memo(OutsideClickHandler)
