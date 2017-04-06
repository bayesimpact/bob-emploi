import React from 'react'

import {Colors, PieChart} from 'components/theme'

import {AdviceCard, GrowingNumber, PaddedOnMobile, PersonalizationBoxes} from './base'


class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const strongStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 40,
    }
    const reasons = ['COUNT_MONTHS', 'SINGLE_PARENT', 'TIME_MANAGEMENT', 'MOTIVATION']
    return <AdviceCard {...this.props} reasons={reasons}>
      <div style={{alignItems: 'center', display: 'flex'}}>
        <div style={{flex: 1, lineHeight: '21px'}}>
          <strong style={strongStyle}>
            <GrowingNumber number={80} isSteady={true} />%
          </strong> des accompagnateurs
          SNC pensent que le bénévolat contribue au <strong>retour a l'emploi</strong> et valorise
          votre profil.
        </div>
        {isMobileVersion ? null : <PieChart
            style={{color: Colors.SKY_BLUE, marginLeft: 50}} percentage={80}
            backgroundColor={Colors.MODAL_PROJECT_GREY}>
          <GrowingNumber number={80} />
        </PieChart>}
      </div>
    </AdviceCard>
  }
}


const personalizations = [
  {
    filters: ['TIME_MANAGEMENT'],
    tip: <span>Donnez-vous des objectifs du type : « cette semaine je vais à deux
      événements »</span>,
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
      <img src={require('images/life-activities.svg')} style={{display: 'block', width: '100%'}} />

      <PersonalizationBoxes
          {...this.props} style={{marginTop: 30}}
          personalizations={personalizations} />
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
