import PropTypes from 'prop-types'
import React from 'react'

import {PROJECT_EXPERIENCE_OPTIONS,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  getSeniorityText} from 'store/project'
import {getHighestDegreeDescription, getFamilySituationOptions,
  getUserFrustrationTags, userAge} from 'store/user'

const PROJECT_GOAL_OPTIONS = [
  {name: 'Retrouver un emploi', value: 'FIND_A_NEW_JOB'},
  {name: 'Me reconvertir', value: 'REORIENTATION'},
  {name: 'Trouver mon premier emploi', value: 'FIND_A_FIRST_JOB'},
  {name: 'Trouver un autre emploi', value: 'FIND_ANOTHER_JOB'},
  {name: 'Créer une entreprise', value: 'CREATE_COMPANY'},
  {name: 'Reprendre une entreprise', value: 'TAKE_OVER_COMPANY'},
]

function getOptionName(options, value) {
  const myOption = options.find(option => option.value === value)
  return myOption && myOption.name || value
}

function replaceFalseValue(oldValue, newValue)  {
  return oldValue && oldValue !== -1 ? oldValue : newValue
}

class UseCase extends React.Component {
  static propTypes = {
    useCase: PropTypes.shape({
      userData: PropTypes.shape({
        registeredAt: PropTypes.string.isRequired,
      }).isRequired,
    }).isRequired,
  }

  renderSection(title, elements, sectionKey) {
    const titleStyle = {
      fontWeight: 'bold',
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
    const handicapSituation = profile.hasHandicap ? 'oui' : 'non'

    return this.renderSection(
      'Profil',
      [
        profile.gender === 'FEMININE' ? 'Femme' : 'Homme',
        getOptionName(familySituations, profile.familySituation),
        userAge(profile.yearOfBirth) + ' ans',
        'Diplôme : ' + (getHighestDegreeDescription(profile) || 'aucun'),
        'Handicapé : ' + handicapSituation,
        location.name,
        'Dep : ' + location.departementName,
      ],
      'profile'
    )
  }

  // TODO (marielaure) add beavior for totalInterviewCount == 0
  renderProject(project) {
    const employmentStatus = (project.employmentTypes || []).map((employmentType) =>(
      getOptionName(PROJECT_EMPLOYMENT_TYPE_OPTIONS, employmentType)
    ))
    const employmentStatusText = employmentStatus.join()

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
        'Diplôme suffisant : ' + project.trainingFulfillmentEstimate,
        'Temps de recherche (mois) : ' + replaceFalseValue(project.jobSearchLengthMonths,
          'N\'a pas commencé sa recherche'),
        'Offres par semaine : ' + (project.weeklyOffersEstimate || 'inconnu'),
        'Candidatures par semaine : ' + (project.weeklyApplicationsEstimate || 'inconnu'),
        'Entretiens décrochés : ' + replaceFalseValue(project.totalInterviewCount, '0'),
      ],
      'project'
    )
  }

  renderFrustrations(profile) {
    const frustrations = getUserFrustrationTags(profile) || ['Aucune']

    profile.customFrustrations && frustrations.concat(profile.customFrustrations)
    return this.renderSection('Frustrations', frustrations, 'frustrations')
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

    const json = JSON.stringify(userData, null, 2).replace(/[{}",[\]]/g, '')
    const {profile, projects} = userData
    const project = projects && projects.length && projects[0]
    const location = project && project.mobility.city


    return <div style={boxStyle}>
      {this.renderProfile(profile || {}, location || {})}
      {this.renderProject(project || {})}
      {profile ? this.renderFrustrations(profile) : null}
      <textarea value={json} readOnly={true} style={textareaStyle} />
    </div>
  }
}

export {UseCase}
