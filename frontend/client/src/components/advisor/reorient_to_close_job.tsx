import React from 'react'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'

import type {CardProps} from './base'
import {JobSuggestion, useAdviceData, ReorientSection} from './base'


const emptyArray = [] as const
type JobSuggestionProps = React.ComponentProps<typeof JobSuggestion>

const getSectionItems = (
  items: readonly bayes.bob.ReorientJob[], city: bayes.bob.FrenchCity|undefined,
  gender: bayes.bob.Gender|undefined,
  onExplore: () => void): React.ReactElement<JobSuggestionProps>[] => items.map(
  (job, index): React.ReactElement<JobSuggestionProps> => <JobSuggestion
    key={`job-${index}`} onClick={onExplore} {...{city, gender, job}} />)

const ReorientToCloseJobs = (props: CardProps): React.ReactElement => {
  const {data: adviceData, loading} = useAdviceData<bayes.bob.ReorientCloseJobs>(props)
  const {handleExplore, profile, profile: {gender}, project: {city}, t} = props
  const {closeJobs = emptyArray, evolutionJobs = emptyArray} = adviceData
  const areCloseJobShown = closeJobs.length > 1
  const titleEvolutionSection = <Trans t={t} parent={null} count={evolutionJobs.length}>
    <GrowingNumber number={evolutionJobs.length} /> domaine qui demande des compétences proches que
    vous pouvez acquérir.
  </Trans>
  const titleCloseSection = <Trans t={t} parent={null} count={closeJobs.length}>
    <GrowingNumber number={closeJobs.length} /> domaine qui demande des compétences
    que vous avez déjà.
  </Trans>
  const style = {
    marginTop: areCloseJobShown ? 20 : 0,
  }
  if (loading) {
    return loading
  }

  // TODO(cyrille): Add short sentences to explain candidates per offer.
  return <div>
    <ReorientSection
      title={titleCloseSection}
      items={getSectionItems(closeJobs, city, gender, handleExplore('close job'))}
      profile={profile} />
    <ReorientSection
      title={titleEvolutionSection}
      items={getSectionItems(evolutionJobs, city, gender, handleExplore('evolution job'))}
      style={style}
      profile={profile} />
  </div>
}
const ExpandedAdviceCardContent = React.memo(ReorientToCloseJobs)

export default {ExpandedAdviceCardContent, pictoName: 'jigsaw' as const}
