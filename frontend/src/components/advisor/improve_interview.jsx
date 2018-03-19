import PropTypes from 'prop-types'
import React from 'react'

import Picto from 'images/advices/picto-improve-interview.png'

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
    fontSize: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {fontSize, userYou} = this.props
    const {improveSuccessRateData} = this.props.advice
    const skills = getSimpleSkills(improveSuccessRateData, 3)
    if (!skills.length) {
      return <div style={{fontSize: fontSize}}>
        En expliquant bien pourquoi <strong>{userYou('ton', 'votre')} profil est adapté
        pour le poste</strong>
        {userYou(' tu augmenteras tes', ' vous augmenterez vos')} chances en entretien.
      </div>
    }
    return <div style={{fontSize: fontSize}}>
      En mettant en avant votre <strong>{skills.join(', ')}…</strong> vous
      commencez à montrer votre motivation.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {userYou} = this.props
    return <ImproveApplicationTips
      {...this.props}
      sections={[
        {
          data: 'qualities',
          title: 'Qualités les plus attendues par les recruteurs :',
        },
        {
          data: 'preparations',
          title: userYou('Pour préparer ton entretien', 'Pour préparer votre entretien'),
        },
      ]} />
  }
}


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
