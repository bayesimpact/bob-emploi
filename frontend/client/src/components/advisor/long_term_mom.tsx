import PropTypes from 'prop-types'
import React from 'react'

import {YouChooser} from 'store/french'

import NewPicto from 'images/advices/picto-long-term-mom.svg'

import {CardProps, MethodSuggestionList, Skill, TakeAwayTemplate, WithAdvice} from './base'


interface MomSkill {
  readonly assets: bayes.bob.SkillAsset[]
  readonly description: (userYou: YouChooser) => string
  readonly name: string
}


const momSkills: MomSkill[] = [
  {
    assets: ['TIME_TO_MARKET', 'BREADTH_OF_JOBS'],
    description: (userYou): string =>
      `Organisée, ${userYou('tu sais', 'vous savez')} gérer des agendas complexes.`,
    name: 'Organisation',
  },
  {
    assets: ['JOB_SATISFACTION'],
    description: (userYou): string =>
      `Empathique, ${userYou('tu sais adapter ton', 'vous savez adapter votre')} argumentation en
      fonction des situations et faire preuve de tact.`,
    name: 'Empathie',
  },
  {
    assets: ['BETTER_INCOME', 'JOB_SATISFACTION'],
    description: (userYou): string =>
      `Diplomate, ${userYou('tu sais', 'vous savez')} résoudre des conflits et faire preuve de bon
      sens dans des situations nouvelles.`,
    name: 'Diplomatie',
  },
  {
    assets: ['TIME_TO_MARKET', 'BREADTH_OF_JOBS'],
    description: (userYou): string =>
      `Flexible, ${userYou('tu sais', 'vous savez')} gérer des imprévus
      et ${userYou("tu sauras t'", 'vous saurez vous ')}adapter à l'esprit d'une nouvelle
      entreprise.`,
    name: 'Flexibilité',
  },
]


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    handleExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {handleExplore, userYou} = this.props
    // TODO(cyrille): Put text in title/subtitle/headerContent, once OKed by product team.
    return <div>
      {userYou("Tu t'", 'Vous vous êt')}es un peu éloignée du monde de l'emploi, rien de plus
      normal. Pourtant, {userYou('tu as', 'vous avez')} continué de
      développer {userYou('tes', 'vos')} talents pendant un des plus grands défis de la vie&nbsp;:
      la parentalité 💪🏽

      Pour {userYou('te', 'vous')} réinventer dans cette nouvelle étape professionnelle, <strong>
        valorise{userYou(' ton', 'z votre')} expérience de parent
        dans {userYou('tes', 'vos')} candidatures
      </strong>. En voici quelques idées&nbsp;:
      <MethodSuggestionList style={{marginTop: 20}}>
        {momSkills.map((content): React.ReactElement<{style?: RadiumCSSProperties}> => <Skill
          {...{handleExplore, userYou, ...content}} key={content.name}
          description={content.description(userYou)} />)}
      </MethodSuggestionList>
    </div>
  }
}


class TakeAway extends React.PureComponent<WithAdvice> {
  public render(): React.ReactNode {
    return <TakeAwayTemplate found="atout" list={momSkills} />
  }
}

export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
