import * as Sentry from '@sentry/browser'
import PropTypes from 'prop-types'
import React, {useCallback, useRef, useState} from 'react'


const missingImages: Set<string> = new Set([])


interface Props
  extends React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> {
  alt: string
  fallbackSrc: string
}

// An image with an external source that loads a fallback if not available.
const ExternalImage = (props: Props): React.ReactElement => {
  const {alt, fallbackSrc, ...otherProps} = props
  const [hasErred, setHasErred] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)

  const handleError = useCallback((): void => {
    if (!hasErred && imgRef.current) {
      const src = imgRef.current.src
      if (!missingImages.has(src)) {
        Sentry.captureMessage?.(`Image source is no longer available: ${src}.`) &&
          missingImages.add(src)
      }
      if (fallbackSrc) {
        imgRef.current.src = fallbackSrc
      }
      setHasErred(true)
    }
  }, [fallbackSrc, hasErred])

  return <img ref={imgRef} {...otherProps} alt={alt} onError={handleError} />
}
ExternalImage.propTypes = {
  alt: PropTypes.string.isRequired,
  fallbackSrc: PropTypes.string,
}


export default React.memo(ExternalImage)
