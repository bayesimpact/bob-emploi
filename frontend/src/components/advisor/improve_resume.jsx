import PropTypes from 'prop-types'
import React from 'react'

import {getResumeTips} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {genderizeJob} from 'store/job'

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
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {advice, project} = this.props
    const {improveSuccessRateData} = advice
    const personalizedItems = getPersonalizedItems(improveSuccessRateData)
    if (personalizedItems.length) {
      return <div style={{fontSize: 30}}>
        <strong>{personalizedItems[0]}</strong> pour augmenter vos chances
        quand vous postulez
        comme <strong>{lowerFirstLetter(genderizeJob(project.targetJob))}</strong>.
      </div>
    }
    return <div style={{fontSize: 30}}>
      En <strong>expliquant bien pourquoi votre profil est adapté pour
      le poste</strong> votre candidature aura beaucoup plus de poids.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  render() {
    return <ImproveApplicationTips
      {...this.props}
      tipsCacheField="resumeTips"
      sections={[
        {data: 'qualities', title: 'Qualités les plus attendues par les recruteurs :'},
        {data: 'improvements', title: 'Pour améliorer votre candidature'},
      ]}
      getTipsAction={getResumeTips} />
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
