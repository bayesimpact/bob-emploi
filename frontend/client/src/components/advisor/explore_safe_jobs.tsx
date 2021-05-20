import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'

import useMedia from 'hooks/media'
import {getJobGroupSearchURL} from 'store/job'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-explore-other-jobs.svg'

import {CardProps, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const


const chevronStyle: React.CSSProperties = {
  fill: colors.CHARCOAL_GREY,
  height: 20,
  width: 20,
} as const


interface SuggestionProps {
  jobGroup?: bayes.bob.JobGroup
  onClick: () => void
  style?: React.CSSProperties
}


const JobGroupSuggestionBase = ({jobGroup, onClick, style}: SuggestionProps):
React.ReactElement|null => {
  const {t} = useTranslation('advisor')

  if (!jobGroup) {
    return null
  }

  return <ExternalLink style={style} href={getJobGroupSearchURL(t, jobGroup)} onClick={onClick}>
    {jobGroup.name}
    <span style={{flex: 1}} />
    <ChevronRightIcon style={chevronStyle} />
  </ExternalLink>
}
const JobGroupSuggestion = React.memo(JobGroupSuggestionBase)


const MAX_SHOWN_JOB_GROUPS = 5


const seeMoreButtonStyle: React.CSSProperties = {
  color: 'inherit',
  display: 'flex',
  fontSize: '0.8em',
  padding: 0,
  width: '100%',
} as const


const ExploreSafeJobs = (props: CardProps): React.ReactElement => {
  const {data: adviceData, loading} = useAdviceData<bayes.bob.SafeJobGroups>(props)
  const media = useMedia()
  const {handleExplore, t} = props
  const {isSafeFromAutomation, isSafeFromCovid, jobGroups = emptyArray} = adviceData

  const title = isSafeFromCovid ?
    isSafeFromAutomation ?
      <Trans t={t} parent={null} count={jobGroups.length}>
        <GrowingNumber number={jobGroups.length} /> domaine qui est peu affecté par la crise du
        coronavirus et dont les métiers ont peu de risques d'être automatisés.
      </Trans> :
      <Trans t={t} parent={null} count={jobGroups.length}>
        <GrowingNumber number={jobGroups.length} /> domaine qui est peu affecté par la crise du
        coronavirus.
      </Trans> :
    isSafeFromAutomation ?
      <Trans t={t} parent={null} count={jobGroups.length}>
        <GrowingNumber number={jobGroups.length} /> domaine dont les métiers ont peu de risques
        d'être automatisés.
      </Trans> :
      <Trans t={t} parent={null} count={jobGroups.length}>
        <GrowingNumber number={jobGroups.length} /> domaine.
      </Trans>

  const onExplore = handleExplore('job group')

  const [areAllItemsShown, setAreAllItemsShown] = useState(media === 'print')
  const moreItemsClickHandler = useCallback(() => {
    setAreAllItemsShown(true)
    handleExplore('more job groups')()
  }, [handleExplore])
  const footer = (areAllItemsShown || jobGroups.length <= MAX_SHOWN_JOB_GROUPS) ? null :
    <button onClick={moreItemsClickHandler} style={seeMoreButtonStyle}>
      <span style={{flex: 1}}>{t('Voir plus')}</span>
      <ChevronDownIcon style={chevronStyle} />
    </button>

  if (loading) {
    return loading
  }

  return <MethodSuggestionList
    title={title} footer={footer} maxNumChildren={areAllItemsShown ? 0 : MAX_SHOWN_JOB_GROUPS}>
    {jobGroups.map((jobGroup, index): React.ReactElement<SuggestionProps> => <JobGroupSuggestion
      key={index} onClick={onExplore} jobGroup={jobGroup} />)}
  </MethodSuggestionList>
}
ExploreSafeJobs.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ExploreSafeJobs)

export default {ExpandedAdviceCardContent, Picto}
