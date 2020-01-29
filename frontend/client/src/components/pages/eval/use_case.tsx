import {TFunction} from 'i18next'
import GoogleIcon from 'mdi-react/GoogleIcon'
import OpenNewIcon from 'mdi-react/OpenInNewIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'


import {localizeOptions} from 'store/i18n'
import {getIMTURL, genderizeJob, getJobSearchURL, weeklyApplicationOptions} from 'store/job'
import {getSeniorityText, TRAINING_FULFILLMENT_ESTIMATE_OPTIONS,
  PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_EXPERIENCE_OPTIONS, PROJECT_KIND_OPTIONS,
  PROJECT_PASSIONATE_OPTIONS, PROJECT_LOCATION_AREA_TYPE_OPTIONS} from 'store/project'
import {FAMILY_SITUATION_OPTIONS, getHighestDegreeDescription,
  getUserFrustrationTags, userAge} from 'store/user'

import {weeklyOfferOptions} from 'components/pages/connected/profile/jobsearch'
import {ExternalLink, Textarea} from 'components/theme'


const emptyObject = {} as const


interface SelectOption {
  name: string
  value: string
}


function getOptionName(options: readonly SelectOption[], value?: string): string|undefined {
  if (value) {
    const myOption = options.find((option): boolean => option.value === value)
    return myOption && myOption.name || value
  }
  return undefined
}

function replaceFalseValue(oldValue: number|undefined, newValue: string): string {
  return oldValue && oldValue !== -1 ? ('' + oldValue) : newValue
}

function getInterviewCountValidity(project: bayes.bob.Project): boolean {
  return !!project.totalInterviewCount && project.totalInterviewCount !== 0
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


const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 'bold',
}


interface SectionProps {
  elements: readonly React.ReactNode[]
  title: string
}


const SectionBase = (props: SectionProps): React.ReactElement => {
  const {elements, title} = props
  if (!elements.length) {
    return <div style={sectionTitleStyle}>{`Pas de ${title.toLowerCase()}`}</div>
  }
  return <div>
    <div style={sectionTitleStyle}>{title}&nbsp;:</div>
    <ul style={{listStyleType: 'none'}}>
      {elements.filter((element: React.ReactNode): boolean => !!element).
        map((element: React.ReactNode, index: number): React.ReactNode =>
          <li key={index}>{element}</li>)}
    </ul>
  </div>
}
const Section = React.memo(SectionBase)


const iconStyle: React.CSSProperties = {
  color: colors.WARM_GREY,
  height: 15,
  width: 15,
}
const linkStyle: React.CSSProperties = {
  color: colors.WARM_GREY,
  marginLeft: 5,
  textDecoration: 'none',
}
const boxStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 10,
  marginTop: 10,
  padding: 10,
}
const textareaStyle: React.CSSProperties = {
  border: 'none',
  flex: 1,
  height: 600,
  width: '100%',
}
const guestStyle: React.CSSProperties = {
  backgroundColor: colors.SQUASH,
  borderRadius: 3,
  color: '#fff',
  display: 'inline-block',
  fontWeight: 'bold',
  margin: '0 auto',
  padding: 3,
}


interface UseCaseProps {
  t: TFunction
  useCase: bayes.bob.UseCase
}


const UseCaseBase = (props: UseCaseProps): React.ReactElement => {
  const {t, useCase: {userData, userData: {
    hasAccount = false,
    profile = emptyObject as bayes.bob.UserProfile,
    projects: [project = emptyObject as bayes.bob.Project] = [],
  } = {}}} = props

  const profileElements = useMemo((): readonly React.ReactNode[] => {
    const {city: location = emptyObject as bayes.bob.FrenchCity} = project
    const familySituations = localizeOptions(t, FAMILY_SITUATION_OPTIONS, {context: profile.gender})
    const handicapText = profile.gender === 'FEMININE' ? 'Handicapée' : 'Handicapé'
    return [
      profile.gender === 'FEMININE' ? 'Femme' : 'Homme',
      getOptionName(familySituations, profile.familySituation),
      profile.yearOfBirth ? `${userAge(profile.yearOfBirth)} ans` : 'âge inconnu',
      'Diplôme : ' + (getHighestDegreeDescription(profile) || 'aucun'),
      (profile.hasHandicap ? handicapText : null),
      `${location.name} ` +
      `(${location.departementId} - ${location.departementName})`,
    ]
  }, [profile, project, t])

  const totalInterviewCountText = getInterviewCountValidity(project) &&
    replaceFalseValue(project.totalInterviewCount, '0')

  const researchElements = useMemo((): readonly React.ReactNode[] => [
    project.jobSearchLengthMonths && project.jobSearchLengthMonths > 0 ?
      `Recherche depuis ${project.jobSearchLengthMonths} mois` :
      "N'a pas commencé sa recherche",
    'Offres par semaine : ' + project.weeklyOffersEstimate ?
      getOptionName(localizeOptions(t, weeklyOfferOptions), project.weeklyOffersEstimate) :
      'inconnu',
    'Candidatures par semaine : ' + project.weeklyApplicationsEstimate ?
      getOptionName(
        localizeOptions(t, weeklyApplicationOptions), project.weeklyApplicationsEstimate) :
      'inconnu',
    totalInterviewCountText ? `${totalInterviewCountText} entretiens décroché(s)` : null,
  ], [project, t, totalInterviewCountText])

  // TODO(marielaure): Refactor links if needed.
  // TODO(marielaure): Fix links alignment.
  const projectElements = useMemo((): readonly React.ReactNode[] => {
    const employmentStatus = (project.employmentTypes || []).map((employmentType): string => (
      getOptionName(localizeOptions(t, PROJECT_EMPLOYMENT_TYPE_OPTIONS), employmentType) || ''
    ))
    const employmentStatusText = employmentStatus.join(', ')
    const trainingFulfillmentOptions =
      localizeOptions(t, TRAINING_FULFILLMENT_ESTIMATE_OPTIONS, {context: profile.gender})
    const totalTrainingOptions = trainingFulfillmentOptions.concat([{
      name: 'Pas de diplôme requis',
      value: 'NO_TRAINING_REQUIRED',
    }])
    const trainingFulfillmentStatus = getOptionName(
      totalTrainingOptions, project.trainingFulfillmentEstimate,
    )
    const {targetJob, city = {}} = project
    const genderedJob = genderizeJob(targetJob, profile.gender)
    return [
      <React.Fragment key="targetJob-link">
        <span style={{fontWeight: 'bold'}}>{genderedJob}</span>
        <ExternalLink style={linkStyle} href={getJobSearchURL(targetJob, profile.gender)}>
          <GoogleIcon style={iconStyle} />
          <OpenNewIcon style={iconStyle} />
        </ExternalLink>
        <ExternalLink style={linkStyle} href={getIMTURL(targetJob, city)}>
          <span style={{color: colors.WARM_GREY}}>IMT</span>
          <OpenNewIcon style={iconStyle} />
        </ExternalLink></React.Fragment>,
      getOptionName(localizeOptions(t, PROJECT_KIND_OPTIONS), project.kind),
      'en ' + employmentStatusText,
      getOptionName(localizeOptions(t, PROJECT_PASSIONATE_OPTIONS), project.passionateLevel),
      'Diplôme suffisant : ' + trainingFulfillmentStatus,
      'Expérience : ' + getSeniorityText(t, project.seniority),
      getOptionName(
        localizeOptions(t, PROJECT_EXPERIENCE_OPTIONS), project.previousJobSimilarity),
      'Mobilité : ' + getOptionName(
        localizeOptions(t, PROJECT_LOCATION_AREA_TYPE_OPTIONS), project.areaType),
      'Réseau : ' + replaceFalseValue(project.networkEstimate, 'inconnu'),
    ]
  }, [profile, project, t])

  const totalFrustrations = useMemo((): readonly React.ReactNode[] => {
    const frustrations = getUserFrustrationTags(profile) || []
    return frustrations.concat(profile.customFrustrations || [])
  }, [profile])

  const json = useMemo((): string => {
    // TODO (Marie Laure): Use a helper function instead of this manual approach.
    const remainingData = {
      ...userData,
      profile: profile && cleanProfile(profile),
      projects: userData?.projects?.map(cleanProject),
    }
    return JSON.stringify(remainingData, null, 2).replace(/[",[\]{}]/g, '')
  }, [profile, userData])

  // TODO(cyrille): Maybe add a link to direct email if not a guest.
  return <div style={boxStyle}>
    {hasAccount ? null : <div style={{textAlign: 'right'}}>
      <div style={guestStyle}>Guest</div>
    </div>}
    <Section title="Profil" elements={profileElements} />
    <Section title="Projet" elements={projectElements} />
    <Section title="Recherche" elements={researchElements} />
    <Section title="Frustrations" elements={totalFrustrations} />
    <Textarea value={json} readOnly={true} style={textareaStyle} />
  </div>
}
UseCaseBase.propTypes = {
  t: PropTypes.func.isRequired,
  useCase: PropTypes.shape({
    userData: PropTypes.shape({
      registeredAt: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
}
const UseCase = React.memo(UseCaseBase)


export {UseCase}
