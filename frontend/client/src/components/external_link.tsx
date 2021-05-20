import React from 'react'

import useMedia from 'hooks/media'


type Props = React.ComponentPropsWithoutRef<'a'>


// TODO(émilie): Create a QRCode for links when isForPrint is true.
const ExternalLink = (props: Props): React.ReactElement => {
  const {children, href, ...otherProps} = props
  const isForPrint = useMedia() === 'print'
  if (isForPrint) {
    return <React.Fragment>
      {children}
      &nbsp;(<a rel="noopener noreferrer" target="_blank" {...otherProps} href={href}>
        {href}
      </a>)
    </React.Fragment>
  }
  return <a rel="noopener noreferrer" target="_blank" href={href} {...otherProps}>
    {children}
  </a>
}


export default React.memo(ExternalLink)
