import {TOptions} from 'i18next'
import React, {useMemo} from 'react'

import {LocalizableString, prepareT} from 'store/i18n'

import {Trans} from 'components/i18n'
import Picto from 'images/advices/picto-long-term-mom.svg'

import {CardProps, MethodSuggestionList, Skill} from './base'


interface MomSkill {
  readonly assets: readonly bayes.bob.SkillAsset[]
  readonly description: LocalizableString
  readonly name: LocalizableString
}


const momSkills: readonly MomSkill[] = [
  {
    assets: ['TIME_TO_MARKET', 'BREADTH_OF_JOBS'],
    description: prepareT('Organisé·e, vous savez gérer des agendas complexes.'),
    name: prepareT('Organisation'),
  },
  {
    assets: ['JOB_SATISFACTION'],
    description: prepareT(
      'Empathique, vous savez adapter votre argumentation en fonction des situations et faire ' +
      'preuve de tact.',
    ),
    name: prepareT('Empathie'),
  },
  {
    assets: ['BETTER_INCOME', 'JOB_SATISFACTION'],
    description: prepareT(
      'Diplomate, vous savez résoudre des conflits et faire preuve de bon sens dans des ' +
      'situations nouvelles.',
    ),
    name: prepareT('Diplomatie'),
  },
  {
    assets: ['TIME_TO_MARKET', 'BREADTH_OF_JOBS'],
    description: prepareT(
      "Flexible, vous savez gérer des imprévus et vous saurez vous adapter à l'esprit d'une " +
      'nouvelle entreprise.',
    ),
    name: prepareT('Flexibilité'),
  },
] as const


const listStyle: React.CSSProperties = {marginTop: 20}


const LongTermParent: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, profile: {gender}, t, t: translate} = props
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  // TODO(cyrille): Put text in title/subtitle/headerContent, once OKed by product team.
  return <Trans t={t} tOptions={tOptions}>
    Vous vous êtes un peu éloigné·e du monde de l'emploi, rien de plus normal. Pourtant, vous avez
    continué de développer vos talents pendant un des plus grands défis de la vie&nbsp;:
    la parentalité <span aria-label={t('muscle')} role="img">💪🏽</span>{' '}

    Pour vous réinventer dans cette nouvelle étape professionnelle, <strong>
      valorisez votre expérience de parent dans vos candidatures
    </strong>. En voici quelques idées&nbsp;:
    <MethodSuggestionList style={listStyle}>
      {momSkills.map(({description, name, ...content}):
      React.ReactElement<{style?: RadiumCSSProperties}> => <Skill
        {...{handleExplore, ...content}} key={name}
        description={translate(description, tOptions)}
        name={translate(name)} />)}
    </MethodSuggestionList>
  </Trans>
}
const ExpandedAdviceCardContent = React.memo(LongTermParent)


export default {ExpandedAdviceCardContent, Picto}
