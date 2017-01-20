import React from 'react'
import {connect} from 'react-redux'

import {advisorRecommendationIsShown} from 'store/actions'
import {PageWithNavigationBar} from 'components/navigation'

import {ReorientationAdvice} from './advisor/reorientation'


class AdvisorPageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    onAccept: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  componentWillMount() {
    const {dispatch, project} = this.props
    dispatch(advisorRecommendationIsShown(project))
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
const AdvisorPage = connect()(AdvisorPageBase)


export {AdvisorPage}
