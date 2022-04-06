import React, {useMemo} from 'react'

import {VaeHelpContent, getTips} from 'deployment/vae'
import Picto from 'images/advices/picto-vae.svg'

import type {CardProps} from './base'
import {ActionWithHandyLink, MethodSuggestionList} from './base'


const VAEMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, project = {}, t} = props
  const {targetJob: {jobGroup: {romeId = ''} = {}} = {}} = project
  const handleClick = useMemo(() => handleExplore('vae tip'), [handleExplore])
  const tips = getTips(romeId, t)

  if (!tips.length) {
    return <VaeHelpContent handleExplore={handleExplore} />
  }
  // TODO(cyrille): Try to scrape relevant VAE from Avril.
  return <MethodSuggestionList
    title={t("Validation des Acquis de l'Expérience (VAE)")}
    isNotClickable={true}
    subtitle={t(
      'Valorisez les compétences que vous avez acquises au fil des années au même titre que si ' +
      'vous les aviez acquises par une formation équivalente.')}>
    {tips.map(({content, intro, name, url}, index): ReactStylableElement =>
      <ActionWithHandyLink
        key={index} discoverUrl={url} linkIntro={intro} linkName={name}
        onClick={handleClick}>
        {content}
      </ActionWithHandyLink>)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(VAEMethod)


export default {ExpandedAdviceCardContent, Picto}
