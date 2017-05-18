import React from 'react'
import PropTypes from 'prop-types'

import lifeActivitiesImage from 'images/life-activities.svg'
import {Colors, GrowingNumber, PaddedOnMobile, PieChart} from 'components/theme'

import {PersonalizationBoxes} from './base'


class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const strongStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 40,
    }
    return <div style={{alignItems: 'center', display: 'flex'}}>
      <div style={{flex: 1, lineHeight: '21px'}}>
        <strong style={strongStyle}>
          <GrowingNumber number={80} isSteady={true} />%
        </strong> des accompagnateurs
        pensent que le bénévolat contribue au <strong>retour à l'emploi</strong> et valorise
        votre profil.
      </div>
      {isMobileVersion ? null : <PieChart
          style={{color: Colors.SKY_BLUE, marginLeft: 50}} percentage={80}
          backgroundColor={Colors.MODAL_PROJECT_GREY}>
        <GrowingNumber number={80} />
      </PieChart>}
    </div>
  }
}


const personalizations = [
  {
    filters: ['TIME_MANAGEMENT'],
    tip: <span>Donnez-vous des objectifs du type : « cette semaine je vais à deux
      évènements »</span>,
  },
  {
    filters: ['MOTIVATION'],
    tip: "Organisez vos semaines pour garder du temps juste pour vous aérer l'esprit",
  },
  {
    filters: ['RESUME'],
    tip: <span>Donnez-vous un objectif du type : « cette semaine je veux faire x
      candidatures » et essayez de le tenir</span>,
  },
]


class AdvicePageContent extends React.Component {
  render() {
    return <div>
      <PaddedOnMobile>Préservez votre équilibre de vie&nbsp;:</PaddedOnMobile>
      <img src={lifeActivitiesImage} style={{display: 'block', width: '100%'}} />

      <PersonalizationBoxes
          {...this.props} style={{marginTop: 30}}
          personalizations={personalizations} />
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
