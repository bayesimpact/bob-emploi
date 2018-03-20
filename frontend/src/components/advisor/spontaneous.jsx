import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {genderizeJob} from 'store/job'
import {lowerFirstLetter, ofPrefix, toTitleCase} from 'store/french'
import {USER_PROFILE_SHAPE} from 'store/user'

import {Colors, PaddedOnMobile, StringJoiner, Styles} from 'components/theme'
import laBonneBoiteImage from 'images/labonneboite-picto.png'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import Picto from 'images/advices/picto-spontaneous-application.png'

import {AdviceSuggestionList, DataSource, ToolCard} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    fontSize: PropTypes.number.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice, fontSize, project, userYou} = this.props
    const {companies} = advice.spontaneousApplicationData || {}
    if (companies && companies.length) {
      const {modifiedName: cityName, prefix} = ofPrefix(project.mobility.city.name)
      const companiesMap = {}
      const companyNames = companies.map(({name}) => toTitleCase(name)).filter(name => {
        if (companiesMap[name]) {
          return false
        }
        companiesMap[name] = true
        return true
      })
      return <div style={{fontSize: fontSize}}>
        Des entreprises près {prefix}<strong>{cityName}</strong> comme{' '}
        <StringJoiner>
          {companyNames.map((name, index) => <strong key={`company-${index}`}>
            {name}
          </strong>)}
        </StringJoiner>
        {' '}ont un fort potentiel d'embauche.
      </div>
    }
    return <div style={{fontSize: fontSize}}>
      Connais{userYou('-tu', 'sez-vous')} <strong>La bonne boîte</strong>&nbsp;? Un site spécialisé
      pour trouver des entreprises où postuler près de chez {userYou('toi', 'vous')}.
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

    const {modifiedName: cityName, prefix} = ofPrefix(project.mobility.city.name)

    return <div>
      <PaddedOnMobile style={{fontSize: 16, marginBottom: 15}}>
        <strong>{companies.length} entreprise{companies.length > 1 ? 's' : ''}</strong> à
        fort potentiel d'embauche pour {profile.gender === 'FEMININE' ? 'une ' : 'un '}
        {lowerFirstLetter(genderizeJob(project.targetJob, profile.gender))} près {prefix}{cityName}
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
      <DataSource>
        La Bonne Boîte / Pôle emploi
      </DataSource>
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
      fill: starIndex < hiringPotential - 1 ? Colors.GREENISH_TEAL : Colors.PINKISH_GREY,
      height: 20,
      width: 20,
    })
    return <span style={{alignItems: 'center', display: 'flex'}}>
      <span style={titleStyle}>
        Potentiel d'embauche&nbsp;:
      </span>
      {new Array(3).fill(null).map((unused, index) =>
        <StarIcon style={starStyle(index)} key={`star-${index}`} />)}
    </span>
  }

  render() {
    const {cityName, siret, name, style} = this.props
    const containerStyle = {
      ...style,
      fontWeight: 'normal',
    }
    const chevronStyle = {
      fill: Colors.CHARCOAL_GREY,
      flexShrink: 0,
      height: 25,
      opacity: siret ? 1 : 0,
      padding: '0 10px',
      width: 45,
    }
    return <div style={containerStyle} onClick={siret ? this.open : null}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>{toTitleCase(name)}</strong>
      {cityName ? <span style={{paddingLeft: '.3em', ...Styles.CENTER_FONT_VERTICALLY}}>
        - {toTitleCase(cityName)}
      </span> : null}
      <span style={{flex: 1}} />
      {this.renderStars()}
      <ChevronRightIcon style={chevronStyle} />
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
    const chevronStyle = {
      fill: Colors.CHARCOAL_GREY,
      height: 25,
      lineHeight: 1,
      padding: '0 10px',
      width: 45,
    }
    return <div style={style} {...extraProps}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>
        {children}
      </strong>
      <span style={{flex: 1}} />
      <img src={poleEmploiImage} style={{height: 35}} alt="Pôle emploi" />
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const MoreCompaniesLink = Radium(MoreCompaniesLinkBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
