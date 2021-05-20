import {TFunction} from 'i18next'
import GoogleIcon from 'mdi-react/GoogleIcon'
import OpenNewIcon from 'mdi-react/OpenInNewIcon'
import PropTypes from 'prop-types'
import React, {useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'


import {convertToProto} from 'store/actions'
import {localizeOptions} from 'store/i18n'
import {getIMTURL, genderizeJob, getJobSearchURL, weeklyApplicationOptions,
  weeklyOfferOptions} from 'store/job'
import {getSeniorityText, TRAINING_FULFILLMENT_ESTIMATE_OPTIONS,
  PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_EXPERIENCE_OPTIONS, PROJECT_KIND_OPTIONS,
  PROJECT_PASSIONATE_OPTIONS, PROJECT_LOCATION_AREA_TYPE_OPTIONS} from 'store/project'
import {useAsynceffect} from 'store/promise'
import {FAMILY_SITUATION_OPTIONS, getHighestDegreeDescription, getJobSearchLengthMonths,
  getUserFrustrationTags, userAge} from 'store/user'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import Textarea from 'components/textarea'
import {Routes} from 'components/url'

import {DispatchAllEvalActions} from '../store/actions'


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
  const {t} = useTranslation()
  if (!elements.length) {
    return <div style={sectionTitleStyle}>
      {t('Pas de {{sectionTitle}}', {sectionTitle: title.toLowerCase()})}
    </div>
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


const UseCase = (props: UseCaseProps): React.ReactElement => {
  const {t, useCase: {userData, userData: {
    hasAccount = false,
    profile = emptyObject as bayes.bob.UserProfile,
    projects: [project = emptyObject as bayes.bob.Project] = [],
  } = {}}} = props

  const profileElements = useMemo((): readonly React.ReactNode[] => {
    const {city: location = emptyObject as bayes.bob.FrenchCity} = project
    const familySituations = localizeOptions(t, FAMILY_SITUATION_OPTIONS, {context: profile.gender})
    const handicapText = t('Travailleur·se handicapé·e', {context: profile.gender})
    return [
      // i18next-extract-mark-context-next-line ["", "FEMININE", "MASCULINE"]
      t('Pas de genre renseigné', {context: profile.gender}),
      getOptionName(familySituations, profile.familySituation),
      profile.yearOfBirth ? `${userAge(profile.yearOfBirth)} ans` : t('âge inconnu'),
      t('Diplôme\u00A0: ') + (getHighestDegreeDescription(profile) || t('aucun')),
      (profile.hasHandicap ? handicapText : null),
      `${location.name} ` +
      `(${location.departementId} - ${location.departementName})`,
    ]
  }, [profile, project, t])

  // 0 means unknown, -1 means 0
  const totalInterviewCount = project.totalInterviewCount ?
    project.totalInterviewCount === -1 ? 0 : project.totalInterviewCount : undefined

  const jobSearchLengthMonths = getJobSearchLengthMonths(project)

  const researchElements = useMemo((): readonly React.ReactNode[] => [
    jobSearchLengthMonths ? jobSearchLengthMonths > 0 ?
      t('Recherche depuis {{count}} mois', {count: jobSearchLengthMonths}) :
      t("N'a pas commencé sa recherche") : null,
    t('Offres par semaine\u00A0: ') + project.weeklyOffersEstimate ?
      getOptionName(localizeOptions(t, weeklyOfferOptions), project.weeklyOffersEstimate) :
      t('inconnu'),
    t('Candidatures par semaine\u00A0: ') + project.weeklyApplicationsEstimate ?
      getOptionName(
        localizeOptions(t, weeklyApplicationOptions), project.weeklyApplicationsEstimate) :
      t('inconnu'),
    totalInterviewCount === undefined ?
      null : t('{{count}} entretien décroché', {count: totalInterviewCount}),
  ], [jobSearchLengthMonths, project, t, totalInterviewCount])

  // TODO(sil): Refactor links if needed.
  // TODO(sil): Fix links alignment.
  const projectElements = useMemo((): readonly React.ReactNode[] => {
    const employmentStatus = (project.employmentTypes || []).map((employmentType): string => (
      getOptionName(localizeOptions(t, PROJECT_EMPLOYMENT_TYPE_OPTIONS), employmentType) || ''
    ))
    const employmentStatusText = employmentStatus.join(', ')
    const trainingFulfillmentOptions =
      localizeOptions(t, TRAINING_FULFILLMENT_ESTIMATE_OPTIONS, {context: profile.gender})
    const totalTrainingOptions = [...trainingFulfillmentOptions, {
      name: t('Pas de diplôme requis'),
      value: 'NO_TRAINING_REQUIRED',
    }]
    const trainingFulfillmentStatus = getOptionName(
      totalTrainingOptions, project.trainingFulfillmentEstimate,
    )
    const {areaType, kind, networkEstimate, passionateLevel, previousJobSimilarity, seniority,
      targetJob, city = {}} = project
    const genderedJob = genderizeJob(targetJob, profile.gender)
    return [
      <React.Fragment key="targetJob-link">
        <span style={{fontWeight: 'bold'}}>{genderedJob}</span>
        <ExternalLink style={linkStyle} href={getJobSearchURL(t, targetJob, profile.gender)}>
          <GoogleIcon style={iconStyle} />
          <OpenNewIcon style={iconStyle} />
        </ExternalLink>
        <ExternalLink style={linkStyle} href={getIMTURL(t, targetJob, city)}>
          <span style={{color: colors.WARM_GREY}}>IMT</span>
          <OpenNewIcon style={iconStyle} />
        </ExternalLink></React.Fragment>,
      getOptionName(localizeOptions(t, PROJECT_KIND_OPTIONS), kind),
      'en ' + employmentStatusText,
      getOptionName(localizeOptions(t, PROJECT_PASSIONATE_OPTIONS), passionateLevel),
      t('Diplôme suffisant\u00A0: ') + trainingFulfillmentStatus,
      t('Expérience\u00A0: ') + getSeniorityText(t, seniority),
      getOptionName(
        localizeOptions(t, PROJECT_EXPERIENCE_OPTIONS), previousJobSimilarity),
      t('Mobilité\u00A0: ') + getOptionName(
        localizeOptions(t, PROJECT_LOCATION_AREA_TYPE_OPTIONS), areaType),
      t('Réseau\u00A0: ') + replaceFalseValue(networkEstimate, 'inconnu'),
    ]
  }, [profile, project, t])

  const totalFrustrations = useMemo((): readonly React.ReactNode[] => {
    const frustrations = getUserFrustrationTags(profile, t) || []
    return [...frustrations, ...(profile.customFrustrations || [])]
  }, [profile, t])

  const json = useMemo((): string => {
    // TODO(sil): Use a helper function instead of this manual approach.
    const remainingData = {
      ...userData,
      profile: profile && cleanProfile(profile),
      projects: userData?.projects?.map(cleanProject),
    }
    return JSON.stringify(remainingData, null, 2).replace(/[",[\]{}]/g, '')
  }, [profile, userData])

  const dispatch = useDispatch<DispatchAllEvalActions>()
  const [userExample, setUserExample] = useState(encodeURIComponent(JSON.stringify(userData)))
  useAsynceffect(async (checkIfCanceled: () => boolean): Promise<void> => {
    setUserExample(userData ? encodeURIComponent(JSON.stringify(userData)) : '')
    if (!userData) {
      return
    }
    const userDataAsProtoString = await dispatch(convertToProto('user', userData))
    if (userDataAsProtoString && !checkIfCanceled()) {
      setUserExample(userDataAsProtoString)
    }
  }, [dispatch, userData])
  const createSimilarAccountUrl = Routes.ROOT + '?userExample=' + userExample

  // TODO(cyrille): Maybe add a link to direct email if not a guest.
  return <div style={boxStyle}>
    {hasAccount ? null : <div style={{textAlign: 'right'}}>
      <div style={guestStyle}>Guest</div>
    </div>}
    <Section title={t('Profil')} elements={profileElements} />
    <Section title={t('Projet')} elements={projectElements} />
    <Section title={t('Recherche')} elements={researchElements} />
    <Section title={t('Frustrations')} elements={totalFrustrations} />
    <div style={{textAlign: 'center'}}>
      <ExternalLink href={createSimilarAccountUrl}>
        <Button type="back">{t('Créer un compte similaire')}</Button>
      </ExternalLink>
    </div>
    <Textarea value={json} readOnly={true} style={textareaStyle} />
  </div>
}
UseCase.propTypes = {
  t: PropTypes.func.isRequired,
  useCase: PropTypes.shape({
    userData: PropTypes.shape({
      projects: PropTypes.arrayOf(PropTypes.shape({
        projectId: PropTypes.string,
      }).isRequired),
      registeredAt: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
}


export default React.memo(UseCase)
