import type {TFunction} from 'i18next'
import _keyBy from 'lodash/keyBy'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import type {DispatchAllActions, RootState} from 'store/actions'
import {getJobs} from 'store/actions'
import {genderizeJob, getJobSearchURL} from 'store/job'
import isMobileVersion from 'store/mobile'

import DataSource from 'components/data_source'
import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import PercentBar from 'components/percent_bar'
import {RadiumExternalLink} from 'components/radium'

import type {CardProps} from './base'
import {HandicapSuggestionWarning, MethodSuggestionList} from './base'


interface WeightedJobProps {
  gender?: bayes.bob.Gender
  isBetterThanTarget?: boolean
  isTargetJob?: boolean
  job: bayes.bob.Job
  maxWeight: number
  onClick: () => void
  style?: React.CSSProperties
  t: TFunction
  weight?: number
}


const rangeStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  borderRadius: 3,
  flex: 'none',
  height: 22,
  position: 'relative',
  width: 200,
}


const WeightedJobBase = (props: WeightedJobProps): React.ReactElement => {
  const {gender, job, weight, style, maxWeight, onClick, isTargetJob, isBetterThanTarget, t} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])
  const jobNameStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      color: colors.BOB_BLUE,
    },
    'cursor': 'pointer',
    'fontSize': 13,
    'fontWeight': isTargetJob ? 'bold' : 'initial',
    'paddingLeft': 20,
    'paddingRight': 20,
  }), [isTargetJob])
  const progressStyle: React.CSSProperties = {
    backgroundColor: isBetterThanTarget ? colors.GREENISH_TEAL : colors.SLATE,
    borderRadius: 3,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: `${100 * (weight || 0) / maxWeight}%`,
  }
  const offersCountStyle = useMemo((): React.CSSProperties => ({
    color: isBetterThanTarget ? colors.GREENISH_TEAL : colors.COOL_GREY,
    fontSize: 13,
    fontWeight: 500,
    marginRight: isMobileVersion ? 10 : 15,
  }), [isBetterThanTarget])
  const barColor = isBetterThanTarget ? colors.GREENISH_TEAL : colors.SLATE
  const percent = 100 * (weight || 0) / maxWeight
  return <RadiumExternalLink
    href={getJobSearchURL(t, job, gender)} style={containerStyle} onClick={onClick}>
    <span style={jobNameStyle}>
      {genderizeJob(job, gender)}
      {isTargetJob ? ` (${t('vous')})` : ''}
    </span>
    <span style={{flex: 1}} />
    {weight ? <span style={{alignItems: 'center', display: 'flex'}}>
      <Trans style={offersCountStyle} t={t}>
        {{percent: Math.round(weight * 100)}}% des offres
      </Trans>

      {isMobileVersion ? <PercentBar
        color={barColor} percent={percent} height={10}
        style={{flexShrink: 0, margin: 'auto 0', width: 47}} isPercentShown={false} /> :
        <div style={rangeStyle}>
          <div style={progressStyle} />
        </div>}
    </span> : null}
  </RadiumExternalLink>
}
const WeightedJob = React.memo(WeightedJobBase)


function hasRomeId(jobGroup?: bayes.bob.JobGroup): jobGroup is {romeId: string} {
  return !!jobGroup?.romeId
}


const showMoreButtonStyle = {
  color: 'inherit',
  fontWeight: 500,
  justifyContent: 'center',
  width: '100%',
}


interface WeightedJobState {
  job: bayes.bob.Job
  weight: number
}


const BetterJobInGroup = (props: CardProps): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const {handleExplore, profile: {gender, hasHandicap}, project: {targetJob}, t} = props
  const {codeOgr = '', jobGroup = {}} = targetJob || {}
  const {romeId} = jobGroup
  const jobGroupInfo = useSelector(({app}: RootState): bayes.bob.JobGroup|undefined =>
    app.specificJobs && romeId && app.specificJobs[romeId] || undefined)
  const [areAllJobsShown, setAreAllJobsShown] = useState(false)
  const weightedJobs = useMemo((): readonly WeightedJobState[] => {
    if (!jobGroupInfo) {
      return []
    }
    const {jobs, requirements = {}} = jobGroupInfo
    const weights = _keyBy(requirements.specificJobs || [], 'codeOgr')
    const weightedJobs = (jobs || []).map((job): WeightedJobState => {
      const weight = job.codeOgr && weights[job.codeOgr]
      return {
        job,
        weight: weight && weight.percentSuggested && weight.percentSuggested / 100 || 0,
      }
    }).sort((jobA, jobB): number => jobB.weight - jobA.weight)
    return weightedJobs
  }, [jobGroupInfo])

  useEffect((): void => {
    if (!jobGroupInfo && hasRomeId(jobGroup)) {
      dispatch(getJobs(jobGroup))
    }
  }, [dispatch, jobGroupInfo, jobGroup])

  const showAllJobs = useCallback((): void => setAreAllJobsShown(true), [])

  const showMoreButton: ReactStylableElement|null = areAllJobsShown ? null : <button
    key="show-more" style={showMoreButtonStyle} onClick={showAllJobs} type="button">
    <Trans parent="span" style={{fontSize: 13}} t={t}>
      Voir tous les métiers
    </Trans>
    <ChevronDownIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
  </button>

  const targetJobIndex = weightedJobs.
    findIndex(({job}: WeightedJobState): boolean => job?.codeOgr === codeOgr)
  const maxWeight = Math.min((weightedJobs[0]?.weight || 1) + .1, 1)
  const title = <Trans parent={null} t={t} count={targetJobIndex}>
    <GrowingNumber number={targetJobIndex} /> métier avec plus d'offres d'emploi
  </Trans>
  const subtitle = t(
    "Répartition des offres d'emploi pour {{count}} métier du groupe {{jobGroupName}}",
    {count: weightedJobs.length, jobGroupName: jobGroup.name},
  ) + '*'
  const footer = <DataSource style={{margin: 0}}>
    ROME <ExternalLink
      href={`https://candidat.pole-emploi.fr/marche-du-travail/fichemetierrome?codeRome=${romeId}`}
      style={{color: colors.COOL_GREY}}>{romeId}</ExternalLink> / Pôle emploi
  </DataSource>
  const shownJobs = areAllJobsShown ? weightedJobs :
    weightedJobs.slice(0, (targetJobIndex + 1) || 10)
  return <React.Fragment>
    <MethodSuggestionList title={title} subtitle={subtitle} footer={footer}>
      {[...shownJobs.map(({job, weight}: WeightedJobState, index): ReactStylableElement|null =>
        <WeightedJob
          isTargetJob={index === targetJobIndex}
          isBetterThanTarget={index < targetJobIndex} key={job.codeOgr}
          onClick={handleExplore('job')}
          {...{gender, job, maxWeight, t, weight}} />), showMoreButton]}
    </MethodSuggestionList>
    <HandicapSuggestionWarning hasHandicap={!!hasHandicap} />
  </React.Fragment>
}
const ExpandedAdviceCardContent = React.memo(BetterJobInGroup)


export default {ExpandedAdviceCardContent, pictoName: 'magnifyingGlass' as const}
