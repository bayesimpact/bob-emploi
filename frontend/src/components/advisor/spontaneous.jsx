import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'

import {genderizeJob} from 'store/job'
import {lowerFirstLetter, ofCityPrefix, toTitleCase} from 'store/french'
import {USER_PROFILE_SHAPE} from 'store/user'

import laBonneBoiteImage from 'images/labonneboite-picto.png'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import {Colors, Icon, PaddedOnMobile, StringJoiner, Styles} from 'components/theme'

import {AdviceSuggestionList, ToolCard} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {advice, project} = this.props
    const {companies} = advice.spontaneousApplicationData || {}
    if (companies && companies.length) {
      const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)
      const companiesMap = {}
      const companyNames = companies.map(({name}) => toTitleCase(name)).filter(name => {
        if (companiesMap[name]) {
          return false
        }
        companiesMap[name] = true
        return true
      })
      return <div style={{fontSize: 30}}>
        Des entreprises près {prefix}<strong>{cityName}</strong> comme{' '}
        <StringJoiner>
          {companyNames.map((name, index) => <strong key={`company-${index}`}>
            {name}
          </strong>)}
        </StringJoiner>
        {' '}ont un fort potentiel d'embauche.
      </div>
    }
    return <div style={{fontSize: 30}}>
      Connaissez-vous <strong>La bonne boîte</strong>&nbsp;? Un site spécialisé pour
      trouver des entreprises où postuler près de chez vous.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
  }

  createLBBLink() {
    const {project} = this.props
    const {cityId} = project.mobility.city || {}
    const {romeId} = project.targetJob.jobGroup || {}
    return `https://labonneboite.pole-emploi.fr/entreprises/commune/${cityId}/rome/${romeId}?utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-rech`
  }

  renderCompanies(companies) {
    const {profile, project} = this.props
    if (!companies || !companies.length) {
      return null
    }

    const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)

    return <div>
      <PaddedOnMobile style={{fontSize: 16, marginBottom: 15}}>
        <strong>{companies.length} entreprise{companies.length > 1 ? 's' : ''}</strong> à
        fort potentiel d'embauche pour {profile.gender === 'FEMININE' ? 'une ' : 'un '}
        {lowerFirstLetter(genderizeJob(project.targetJob, profile.gender))} près {prefix}{cityName}*
      </PaddedOnMobile>
      <AdviceSuggestionList>
        {[
          ...companies.map((company, index) => <CompanyLink
            key={`company-${index}`} {...company} isNotClickable={!company.siret} />),
          <MoreCompaniesLink
            key="more" onClick={() => {
              window.open(this.createLBBLink(), '_blank')
            }}>
            Voir d'autres entreprises sur La Bonne Boîte
          </MoreCompaniesLink>,
        ]}
      </AdviceSuggestionList>
      <PaddedOnMobile
        style={{color: Colors.COOL_GREY, fontSize: 13, fontStyle: 'italic', marginTop: 15}}>
        *Source&nbsp;: La Bonne Boîte / Pôle emploi
      </PaddedOnMobile>
    </div>
  }

  render() {
    const {advice} = this.props
    const {companies} = advice.spontaneousApplicationData || {}
    const toolCardStyle = {
      maxWidth: 470,
    }
    if (companies && companies.length) {
      return this.renderCompanies(companies)
    }
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Trouver des entreprises sur&nbsp;:
        <div style={toolCardStyle}>
          <ToolCard imageSrc={laBonneBoiteImage} href={this.createLBBLink()}>
            La Bonne Boite
            <div style={{fontSize: 13, fontWeight: 'normal'}}>
              pour trouver des entreprises à fort potentiel d'embauche
            </div>
          </ToolCard>
        </div>
      </PaddedOnMobile>
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
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const starStyle = starIndex => ({
      color: starIndex < hiringPotential - 1 ? Colors.GREENISH_TEAL : Colors.PINKISH_GREY,
      fontSize: 20,
    })
    return <span style={{alignItems: 'center', display: 'flex'}}>
      <span style={titleStyle}>
        Potentiel d'embauche&nbsp;:
      </span>
      {new Array(3).fill(null).map((unused, index) =>
        <Icon name="star" style={starStyle(index)} key={`star-${index}`} />)}
    </span>
  }

  render() {
    const {cityName, siret, name, style} = this.props
    const containerStyle = {
      ...style,
      fontWeight: 'normal',
    }
    const chevronStyle = {
      fontSize: 25,
      lineHeight: 1,
      opacity: siret ? 1 : 0,
      padding: '0 10px',
    }
    return <div style={containerStyle} onClick={siret ? this.open : null}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>{toTitleCase(name)}</strong>
      {cityName ? <span style={{paddingLeft: '.3em', ...Styles.CENTER_FONT_VERTICALLY}}>
        - {toTitleCase(cityName)}
      </span> : null}
      <span style={{flex: 1}} />
      {this.renderStars()}
      <Icon name="chevron-right" style={chevronStyle} />
    </div>
  }
}
const CompanyLink = Radium(CompanyLinkBase)


class MoreCompaniesLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const containerStyle = {
      padding: '0 0 0 20px',
      ...style,
    }
    const chevronStyle = {
      fontSize: 25,
      lineHeight: 1,
      padding: '0 10px',
    }
    return <div style={containerStyle} {...extraProps}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>
        {children}
      </strong>
      <span style={{flex: 1}} />
      <img src={poleEmploiImage} style={{height: 35}} alt="Pôle emploi" />
      <Icon name="chevron-right" style={chevronStyle} />
    </div>
  }
}
const MoreCompaniesLink = Radium(MoreCompaniesLinkBase)


export default {AdviceCard, ExpandedAdviceCardContent}
