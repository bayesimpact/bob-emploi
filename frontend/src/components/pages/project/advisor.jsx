import React from 'react'

import {PageWithNavigationBar} from 'components/navigation'
import {ReorientationAdvice} from './advisor/reorientation'


class AdvisorPage extends React.Component {
  static propTypes = {
    onAccept: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  render() {
    const {onAccept, onDecline, project} = this.props
    // TODO(pascal): Make this dynamic depending on the Advice Module that triggered.
    const RecommendComponent = ReorientationAdvice
    return <PageWithNavigationBar page="advisor" style={{padding: 30}} isContentScrollable={true}>
      <RecommendComponent
          project={project} onAccept={onAccept} onDecline={onDecline}
          style={{margin: 'auto', width: 700}} />
    </PageWithNavigationBar>
  }
}


export {AdvisorPage}
