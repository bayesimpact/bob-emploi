import {TFunction} from 'i18next'
import React from 'react'
import PropTypes from 'prop-types'

import {Trans} from 'components/i18n'
import {DataSource, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-reorient-to-close-job.svg'

import {CardProps, JobSuggestion, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const


// TODO(sil): Refactor this with reorientation-jobbing advice.
const ReorientToCloseJobs = (props: CardProps): React.ReactElement => {
  const adviceData = useAdviceData<bayes.bob.ReorientCloseJobs>(props)
  const {handleExplore, profile: {gender}, project: {city}, t} = props
  const {closeJobs = emptyArray, evolutionJobs = emptyArray} = adviceData
  const areCloseJobShown = closeJobs.length > 1
  const style = {
    marginTop: areCloseJobShown ? 20 : 0,
  }

  // TODO(cyrille): Add short sentences to explain candidates per offer.
  return <div>
    <Section
      kind="close"
      items={closeJobs}
      {...{city, gender, t}}
      onExplore={handleExplore('close job')} />
    <Section
      kind="evolution"
      items={evolutionJobs}
      {...{city, gender, style, t}}
      onExplore={handleExplore('evolution job')} />
  </div>
}
ReorientToCloseJobs.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  project: PropTypes.shape({
    city: PropTypes.object,
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ReorientToCloseJobs)


interface SectionProps {
  city?: bayes.bob.FrenchCity
  gender?: bayes.bob.Gender
  items?: readonly bayes.bob.ReorientJob[]
  kind: 'close' | 'evolution'
  onExplore: () => void
  style?: React.CSSProperties
  t: TFunction
}


const SectionBase = (props: SectionProps): React.ReactElement | null => {
  const {city, gender, items = [], kind, onExplore, t, style} = props
  if (!items.length) {
    return null
  }
  const title = kind === 'evolution' ? <Trans t={t} parent={null} count={items.length}>
    <GrowingNumber number={items.length} /> domaine qui
    demande des compétences proches que vous pouvez acquérir.
  </Trans> : <Trans t={t} parent={null} count={items.length}>
    <GrowingNumber number={items.length} /> domaine qui demande des compétences que vous avez déjà.
  </Trans>
  return <MethodSuggestionList
    style={style} title={title}
    footer={<DataSource style={{margin: 0}}>IMT 2019 / Pôle emploi</DataSource>}>
    {items.map((job, index): ReactStylableElement => <JobSuggestion
      isMethodSuggestion={true}
      key={`job-${index}`} onClick={onExplore} {...{city, gender, job}} />)}
  </MethodSuggestionList>
}
SectionBase.propTypes = {
  city: PropTypes.object,
  gender: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.object.isRequired),
  kind: PropTypes.oneOf(['close', 'evolution']).isRequired,
  onExplore: PropTypes.func.isRequired,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
}
const Section = React.memo(SectionBase)


export default {ExpandedAdviceCardContent, Picto}
