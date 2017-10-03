import PropTypes from 'prop-types'
import React from 'react'
import _ from 'underscore'

import {weeklyApplicationOptions, weeklyOfferOptions}
  from 'components/pages/profile/jobsearch'
import {getIMTURL, getJobSearchURL} from 'store/job'
import {getSeniorityText, getTrainingFulfillmentEstimateOptions,
  PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_EXPERIENCE_OPTIONS,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS} from 'store/project'
import {getFamilySituationOptions, getHighestDegreeDescription,
  getUserFrustrationTags, userAge} from 'store/user'

// TODO: Factorize this with the onboarding.
const PROJECT_GOAL_OPTIONS = [
  {name: 'Retrouver un emploi (je suis en poste)', value: 'FIND_A_NEW_JOB'},
  {name: 'Me reconvertir', value: 'REORIENTATION'},
  {name: 'Trouver mon premier emploi', value: 'FIND_A_FIRST_JOB'},
  {name: 'Trouver un autre emploi', value: 'FIND_ANOTHER_JOB'},
  {name: 'Créer une entreprise', value: 'CREATE_COMPANY'},
  {name: 'Reprendre une entreprise', value: 'TAKE_OVER_COMPANY'},
]

function getOptionName(options, value) {
  if (value) {
    const myOption = options.find(option => option.value === value)
    return myOption && myOption.name || value
  }
  return undefined
}

function replaceFalseValue(oldValue, newValue)  {
  return oldValue && oldValue !== -1 ? oldValue : newValue
}

function getInterviewCountValidity(project) {
  return  project.totalInterviewCount && project.totalInterviewCount !== 0
}

class UseCase extends React.Component {
  static propTypes = {
    useCase: PropTypes.shape({
      userData: PropTypes.shape({
        registeredAt: PropTypes.string.isRequired,
      }).isRequired,
    }).isRequired,
  }

  renderLinks(project, gender) {
    const {targetJob, mobility} = project
    return <div style={{marginBottom: 10}}>
      <a href={getJobSearchURL(targetJob, gender)} target="_blank" rel="noopener noferrer">
        Chercher le métier sur Google
      </a>
      {' '}&ndash;{' '}
      <a href={getIMTURL(targetJob, mobility.city)} target="_blank" rel="noopener noreferrer">
        Voir l'IMT
      </a>
    </div>
  }

  renderSection(title, elements, sectionKey) {
    const titleStyle = {
      fontWeight: 'bold',
    }
    if (!elements.length) {
      return null
    }
    return <div>
      <div style={titleStyle}>{title}&nbsp;:</div>
      <ul style={{listStyleType: 'none'}}>
        {elements.map((element, index) => (<li key={sectionKey + index}>{element}</li>))}
      </ul>
    </div>
  }

  renderProfile(profile, location) {
    const familySituations = getFamilySituationOptions(profile.gender)
    const handicapText = profile.gender === 'FEMININE' ? 'Handicapée' : 'Handicapé'

    return this.renderSection(
      'Profil',
      [
        profile.gender === 'FEMININE' ? 'Femme' : 'Homme',
        getOptionName(familySituations, profile.familySituation),
        userAge(profile.yearOfBirth) + ' ans',
        'Diplôme : ' + (getHighestDegreeDescription(profile) || 'aucun'),
        (profile.hasHandicap ?  handicapText : null),
        `${location.name} ` +
        `(${location.departementId} - ${location.departementName})`,
      ],
      'profile'
    )
  }

  renderProject(profile, project) {
    const employmentStatus = (project.employmentTypes || []).map((employmentType) =>(
      getOptionName(PROJECT_EMPLOYMENT_TYPE_OPTIONS, employmentType)
    ))
    const employmentStatusText = employmentStatus.join(', ')
    const totalInterviewCountText = getInterviewCountValidity(project) &&
      replaceFalseValue(project.totalInterviewCount, '0')
    const trainingFulfillmentOptions = getTrainingFulfillmentEstimateOptions(profile.gender)
    const noTrainingOption = {
      name: 'Pas de diplôme requis',
      value: 'NO_TRAINING_REQUIRED',
    }
    const totalTrainingOptions = trainingFulfillmentOptions.concat([noTrainingOption])
    const trainingFulfillmentStatus = getOptionName(
      totalTrainingOptions, project.trainingFulfillmentEstimate
    )

    return this.renderSection(
      'Projet',
      [
        getOptionName(PROJECT_GOAL_OPTIONS, project.kind),
        employmentStatusText,
        project.mobility ?
          getOptionName(PROJECT_LOCATION_AREA_TYPE_OPTIONS, project.mobility.areaType) :
          undefined,
        getOptionName(PROJECT_EXPERIENCE_OPTIONS, project.previousJobSimilarity),
        'Network estimate : ' + replaceFalseValue(project.networkEstimate, 'inconnu'),
        'Expérience : ' + getSeniorityText(project.seniority),
        'Diplôme suffisant : ' + trainingFulfillmentStatus,
        project.jobSearchLengthMonths > 0 ?
          `Recherche depuis ${project.jobSearchLengthMonths} mois` :
          "N'a pas commencé sa recherche",
        'Offres par semaine : ' + project.weeklyOffersEstimate ?
          getOptionName(weeklyOfferOptions, project.weeklyOffersEstimate) : 'inconnu',
        'Candidatures par semaine : ' + project.weeklyApplicationsEstimate ?
          getOptionName(weeklyApplicationOptions, project.weeklyApplicationsEstimate) : 'inconnu',

        totalInterviewCountText ? `${totalInterviewCountText} entretiens décroché(s)` : null,
      ],
      'project'
    )
  }

  renderFrustrations(profile) {
    const frustrations = getUserFrustrationTags(profile) || []
    const totalFrustrations = frustrations.concat(profile.customFrustrations || [])
    return this.renderSection('Frustrations', totalFrustrations, 'frustrations')
  }

  render() {
    const {userData} = this.props.useCase
    const boxStyle = {
      backgroundColor: '#fff',
      borderRadius: 10,
      marginTop: 10,
      padding: 10,
    }
    const textareaStyle = {
      border: 'none',
      flex: 1,
      height: 600,
      width: '100%',
    }

    const {profile, projects} = userData
    const project = projects && projects.length && projects[0]
    const location = project && project.mobility.city
    const cleanedProfileFields = ['gender', 'hasHandicap', 'highestDegree', 'yearOfBirth',
      'familySituation', 'frustrations', 'customFrustrations']
    const cleanedProjectsFields = ['kind', 'employmentTypes', 'previousJobSimilarity',
      'networkEstimate', 'seniority', 'trainingFulfillmentEstimate', 'jobSearchLengthMonths',
      'weeklyOffersEstimate', 'weeklyApplicationsEstimate', 'totalInterviewCount']
    const cleanedMobilityFields = ['name', 'departementName']

    // TODO (Marie Laure): Use a helper function instead of this manual approach
    const remainingData = {
      ...userData,
      profile: userData.profile && _.omit(userData.profile, cleanedProfileFields),
      projects: userData.projects && userData.projects.map(project =>
        _.omit({
          ...project,
          mobility: _.omit({
            ...project.mobility,
            city: _.omit(project.mobility.city, cleanedMobilityFields),
          }, 'areaType'),
        }, cleanedProjectsFields)),
    }

    const json = JSON.stringify(remainingData, null, 2).replace(/[{}",[\]]/g, '')

    return <div style={boxStyle}>
      {project && profile && this.renderLinks(project, profile.gender) || null}
      {this.renderProfile(profile || {}, location || {})}
      {this.renderProject(profile || {}, project || {})}
      {profile && this.renderFrustrations(profile) || null}
      <textarea value={json} readOnly={true} style={textareaStyle} />
    </div>
  }
}

export {UseCase}
