import PropTypes from 'prop-types'
import React from 'react'

import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-skill-for-future.svg'

import {CardProps, CardWithContentProps, DataSource, MethodSuggestionList, Skill,
  connectExpandedCardWithContent} from './base'


class SkillForFuture extends React.PureComponent<CardWithContentProps<bayes.bob.JobSkills>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      skills: PropTypes.arrayOf(PropTypes.shape({
        assets: PropTypes.arrayOf(PropTypes.string.isRequired),
        description: PropTypes.string.isRequired,
        discoverUrl: PropTypes.string,
        name: PropTypes.string.isRequired,
      })),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
  }

  public render(): React.ReactNode {
    const {adviceData: {skills = []}, handleExplore} = this.props
    const title = <React.Fragment>
      <GrowingNumber number={skills.length} isSteady={true} /> compétences pour préparer l'avenir*
    </React.Fragment>
    const footer = <DataSource style={{margin: 0}}>
      Rapport OCDE&nbsp;: Future of Work and Skills / 80.000 hours
    </DataSource>
    return <MethodSuggestionList
      title={title} footer={footer} isNotClickable={true}
      subtitle="Des clins d'œils vers les métiers de demain pour faire envie aux recruteurs">
      {skills.map((skill, index): ReactStylableElement => <Skill
        key={skill.name} isRecommended={!index} {...{handleExplore, ...skill}} />)}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.JobSkills, CardProps>(SkillForFuture)


export default {ExpandedAdviceCardContent, Picto}
