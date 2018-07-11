import React from 'react'

import {PageWithNavigationBar} from 'components/navigation'
import {EarnPointsList} from 'components/points'
import {Routes} from 'components/url'


class PointsPage extends React.Component {
  render() {
    const pageStyle = {
      display: 'flex',
      flexDirection: 'column',
    }
    // TODO(pascal): Set the navbar background color to AMBER_YELLOW.
    return <PageWithNavigationBar
      page="points"
      navBarContent="Mes points"
      onBackClick={Routes.ROOT}
      isChatButtonShown={true} style={pageStyle}>
      <EarnPointsList />
    </PageWithNavigationBar>
  }
}


export default PointsPage
