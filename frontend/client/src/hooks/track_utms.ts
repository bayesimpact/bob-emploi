import {useEffect} from 'react'
import {useDispatch} from 'react-redux'
import {useLocation} from 'react-router'

import {trackInitialUtm} from 'store/actions'
import {parseQueryString} from 'store/parse'

export default (): void => {
  const dispatch = useDispatch()
  const {search} = useLocation()
  useEffect((): void => {
    const {
      utm_campaign: campaign,
      utm_content: content,
      utm_medium: medium,
      utm_source: source,
    } = parseQueryString(search)
    if (campaign || content || medium || source) {
      dispatch(trackInitialUtm({campaign, content, medium, source}))
    }
  }, [dispatch, search])
}
