import React from 'react'

import {Colors, GrowingNumber, PaddedOnMobile, PieChart} from 'components/theme'

import eventsTypes from './data/events.json'

import {AdviceCard} from './base'


class FullAdviceCard extends React.Component {
  static propTypes = {
    project: React.PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {project} = this.props
    const {isMobileVersion} = this.context
    const reasons = ['JUST_STARTED_SEARCHING', 'LESS_THAN_15_OFFERS', 'NO_OFFERS']
    // TODO(guillaume): Add the number of events when we have it.
    // TODO(guillaume): Remove the fixed width, find a cleaner way to keep the text on one line.
    const atAnEvent = (eventsTypes || {})[project.targetJob.jobGroup.romeId[0]] || 'à un événement.'

    return <AdviceCard {...this.props} reasons={reasons}>
      <div style={{alignItems: 'center', display: 'flex', fontSize: 30, lineHeight: '1.2em'}}>
        <div>
          Vous pourriez rencontrez votre nouvel employeur {atAnEvent}.
        </div>
        {isMobileVersion ? null : <div style={{marginLeft: 50, width: 250}}>
          <PieChart
            style={{color: Colors.SKY_BLUE, marginLeft: 'auto', marginRight: 'auto'}}
            percentage={60}
            backgroundColor={Colors.MODAL_PROJECT_GREY}>
            <GrowingNumber number={60} />%
          </PieChart>
          <div style={{fontSize: 13, fontWeight: 500, lineHeight: '1em', marginTop: 10}}>
            des gens ont trouvé ça utile
          </div>
        </div>}
      </div>
    </AdviceCard>
  }
}

// TODO(guillaume): Create the advice page.
class AdvicePageContent extends React.Component {
  render() {
    return <div>
      <PaddedOnMobile>Trouvez les bons événements&nbsp;:</PaddedOnMobile>
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
