import PropTypes from 'prop-types'
import React from 'react'

import {genderize, inDepartement} from 'store/french'
import {missionLocaleUrl} from 'store/job'

import {ExternalLink, UpDownIcon, colorToAlpha} from 'components/theme'
import Picto from 'images/advices/picto-immersion.svg'

import {CardProps, CardWithContentProps, connectExpandedCardWithContent} from './base'


interface CardState {
  isContactMiloExpanded: boolean
}


class ExpandedAdviceCardContentBase extends React.PureComponent<
CardWithContentProps<bayes.bob.MissionLocaleData>, CardState> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      agenciesListLink: PropTypes.string,
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        departementName: PropTypes.string,
        departementPrefix: PropTypes.string,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isContactMiloExpanded: false,
  }

  private handleToggleExpension = (): void =>
    this.setState({isContactMiloExpanded: !this.state.isContactMiloExpanded})

  private renderMiloLink(): React.ReactNode {
    const {adviceData, handleExplore, project: {city}, userYou} = this.props
    const inYourDepartement = city && inDepartement(city)
    if (!city || !inYourDepartement) {
      return null
    }
    const url = missionLocaleUrl(adviceData, city.departementName)
    return <React.Fragment>
      Pour accéder à la <ExternalLink
        href={url} onClick={handleExplore('milo list')}>
        liste des missions Locales {inYourDepartement} clique{userYou('', 'z')} ici
      </ExternalLink>.
    </React.Fragment>
  }

  private renderContactMilo(style: React.CSSProperties): React.ReactNode {
    const {profile: {gender}, userYou} = this.props
    const {isContactMiloExpanded} = this.state
    const containerStyle = {
      backgroundColor: '#fff',
      border: `solid 1px ${colors.SILVER}`,
      padding: '0 20px',
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      cursor: 'pointer',
      display: 'flex',
      fontWeight: 500,
      minHeight: 50,
    }
    const contentStyle = {
      display: isContactMiloExpanded ? 'block' : 'none',
      margin: '10px 0',
    }
    const maybeE = genderize('.e', 'e', '', gender)
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={this.handleToggleExpension}>
        {userYou('Va', 'Allez')} rencontrer un conseiller
        <span style={{flex: 1}} />
        <UpDownIcon icon="chevron" isUp={isContactMiloExpanded} />
      </header>
      <div style={contentStyle}>
        {this.renderMiloLink()}
        <br />
        La Mission Locale {userYou("t'", 'vous ')}aidera à mettre en place
        {userYou(' ta', ' votre')} mission. (Ils pourraient aussi avoir des
        contacts dans des entreprises qui pourraient {userYou("t'", 'vous ')}accueillir 😉).
        <br />
        Pour être prêt{maybeE} avant {userYou('ton', 'votre')} rendez-vous avec un conseiller
        de la Mission Locale {userYou('tu peux', 'vous pouvez')}&nbsp;:
        <ul style={{margin: 0}}>
          <li>mettre à jour {userYou('ton', 'votre')} CV,</li>
          <li>
            faire une liste de 5 entreprises où {userYou('tu aimerais', 'vous aimeriez')} faire
            une immersion.
          </li>
        </ul>
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const {profile: {gender}, userYou} = this.props
    const maybeE = genderize('.e', 'e', '', gender)
    const highlightStyle: React.CSSProperties = {
      backgroundColor: colorToAlpha(colors.SUN_YELLOW_80, .8),
      fontWeight: 'inherit',
    }
    return <div>
      L'immersion professionnelle est un cadre qui {userYou('te', 'vous')} permet de faire
      un <strong style={highlightStyle}>mini-stage en entreprise</strong> pour
      découvrir la réalité d'un métier. L'immersion peut
      durer <strong style={highlightStyle}>entre quelques heures et 15 jours</strong>.
      Pendant l'immersion {userYou("tu n'es", "vous n'êtes")} pas
      rémunéré{maybeE} mais {userYou('tu es', 'vous êtes')} protégé{maybeE} en cas
      d'accident du travail et {userYou('tu es', 'vous êtes')} accompagné{maybeE} d'un
      tuteur ou d'une tutrice. Son rôle est à la fois de {userYou('te', 'vous')} guider et de
      faire le point sur {userYou('tes', 'vos')} compétences.

      <br /><br />

      Pour gérer le côté administratif et recevoir des conseils sur comment
      faire une immersion, contacte{userYou(' ta', 'z votre')} Mission Locale&nbsp;:
      {this.renderContactMilo({marginTop: 20})}
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.MissionLocaleData, CardProps>(
    ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
