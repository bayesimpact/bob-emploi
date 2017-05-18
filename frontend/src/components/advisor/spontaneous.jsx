import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'

import {genderizeJob} from 'store/job'
import {lowerFirstLetter, ofCityPrefix} from 'store/french'
import {USER_PROFILE_SHAPE} from 'store/user'

import laBonneBoiteImage from 'images/labonneboite-picto.png'
import {AppearingList, Colors, GrowingNumber, Icon, PaddedOnMobile, PieChart,
  SmoothTransitions, Styles} from 'components/theme'

import {PersonalizationBoxes, ToolCard} from './base'


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const {companies} = this.props.advice.spontaneousApplicationData || {}
    if (companies) {
      return <div style={{fontSize: 30}}>
        Postulez dès maintenant chez {companies.map(({name}) => name).filter(n => n).join(', ')}…
      </div>
    }
    const strongStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 40,
    }
    return <div style={{alignItems: 'center', display: 'flex'}}>
      <div style={{flex: 1, lineHeight: '21px'}}>
        <strong style={strongStyle}><GrowingNumber number={66} isSteady={true} />%</strong> des
        employeurs recrutent via des <strong>candidatures spontanées</strong>.
      </div>
      {isMobileVersion ? null : <PieChart
          style={{color: Colors.SKY_BLUE, marginLeft: 50}} percentage={66}
          backgroundColor={Colors.MODAL_PROJECT_GREY}>
        <GrowingNumber number={66} />%
      </PieChart>}
    </div>
  }
}


const personalizations = [
  {
    filters: ['YOUNG_AGE'],
    tip: 'Montrez votre côté débrouillard et votre dynamisme',
  },
  {
    filters: ['OLD_AGE'],
    tip: profile => {
      const isFeminine = profile.gender === 'FEMININE'
      return `Montrez que vous êtes stable, expérimenté${isFeminine ? 'e' : ''}(e) et
        opérationnel${isFeminine ? 'le' : ''}`
    },
  },
  {
    filters: ['ATYPIC_PROFILE'],
    tip: `En allant au devant des recruteurs vous pouvez faire valoir vos forces
      et même celles qui ne rentrent pas exactement dans la description de poste
      classique`,
  },
  {
    filters: ['TIME_MANAGEMENT'],
    tip: `Avec les candidatures spontanées c'est vous qui donnez le tempo et vous
      ne passez pas des heures à chercher les offres postées`,
  },
  {
    filters: ['MOTIVATION'],
    tip: `Gardez en tête que l'objectif des candidatures spontanées est d'obtenir
      un premier contact pas décrocher un boulot directement`,
  },
]


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
  }

  renderCompanies(companies) {
    const {profile, project} = this.props
    if (!companies || !companies.length) {
      return null
    }

    const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)

    return <div style={{marginBottom: 50}}>
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15}}>
        <strong>{companies.length} entreprise{companies.length > 1 ? 's' : ''}</strong> à
        fort potentiel d'embauche pour {profile.gender === 'FEMININE' ? 'une ' : 'un '}
        {lowerFirstLetter(genderizeJob(project.targetJob, profile.gender))} près {prefix}{cityName}
      </PaddedOnMobile>
      <AppearingList>
        {companies.map((company, index) => <CompanyLink
            key={`company-${index}`} style={{marginTop: index ? -1 : 0}} {...company} />)}
      </AppearingList>
    </div>
  }

  render() {
    const {advice, project} = this.props
    const {companies} = advice.spontaneousApplicationData || {}
    const {cityId} = project.mobility.city || {}
    const {romeId} = project.targetJob.jobGroup || {}
    const link = `https://labonneboite.pole-emploi.fr/entreprises/commune/${cityId}/rome/${romeId}?utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-rech`
    const toolCardStyle = {
      maxWidth: 470,
    }
    return <div>
      {this.renderCompanies(companies)}

      <div>
        <PaddedOnMobile style={{fontSize: 21}}>
          {companies && companies.length ? "Voir d'autres" : 'Trouver des'} entreprises sur&nbsp;:
          <div style={toolCardStyle}>
            <ToolCard imageSrc={laBonneBoiteImage} href={link}>
              La Bonne Boite
              <div style={{fontSize: 13, fontWeight: 'normal'}}>
                pour trouver des entreprises à fort potentiel d'embauche
              </div>
            </ToolCard>
          </div>
        </PaddedOnMobile>
      </div>

      <PersonalizationBoxes
          {...this.props} style={{marginTop: 30}}
          personalizations={personalizations} />
    </div>
  }
}


class CompanyLinkBase extends React.Component {
  static propTypes = {
    cityName: PropTypes.string,
    hiringPotential: PropTypes.number,
    name: PropTypes.string.isRequired,
    siret: PropTypes.string,
    style: PropTypes.object,
  }

  open = () => {
    const {siret} = this.props
    const tracking = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-ent'
    window.open(`https://labonneboite.pole-emploi.fr/${siret}/details?${tracking}`, '_blank')
  }

  renderStars() {
    const {hiringPotential} = this.props
    if (!hiringPotential) {
      return null
    }
    const titleStyle = {
      color: Colors.COOL_GREY,
      fontWeight: 500,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const starStyle = starIndex => ({
      color: starIndex < hiringPotential - 1 ? Colors.GREENISH_TEAL : Colors.PINKISH_GREY,
    })
    return <span style={{alignItems: 'center', display: 'flex'}}>
      <span style={titleStyle}>
        Potentiel d'embauche&nbsp;:
      </span>
      <span style={{fontSize: 20}}>
        {new Array(4).fill(null).map((unused, index) =>
          <Icon name="star" style={starStyle(index)} key={`star-${index}`} />)}
      </span>
    </span>
  }

  render() {
    const {cityName, siret, name, style} = this.props
    const containerStyle = {
      ':hover': siret ? {
        background: Colors.LIGHT_GREY,
      } : {},
      alignItems: 'center',
      background: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: siret ? 'pointer' : 'initial',
      display: 'flex',
      height: 50,
      paddingLeft: 20,
      ...SmoothTransitions,
      ...style,
    }
    return <div style={containerStyle} onClick={siret ? this.open : null}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>{name}</strong>
      {cityName ? <span style={{paddingLeft: '.3em', ...Styles.CENTER_FONT_VERTICALLY}}>
        - {cityName}
      </span> : null}
      <span style={{flex: 1}} />
      {this.renderStars()}
      <Icon name="chevron-right" style={{fontSize: 25, opacity: siret ? 1 : 0, paddingRight: 10}} />
    </div>
  }
}
const CompanyLink = Radium(CompanyLinkBase)


export default {AdvicePageContent, FullAdviceCard}
