import PropTypes from 'prop-types'
import React from 'react'


import {weeklyApplicationOptions, weeklyOfferOptions}
  from 'components/pages/connected/profile/jobsearch'
import {getIMTURL, getJobSearchURL} from 'store/job'
import {getSeniorityText, getTrainingFulfillmentEstimateOptions,
  PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_EXPERIENCE_OPTIONS, PROJECT_KIND_OPTIONS,
  PROJECT_PASSIONATE_OPTIONS, PROJECT_LOCATION_AREA_TYPE_OPTIONS} from 'store/project'
import {getFamilySituationOptions, getHighestDegreeDescription,
  getUserFrustrationTags, userAge} from 'store/user'

import {ExternalLink, Textarea} from 'components/theme'


interface SelectOption {
  name: string
  value: string
}


function getOptionName(options: SelectOption[], value: string): string {
  if (value) {
    const myOption = options.find((option): boolean => option.value === value)
    return myOption && myOption.name || value
  }
  return undefined
}

function replaceFalseValue(oldValue: number, newValue: string): string {
  return oldValue && oldValue !== -1 ? ('' + oldValue) : newValue
}

function getInterviewCountValidity(project: bayes.bob.Project): boolean {
  return project.totalInterviewCount && project.totalInterviewCount !== 0
}


const cleanProfile = (profile: bayes.bob.UserProfile): bayes.bob.UserProfile => {
  const {
    gender: omittedGender,
    hasHandicap: omittedHasHandicap,
    highestDegree: omittedHighestDegree,
    yearOfBirth: omittedYearOfBirth,
    familySituation: omittedFamilySituation,
    frustrations: omittedFrustrations,
    customFrustrations: omittedCustomFrustrations,
    ...cleanedProfile
  } = profile
  return cleanedProfile
}


const cleanProject = (project: bayes.bob.Project): bayes.bob.Project => {
  const {
    areaType: omittedAreaType,
    employmentTypes: omittedEmploymentTypes,
    jobSearchLengthMonths: omittedJobSearchLengthMonths,
    kind: omittedKind,
    networkEstimate: omittedNetworkEstimate,
    passionateLevel: omittedPassionateLevel,
    previousJobSimilarity: omittedPreviousJobSimilarity,
    seniority: omittedSeniority,
    totalInterviewCount: omittedTotalInterviewCount,
    trainingFulfillmentEstimate: omittedTrainingFulfillmentEstimate,
    weeklyApplicationsEstimate: omittedWeeklyApplicationsEstimate,
    weeklyOffersEstimate: omittedWeeklyOffersEstimate,
    ...cleanedProject
  } = project
  const {departementName: omittedDepartementName = '', name: omittedName = '',
    ...cleanedCity} = project.city || {}
  return project.city ? {...cleanedProject, city: cleanedCity} : cleanedProject
}


class UseCase extends React.PureComponent<{useCase: bayes.bob.UseCase}> {
  public static propTypes = {
    useCase: PropTypes.shape({
      userData: PropTypes.shape({
        registeredAt: PropTypes.string.isRequired,
      }).isRequired,
    }).isRequired,
  }

  // TODO(marielaure): Use components instead of renders.
  private renderLinks(
    project: bayes.bob.Project, gender: bayes.bob.Gender): React.ReactNode {
    const {targetJob, city = {}} = project
    return <div style={{marginBottom: 10}}>
      <ExternalLink href={getJobSearchURL(targetJob, gender)}>
        Chercher le métier sur Google
      </ExternalLink>
      {' '}&ndash;{' '}
      <ExternalLink href={getIMTURL(targetJob, city)}>
        Voir l'IMT
      </ExternalLink>
    </div>
  }

  private renderSection(title, elements, sectionKey): React.ReactNode {
    const titleStyle: React.CSSProperties = {
      fontWeight: 'bold',
    }
    if (!elements.length) {
      return <div style={titleStyle}>{`Pas de ${title.toLowerCase()}`}</div>
    }
    return <div>
      <div style={titleStyle}>{title}&nbsp;:</div>
      <ul style={{listStyleType: 'none'}}>
        {elements.map((element, index): React.ReactNode =>
          <li key={sectionKey + index}>{element}</li>)}
      </ul>
    </div>
  }

  private renderProfile(profile: bayes.bob.UserProfile, location): React.ReactNode {
    const familySituations = getFamilySituationOptions(profile.gender)
    const handicapText = profile.gender === 'FEMININE' ? 'Handicapée' : 'Handicapé'

    return this.renderSection(
      'Profil',
      [
        profile.gender === 'FEMININE' ? 'Femme' : 'Homme',
        getOptionName(familySituations, profile.familySituation),
        userAge(profile.yearOfBirth) + ' ans',
        'Diplôme : ' + (getHighestDegreeDescription(profile) || 'aucun'),
        (profile.hasHandicap ? handicapText : null),
        `${location.name} ` +
        `(${location.departementId} - ${location.departementName})`,
      ],
      'profile'
    )
  }

  private renderResearch(project: bayes.bob.Project): React.ReactNode {
    const totalInterviewCountText = getInterviewCountValidity(project) &&
      replaceFalseValue(project.totalInterviewCount, '0')

    return this.renderSection(
      'Recherche',
      [
        project.jobSearchLengthMonths > 0 ?
          `Recherche depuis ${project.jobSearchLengthMonths} mois` :
          "N'a pas commencé sa recherche",
        'Offres par semaine : ' + project.weeklyOffersEstimate ?
          getOptionName(weeklyOfferOptions, project.weeklyOffersEstimate) : 'inconnu',
        'Candidatures par semaine : ' + project.weeklyApplicationsEstimate ?
          getOptionName(weeklyApplicationOptions, project.weeklyApplicationsEstimate) : 'inconnu',
        totalInterviewCountText ? `${totalInterviewCountText} entretiens décroché(s)` : null,
      ],
      'research'
    )
  }

  private renderProject(
    profile: bayes.bob.UserProfile, project: bayes.bob.Project): React.ReactNode {
    const employmentStatus = (project.employmentTypes || []).map((employmentType): string => (
      getOptionName(PROJECT_EMPLOYMENT_TYPE_OPTIONS, employmentType)
    ))
    const employmentStatusText = employmentStatus.join(', ')
    const trainingFulfillmentOptions = getTrainingFulfillmentEstimateOptions(profile.gender)
    const totalTrainingOptions = trainingFulfillmentOptions.concat([{
      name: 'Pas de diplôme requis',
      value: 'NO_TRAINING_REQUIRED',
    }])
    const trainingFulfillmentStatus = getOptionName(
      totalTrainingOptions, project.trainingFulfillmentEstimate
    )

    return this.renderSection(
      'Projet',
      [
        getOptionName(PROJECT_KIND_OPTIONS, project.kind),
        'en ' + employmentStatusText,
        getOptionName(PROJECT_PASSIONATE_OPTIONS, project.passionateLevel),
        'Diplôme suffisant : ' + trainingFulfillmentStatus,
        'Expérience : ' + getSeniorityText(project.seniority),
        getOptionName(PROJECT_EXPERIENCE_OPTIONS, project.previousJobSimilarity),
        'Mobilité : ' + getOptionName(PROJECT_LOCATION_AREA_TYPE_OPTIONS, project.areaType),
        'Réseau : ' + replaceFalseValue(project.networkEstimate, 'inconnu'),
      ],
      'project'
    )
  }

  private renderFrustrations(profile: bayes.bob.UserProfile): React.ReactNode {
    const frustrations = getUserFrustrationTags(profile) || []
    const totalFrustrations = frustrations.concat(profile.customFrustrations || [])
    return this.renderSection('Frustrations', totalFrustrations, 'frustrations')
  }

  public render(): React.ReactNode {
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

    const {profile = {}, projects: [project = {}] = []} = userData
    const {city = {}} = project

    // TODO (Marie Laure): Use a helper function instead of this manual approach
    const remainingData = {
      ...userData,
      profile: userData.profile && cleanProfile(userData.profile),
      projects: userData.projects && userData.projects.map(cleanProject),
    }

    const json = JSON.stringify(remainingData, null, 2).replace(/[{}",[\]]/g, '')

    return <div style={boxStyle}>
      {this.renderLinks(project, profile.gender) || null}
      {this.renderProfile(profile, city)}
      {this.renderProject(profile, project || {})}
      {this.renderResearch(project)}
      {this.renderFrustrations(profile) || null}
      <Textarea value={json} readOnly={true} style={textareaStyle} />
    </div>
  }
}

export {UseCase}
