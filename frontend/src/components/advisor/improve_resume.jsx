import PropTypes from 'prop-types'
import React from 'react'

import {lowerFirstLetter} from 'store/french'
import {genderizeJob} from 'store/job'
import {USER_PROFILE_SHAPE} from 'store/user'

import Picto from 'images/advices/picto-resume.png'

import {ImproveApplicationTips} from './base'


function splitBullets(markdownContent) {
  if (!markdownContent) {
    return []
  }
  return markdownContent.replace(/^\* /, '').split('\n* ')
}

function getPersonalizedItems(improveSuccessRateData) {
  const {bonusSkillsShortText, trainingsShortText} =
    improveSuccessRateData && improveSuccessRateData.requirements || {}
  return splitBullets(bonusSkillsShortText || '').concat(splitBullets(trainingsShortText || ''))
}


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    fontSize: PropTypes.number.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {advice, fontSize, profile, project, userYou} = this.props
    const {improveSuccessRateData} = advice
    const personalizedItems = getPersonalizedItems(improveSuccessRateData)
    if (personalizedItems.length) {
      return <div style={{fontSize: fontSize}}>
        <strong>{personalizedItems[0]}</strong> pour augmenter
        {userYou(' tes chances quand tu postules ', ' vos chances quand vous postulez ')}
        comme <strong>{lowerFirstLetter(genderizeJob(project.targetJob, profile.gender))}</strong>.
      </div>
    }
    return <div style={{fontSize: fontSize}}>
      En <strong>expliquant bien pourquoi votre profil est adapté pour
      le poste</strong> votre candidature aura beaucoup plus de poids.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const props = this.props
    return <ImproveApplicationTips
      {...props}
      sections={[
        {
          data: 'qualities',
          title: 'Qualités les plus attendues par les recruteurs :',
        },
        {
          data: 'improvements',
          title: `Pour améliorer ${props.userYou('ta', 'votre')} candidature`,
        },
      ]}
    />
  }
}


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
