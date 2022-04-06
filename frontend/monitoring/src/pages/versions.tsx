import React from 'react'
import {Link} from 'react-router-dom'

import useData from 'store/data'

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  textAlign: 'center',
}

const greyRowStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0,0,0,.05)',
}

const VersionPage = () => {
  const {computedAt = '', sites = {}} = useData()
  const siteUrls = Object.keys(sites)
  return <div>
    <h2>{computedAt}</h2>
    <div><table style={tableStyle}>
      <thead>
        <tr style={greyRowStyle}>
          <th />
          {siteUrls.map(site => <th key={site}>{site}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>Client version</th>
          {siteUrls.map(site => <td key={site}>{sites[site].frontVersion}</td>)}
        </tr>
        <tr style={greyRowStyle}>
          <th>Server version</th>
          {siteUrls.map(site => <td key={site}>{sites[site].serverVersion}</td>)}
        </tr>
        <tr>
          <th>Coaching Emails</th>
          {siteUrls.map(site => <td key={site}><Link to={`/emails/${encodeURIComponent(site)}`}>
            See all emails
          </Link></td>)}
        </tr>
        <tr>
          <th>Database Collections</th>
          {siteUrls.map(site => <td key={site}>
            <Link to={`/collections/${encodeURIComponent(site)}`}>See all tables</Link>
          </td>)}
        </tr>
      </tbody>
    </table></div>
  </div>
}

export default React.memo(VersionPage)
