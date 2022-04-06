import type {LocationDescriptor} from 'history'
import React, {useCallback, useMemo} from 'react'
import {useHistory} from 'react-router'
import {Link} from 'react-router-dom'

import ExternalLink from 'components/external_link'
import {InertButton, useClicking} from 'components/button'
import {useHoverAndFocus} from 'components/radium'


const linkStyle: React.CSSProperties = {
  color: 'inherit',
  outline: 'none',
  textDecoration: 'none',
} as const

// CSS properties that are meant for the DOM container element (as opposed to the inner element).
const containerCSSProps = new Set([
  // Add more if needed.
  'left', 'right', 'bottom', 'top', 'alignSelf', 'margin', 'marginBottom', 'marginLeft',
  'marginRight', 'marginTop', 'marginBottom', 'zIndex',
])
// Spread of display style between container and inner element.
const displayStyleSpread: Record<string, readonly [React.CSSProperties, React.CSSProperties]> = {
  'flex': [{display: 'block'}, {display: 'flex'}],
  'inline-flex': [{display: 'inline-block'}, {display: 'flex'}],
} as const


type LinkProps = React.ComponentProps<typeof Link>
type InertButtonProps = React.ComponentProps<typeof InertButton>


type Props = InertButtonProps & Pick<LinkProps, 'aria-label'|'tabIndex'> & {
  onClick?: () => void
  style?: React.CSSProperties
} & ({href?: never; to: LocationDescriptor<unknown>} | {href: string; to?: never})


const LinkButton = (props: Props): React.ReactElement|null => {
  const {
    ['aria-label']: ariaLabel,
    children,
    href,
    onClick,
    style,
    tabIndex,
    to,
    ...otherProps
  } = props
  const history = useHistory()
  const onClickAndLink = useCallback(() => {
    onClick?.()
    if (to) {
      history.push(to)
    }
  }, [history, onClick, to])
  const {isActive, onClick: handleClick} = useClicking<HTMLAnchorElement>({
    isClickAnyway: true,
    isDefaultPrevented: !!to,
    onClick: to ? onClickAndLink : onClick,
  })
  const [containerStyle, innerStyle] = useMemo((): [React.CSSProperties, React.CSSProperties] => {
    const styleAsEntries = Object.entries(style || {})
    const {display} = style || {}
    const [containerDisplay, innerDisplay] = display ?
      displayStyleSpread[display] || [{display}, {}] : [{}, {}]
    return [
      {
        ...linkStyle,
        ...Object.fromEntries(styleAsEntries.filter(([key]) => containerCSSProps.has(key))),
        ...containerDisplay,
      },
      {
        ...Object.fromEntries(styleAsEntries.filter(([key]) => !containerCSSProps.has(key))),
        ...innerDisplay,
      },
    ]
  }, [style])
  const {isFocused, isHovered, ...radiumHandlers} = useHoverAndFocus<HTMLAnchorElement>()
  const button = <InertButton
    {...otherProps} style={innerStyle} isActive={isActive} isHighlighted={isHovered || isFocused}>
    {children}
  </InertButton>
  if (href) {
    return <ExternalLink
      onClick={onClick && handleClick} style={containerStyle} {...radiumHandlers}
      {...{href, tabIndex}} aria-label={ariaLabel}>
      {button}
    </ExternalLink>
  }
  if (to) {
    return <Link
      onClick={onClick && handleClick} style={containerStyle} {...radiumHandlers}
      {...{tabIndex, to}} aria-label={ariaLabel}>
      {button}
    </Link>
  }
  return null
}
export default React.memo(LinkButton)
