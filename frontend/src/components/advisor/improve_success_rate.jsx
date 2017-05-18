import React from 'react'
import PropTypes from 'prop-types'

import {USER_PROFILE_SHAPE} from 'store/user'

import {workImage} from 'images/work-picto.svg'
import {FeatureLikeDislikeButtons} from 'components/like'
import {Colors, Markdown, PaddedOnMobile} from 'components/theme'

import {PersonalizationBoxes} from './base'


function countMainBullets(markdownContent) {
  return markdownContent.split('\n* ').length
}


class WorkBox extends React.Component {
  static propTypes = {
    featureId: PropTypes.string.isRequired,
    featureName: PropTypes.node.isRequired,
    featureNameSingular: PropTypes.node.isRequired,
    features: PropTypes.string.isRequired,
    style: PropTypes.object,
    subTitle: PropTypes.node.isRequired,
  }

  render() {
    const {featureId, featureName, featureNameSingular, subTitle, features, style} = this.props
    if (!features || !features.length) {
      return null
    }
    const containerStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      padding: 30,
    }
    const contentStyle = {
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 2,
      padding: 20,
      position: 'relative',
    }
    const featureCount = countMainBullets(features)
    return <div style={containerStyle}>
      <header style={headerStyle}>
        <img src={workImage} style={{marginRight: 40}} />
        <div style={{flex: 1}}>
          <div style={{color: Colors.DARK_TWO, fontSize: 30, lineHeight: '40px'}}>
            <strong style={{color: Colors.GREENISH_TEAL, fontSize:
              40}}>{featureCount}</strong> {featureCount > 1 ? featureName : featureNameSingular}
          </div>
          <div style={{color: Colors.CHARCOAL_GREY, fontSize: 16}}>
            {subTitle}
          </div>
        </div>
      </header>

      <div style={contentStyle}>
        <FeatureLikeDislikeButtons
            style={{position: 'absolute', right: 30, top: -16}}
            feature={`improve-interview-${featureId}`} />
        <Markdown content={features} />
      </div>
    </div>
  }
}


const defaultMeans =
  '* Faites relire votre CV par un proche\n' +
  '* Réutilisez les mots-clés des fiches de postes dans vos CV\n' +
  '* Envoyez des emails de relance aux recruteurs'


const resumePersonalizations = [
  {
    filters: ['ATYPIC_PROFILE'],
    tip: "Reprenez des mots-clés de l'offre pour mieux coller aux attentes des recruteurs",
  },
  {
    filters: ['TIME_MANAGEMENT'],
    tip: <span>Donnez-vous une objectif du type : « chaque candidature ne doit pas me
      prendre plus de x heures »</span>,
  },
  {
    filters: ['MOTIVATION'],
    tip: <span>Donnez-vous un objectif du type : « cette semaine je veux faire x
      candidatures » et essayez de le tenir</span>,
  },
  {
    filters: ['RESUME'],
    tip: `Créez plusieurs versions de votre CV, pour pouvoir les combiner
      rapidement quand vous répondez à une nouvelle offre`,
  },
  {
    filters: ['NO_OFFER_ANSWERS'],
    tip: `Faites des relances une semaine après avoir envoyé votre candidature
      pour montrer votre motivation`,
  },
  {
    filters: ['NEW_JOB', 'FIRST_JOB_SEARCH', 'YOUNG_AGE'],
    tip: 'Montrez que vous êtes flexible et enthousiaste et que vous apprenez vite',
  },
]


class ResumeAdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {advice, profile, project} = this.props
    const {isMobileVersion} = this.context
    const {improveSuccessRateData} = advice
    const isFeminine = profile.gender === 'FEMININE'
    const skills =
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.skillsShortText ||
      (`* Vous êtes organisé${isFeminine ? 'e' : ''} et ` +
      `travailleu${isFeminine ? 'r' : 'se'}\n` +
      '* Vous savez vous adapter et trouver des solutions\n' +
      '* Vous savez gérer votre stress et garder le sourire')
    const trainings =
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.trainingsShortText || ''
    return <div>
      <PaddedOnMobile>Nos conseils</PaddedOnMobile>
      <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
        <WorkBox
            featureId="improve-resume-qualities" featureNameSingular="qualité"
            featureName="qualités" subTitle="incontournables à mettre dans votre CV"
            features={skills} style={{flex: 1}} />
        <div style={{height: 30, width: 30}} />
        {trainings ? <WorkBox
            featureId="improve-resume-trainings" featureNameSingular="compétence"
            featureName="compétences" subTitle="nouvelles à apprendre facilement"
            features={trainings} style={{flex: 1}} />
        : <WorkBox
            featureId="improve-resume-means" featureNameSingular="moyen"
            featureName="moyens" subTitle="incontournables pour ne rien laisser passer"
            features={defaultMeans} style={{flex: 1}} />}
      </div>

      <PersonalizationBoxes
          style={{marginTop: 30}} profile={profile} project={project}
          personalizations={resumePersonalizations} />
    </div>
  }
}


export {ResumeAdvicePageContent, WorkBox}
