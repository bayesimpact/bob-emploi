import PropTypes from 'prop-types'
import React from 'react'

import {getInterviewTips} from 'store/actions'

import {ImproveApplicationTips} from './base'


function getSimpleSkills(improveSuccessRateData, numSkills) {
  const skillsSoup = improveSuccessRateData && improveSuccessRateData.requirements &&
    improveSuccessRateData.requirements.skillsShortText || ''
  return skillsSoup.split('\n').filter(skill => skill).slice(0, numSkills).
    map(skill => skill.replace(/^\* /, '').replace(/, .*$/, '')).
    map(skill => skill.toLocaleLowerCase())
}


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {improveSuccessRateData} = this.props.advice
    const skills = getSimpleSkills(improveSuccessRateData, 3)
    if (!skills.length) {
      return <div style={{fontSize: 30}}>
        En expliquant bien pourquoi <strong>votre profil est adapté pour
        le poste</strong> vous augmenterez vos chances en entretien.
      </div>
    }
    return <div style={{fontSize: 30}}>
      En mettant en avant votre <strong>{skills.join(', ')}…</strong> vous
      commencez à montrer votre motivation.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  render() {
    return <ImproveApplicationTips
      {...this.props}
      tipsCacheField="improve-interview"
      sections={[
        {data: 'qualities', title: 'Qualités les plus attendues par les recruteurs :'},
        {data: 'preparations', title: 'Pour préparer votre entretien'},
      ]}
      getTipsAction={getInterviewTips} />
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
