import PropTypes from 'prop-types'
import {stringify} from 'query-string'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useSelector} from 'react-redux'

import {RootState, createSupportTicket, useDispatch} from 'store/actions'

import {RadiumExternalLink} from 'components/radium'

function getRandomTicketId(): string {
  return 'support-' + (Math.random() * 36).toString(36)
}

interface HelpDeskLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'ref' | 'href'> {
  children: string
  href?: string
}

interface HelpDeskLinkBasicProps {
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void
  href: string
}


export const useHelpDeskLinkProps = (props?: Partial<HelpDeskLinkBasicProps>):
HelpDeskLinkBasicProps => {
  const {href, onClick} = props || {}
  const dispatch = useDispatch()
  const hasUser = useSelector(({user: {userId}}: RootState): boolean => !!userId)
  const [ticketId, setTicketId] = useState(getRandomTicketId())
  const timeout = useRef<number|undefined>(undefined)
  useEffect((): (() => void) => (): void => window.clearTimeout(timeout.current), [])
  const finalOnClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasUser) {
      dispatch(createSupportTicket(ticketId))
      // Change the ticket ID once the link has been followed.
      timeout.current = window.setTimeout(() => setTicketId(getRandomTicketId()))
    }
    onClick && onClick(event)
  }, [dispatch, hasUser, onClick, ticketId])
  // eslint-disable-next-line camelcase
  const queryString = hasUser ? '?' + stringify({identifiant_bob: ticketId}) : ''
  const finalHref = (href || config.helpRequestUrl) + queryString
  return {href: finalHref, onClick: finalOnClick}
}


const HelpDeskLink: React.FC<HelpDeskLinkProps> =
({href, onClick, style, ...props}): React.ReactElement => {
  const {href: finalHref, onClick: finalOnClick} = useHelpDeskLinkProps({href, onClick})
  const finalStyle = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <RadiumExternalLink
    {...props} href={finalHref} onClick={finalOnClick} style={finalStyle} />
}
HelpDeskLink.propTypes = {
  href: PropTypes.string,
  onClick: PropTypes.func,
  style: PropTypes.object,
}


export default React.memo(HelpDeskLink)
