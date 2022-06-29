import React from 'react'

import DataSource from 'components/data_source'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'

import type {CardProps} from './base'
import {MethodSuggestionList, Skill, useAdviceData} from './base'


const SkillForFuture = (props: CardProps): React.ReactElement => {
  const {handleExplore, t} = props
  const {data: {skills = []}, loading} = useAdviceData<bayes.bob.JobSkills>(props)
  const title = <React.Fragment>
    <Trans t={t} parent={null} count={skills.length}>
      <GrowingNumber number={skills.length} isSteady={true} /> compétence pour préparer l'avenir
    </Trans>*
  </React.Fragment>
  const footer = <DataSource style={{margin: 0}}>
    {t('Rapport OCDE\u00A0:')} Future of Work and Skills / 80,000 hours
  </DataSource>
  if (loading) {
    return loading
  }
  return <MethodSuggestionList
    title={title} footer={footer} isNotClickable={true}
    subtitle={t("Des clins d'œils vers les métiers de demain pour faire envie aux recruteurs")}>
    {skills.map((skill, index): ReactStylableElement => <Skill
      key={skill.name} isRecommended={!index} {...{handleExplore, ...skill}} />)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(SkillForFuture)


export default {ExpandedAdviceCardContent, pictoName: 'openLetter' as const}
