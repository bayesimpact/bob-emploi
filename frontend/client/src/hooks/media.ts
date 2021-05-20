import {useDebugValue} from 'react'
import {parseQueryString} from 'store/parse'


export type Media = 'print' | 'screen'


// Get media from URL.
// Maybe reassess this way of setting media and switch to Redux or context if needed.
const {media} = parseQueryString(window.location.search)


function useMedia(): Media {
  const finalMedia = media === 'print' ? media : 'screen'
  useDebugValue(finalMedia)
  return finalMedia
}


export default useMedia
