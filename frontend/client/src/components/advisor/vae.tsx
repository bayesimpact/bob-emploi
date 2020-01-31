import React, {useMemo} from 'react'
import PropTypes from 'prop-types'

import Picto from 'images/advices/picto-vae.svg'

import {ActionWithHandyLink, CardProps, MethodSuggestionList} from './base'


const makeAvrilLink = (romeId: string): string => {
  return `https://avril.pole-emploi.fr/diplomes?rome_code=${romeId}&utm_source=bob`
}
const VAEMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, project = {}, t} = props
  const {targetJob: {jobGroup: {romeId = ''} = {}} = {}} = project
  const handleClick = useMemo(() => handleExplore('vae tip'), [handleExplore])
  const tips = useMemo(() => [{
    intro: t('En savoir plus\u00A0:'),
    name: 'Avril',
    text: t('Découvrir la VAE'),
    url: makeAvrilLink(romeId),
  }], [romeId, t])

  // TODO(cyrille): Try to scrape relevant VAE from Avril.
  return <MethodSuggestionList
    title={t("Validation des Acquis de l'Expérience (VAE)")}
    subtitle={t(
      'Valorisez les compétences que vous avez acquises au fil des années au même titre que si ' +
      'vous les aviez acquises par une formation équivalente.')}>
    {tips.map(({text, intro, name, url}, index): ReactStylableElement => <ActionWithHandyLink
      key={index} discoverUrl={url} linkIntro={intro} linkName={name} isNotClickable={true}
      onClick={handleClick}>
      {text}
    </ActionWithHandyLink>)}
  </MethodSuggestionList>
}
VAEMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(VAEMethod)


export default {ExpandedAdviceCardContent, Picto}
