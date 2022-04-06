import React, {useEffect} from 'react'
import {useDispatch} from 'react-redux'
import {useParams} from 'react-router'
import {Redirect} from 'react-router-dom'

import isMobileVersion from 'store/mobile'

import type {DispatchAllUpskillingActions} from '../../store/actions'
import {exploreUpskillingJob} from '../../store/actions'
import {JobDetail, mobileSidePadding} from '../job_detail'
import {verticalPagePadding} from '../padding'


const noPageTopMarginStyle: React.CSSProperties = {
  marginTop: `-${verticalPagePadding}px`,
  padding: `0 ${mobileSidePadding}px`,
}

const JobDetailPage = (): React.ReactElement|null => {
  const {sectionId, romeId} = useParams<{sectionId: string; romeId: string}>()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  useEffect(() => {
    dispatch(exploreUpskillingJob({jobGroup: {romeId}}, sectionId))
  }, [dispatch, romeId, sectionId])
  if (!isMobileVersion) {
    return <Redirect to={`/${sectionId}`} />
  }
  return <div style={noPageTopMarginStyle}><JobDetail sectionId={sectionId} romeId={romeId} /></div>
}
export default React.memo(JobDetailPage)
