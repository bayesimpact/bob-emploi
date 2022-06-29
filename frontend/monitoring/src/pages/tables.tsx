import React from 'react'
import {useRouteMatch} from 'react-router'
import {Redirect} from 'react-router-dom'

import useData from 'store/data'

import DatedList from 'components/dated_list'

const emptyObject = {} as const

const TablesPage = () => {
  const {params: {site: encodedSite}} = useRouteMatch<{site: string}>()
  const site = decodeURIComponent(encodedSite)
  const {sites: {[site]: {lastTableImport: imports = emptyObject} = {}} = {}} = useData()
  if (!Object.keys(imports)) {
    return <Redirect to="/" />
  }
  return <DatedList dates={imports}>Collection Name</DatedList>
}

export default React.memo(TablesPage)
