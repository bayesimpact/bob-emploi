import {useEffect} from 'react'
import {useDispatch} from 'react-redux'

import {switchToMobileVersionAction} from 'store/actions'
import isMobileVersion from 'store/mobile'

const useMobileViewport = (): void => {
  const dispatch = useDispatch()
  useEffect((): void => {
    if (isMobileVersion) {
      dispatch(switchToMobileVersionAction)
      const viewport = document.getElementById('viewport')
      viewport && viewport.setAttribute('content', 'initial-scale=1')
    }
  }, [dispatch])
}

export default useMobileViewport
