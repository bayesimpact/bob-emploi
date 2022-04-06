import React from 'react'
import {useRouteMatch} from 'react-router'
import {Redirect} from 'react-router-dom'

import useData from 'store/data'

import DatedList from 'components/dated_list'

const emptyObject = {} as const

const EmailsPage = () => {
  const {params: {site: encodedSite}} = useRouteMatch<{site: string}>()
  const site = decodeURIComponent(encodedSite)
  const {sites: {[site]: {lastSentEmail: emails = emptyObject} = {}} = {}} = useData()
  if (!Object.keys(emails)) {
    return <Redirect to="/" />
  }
  return <DatedList dates={emails}>Campaign ID</DatedList>
}

export default React.memo(EmailsPage)
