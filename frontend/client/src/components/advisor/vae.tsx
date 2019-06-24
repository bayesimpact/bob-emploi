import React from 'react'
import PropTypes from 'prop-types'

import NewPicto from 'images/advices/picto-vae.svg'

import {ActionWithHandyLink, CardProps, MethodSuggestionList} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    handleExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }


  private makeAvrilLink(): string {
    const {project: {targetJob: {jobGroup: {romeId}}}} = this.props
    return `https://avril.pole-emploi.fr/diplomes?rome_code=${romeId}&utm_source=bob`
  }

  public render(): React.ReactNode {
    const {handleExplore, userYou} = this.props
    const tips = [{
      intro: 'En savoir plus\u00A0:',
      name: 'Avril',
      text: 'Découvrir la VAE',
      url: this.makeAvrilLink(),
    }]

    // TODO(cyrille): Try to scrape relevant VAE from Avril.
    return <MethodSuggestionList
      title="Validation des Acquis de l'Expérience (VAE)"
      subtitle={`Valorise${userYou('', 'z')} les compétences que ${userYou('tu as ', 'vous avez ')}
        acquises au fil des années au même titre que si
        ${userYou(' tu les avais', ' vous les aviez')} acquises par une formation équivalente.`}>
      {tips.map(({text, intro, name, url}, index): ReactStylableElement => <ActionWithHandyLink
        key={index} discoverUrl={url} linkIntro={intro} linkName={name} isNotClickable={true}
        onClick={handleExplore('vae tip')}>
        {text}
      </ActionWithHandyLink>)}
    </MethodSuggestionList>
  }
}


const TakeAway = 'Démarche à suivre'


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
