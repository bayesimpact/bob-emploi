import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import {createSupportTicket, useDispatch} from 'store/actions'

import {RadiumExternalLink} from 'components/radium'

function getRandomTicketId(): string {
  return 'support-' + (Math.random() * 36).toString(36)
}

interface HelpDeskLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'ref' | 'href'> {
  children: string
  href?: string
}

interface HelpDeskLinkBasicProps {
  href: string
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

const helpDeskProductSource = (source?: string): string => {
  const productSourceBase = `${config.productName.toLowerCase()}-${config.countryId}`
  if (!source) {
    return productSourceBase
  }
  return `${productSourceBase}-${source}`
}

export const useHelpDeskLinkProps = (props?: Partial<HelpDeskLinkBasicProps>):
HelpDeskLinkBasicProps|undefined => {
  const {onClick} = props || {}
  const {t: translate} = useTranslation('components')
  const dispatch = useDispatch()
  const hasUser = useSelector(({user: {userId}}: RootState): boolean => !!userId)
  const userSource = useSelector(({user}: RootState) => user?.origin?.source)
  const [ticketId, setTicketId] = useState(getRandomTicketId())
  const productSource = helpDeskProductSource(userSource)
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
  const finalHref = translate(config.helpRequestUrl, {
    productSource: encodeURIComponent(productSource),
    ticketId: hasUser ? encodeURIComponent(ticketId) : '',
  })
  if (!config.helpRequestUrl) {
    return undefined
  }
  return {href: finalHref, onClick: finalOnClick}
}


const HelpDeskLink: React.FC<HelpDeskLinkProps> =
({onClick, style, ...props}): React.ReactElement|null => {
  const helpDeskLinkProps = useHelpDeskLinkProps({onClick})
  const finalStyle = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])
  if (!helpDeskLinkProps) {
    return null
  }
  const {href: finalHref, onClick: finalOnClick} = helpDeskLinkProps
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <RadiumExternalLink
    {...props} href={finalHref} onClick={finalOnClick} style={finalStyle} />
}


export default React.memo(HelpDeskLink)
