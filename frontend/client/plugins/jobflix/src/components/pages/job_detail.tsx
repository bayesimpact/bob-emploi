import React from 'react'
import {useParams} from 'react-router'

import {JobDetail} from '../job_detail'
import {verticalPagePadding} from '../padding'


const noPageTopMarginStyle: React.CSSProperties = {
  marginTop: `-${verticalPagePadding}px`,
}
const JobDetailPage = (): React.ReactElement|null => {
  const {sectionId, romeId} = useParams<{sectionId: string; romeId: string}>()
  return <div style={noPageTopMarginStyle}><JobDetail sectionId={sectionId} romeId={romeId} /></div>
}
export default React.memo(JobDetailPage)
