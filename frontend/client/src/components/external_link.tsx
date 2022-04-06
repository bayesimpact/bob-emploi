import React from 'react'

import {useRadium} from 'components/radium'
import useMedia from 'hooks/media'


type Props = React.ComponentPropsWithoutRef<'a'>


// TODO(émilie): Create a QRCode for links when isForPrint is true.
const ExternalLink = (props: Props): React.ReactElement => {
  const {children, href, ...otherProps} = props
  const isForPrint = useMedia() === 'print'
  const [radiumProps] = useRadium<HTMLAnchorElement>(otherProps)
  if (isForPrint) {
    return <React.Fragment>
      {children}
      &nbsp;(<a rel="noopener noreferrer" target="_blank" {...otherProps} href={href}>
        {href}
      </a>)
    </React.Fragment>
  }
  return <a rel="noopener noreferrer" target="_blank" href={href} {...radiumProps}>
    {children}
  </a>
}


export default React.memo(ExternalLink)
