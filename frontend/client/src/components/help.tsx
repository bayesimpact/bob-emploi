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
  href?: string
}

const HelpDeskLinkBase: React.FC<HelpDeskLinkProps> =
({href, onClick, style, ...props}): React.ReactElement => {
  const hasUser = useSelector(({user: {userId}}: RootState): boolean => !!userId)
  const dispatch = useDispatch()
  const [ticketId, setTicketId] = useState(getRandomTicketId())
  const timeout = useRef<number|undefined>(undefined)
  useEffect((): (() => void) => (): void => clearTimeout(timeout.current), [])
  const finalOnClick = useCallback((event) => {
    if (hasUser) {
      dispatch(createSupportTicket(ticketId))
      // Change the ticket ID once the link has been followed.
      timeout.current = setTimeout(() => setTicketId(getRandomTicketId()))
    }
    onClick && onClick(event)
  }, [dispatch, hasUser, onClick, ticketId])
  // eslint-disable-next-line @typescript-eslint/camelcase
  const queryString = hasUser ? '?' + stringify({identifiant_bob: ticketId}) : ''
  const finalHref = (href || config.helpRequestUrl) + queryString
  const finalStyle = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])
  return <RadiumExternalLink
    {...props} href={finalHref} onClick={finalOnClick} style={finalStyle} />
}
HelpDeskLinkBase.propTypes = {
  href: PropTypes.string,
  onClick: PropTypes.func,
  style: PropTypes.object,
}
const HelpDeskLink = React.memo(HelpDeskLinkBase)


export {HelpDeskLink}
