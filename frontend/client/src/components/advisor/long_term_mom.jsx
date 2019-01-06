import PropTypes from 'prop-types'
import React from 'react'

import {AppearingList} from 'components/theme'
import Picto from 'images/advices/picto-long-term-mom.png'

import {Skill} from './base'

const momSkills = [
  {
    assets: ['TIME_TO_MARKET', 'BREADTH_OF_JOBS'],
    description: userYou =>
      `Organisée, ${userYou('tu sais', 'vous savez')} gérer des agendas complexes.`,
    name: 'Organisation',
  },
  {
    assets: ['JOB_SATISFACTION'],
    description: userYou =>
      `Empathique, ${userYou('tu sais adapter ton', 'vous savez adapter votre')} argumentation en
      fonction des situations et faire preuve de tact.`,
    name: 'Empathie',
  },
  {
    assets: ['BETTER_INCOME', 'JOB_SATISFACTION'],
    description: userYou =>
      `Diplomate, ${userYou('tu sais', 'vous savez')} résoudre des conflits et faire preuve de bon
      sens dans des situations nouvelles.`,
    name: 'Diplomatie',
  },
  {
    assets: ['TIME_TO_MARKET', 'BREADTH_OF_JOBS'],
    description: userYou =>
      `Flexible, ${userYou('tu sais', 'vous savez')} gérer des imprévus
      et ${userYou("tu sauras t'", 'vous saurez vous ')}adapter à l'esprit d'une nouvelle
      entreprise.`,
    name: 'Flexibilité',
  },
]


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {onExplore, userYou} = this.props
    return <div>
      {userYou("Tu t'", 'Vous vous êt')}es un peu éloignée du monde de l'emploi, rien de plus
      normal. Pourtant, {userYou('tu as', 'vous avez')} continué de
      développer {userYou('tes', 'vos')} talents pendant un des plus grands défis de la vie&nbsp;:
      la parentalité 💪🏽

      Pour {userYou('te', 'vous')} réinventer dans cette nouvelle étape professionnelle, <strong>
        valorise{userYou(' ton', 'z votre')} expérience de parent
        dans {userYou('tes', 'vos')} candidatures
      </strong>. En voici quelques idées&nbsp;:
      <AppearingList style={{marginTop: 20}}>
        {momSkills.map(content =>
          <Skill
            {...{onExplore, userYou, ...content}} key={content.name} style={{marginTop: -1}}
            description={content.description(userYou)} />)}
      </AppearingList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
