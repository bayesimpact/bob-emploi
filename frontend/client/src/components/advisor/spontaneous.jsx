import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {genderizeJob} from 'store/job'
import {lowerFirstLetter, ofPrefix, toTitleCase} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import laBonneBoiteImage from 'images/labonneboite-picto.png'
import laBonneAlternanceImage from 'images/labonnealternance-picto.svg'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import Picto from 'images/advices/picto-spontaneous-application.png'

import {AdviceSuggestionList, DataSource, ToolCard, connectExpandedCardWithContent} from './base'


const utmTrackingQuery = '?utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-rech'

class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      alternanceCompanies: PropTypes.array,
      companies: PropTypes.array,
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }),
      targetJob: PropTypes.shape({
        jobGroup: PropTypes.shape({
          romeId: PropTypes.string,
        }),
      }),
    }).isRequired,
  }

  createLink(isForAlternance) {
    const {project: {
      city: {cityId = ''} = {},
      targetJob: {jobGroup: {romeId = ''} = {}} = {},
    }} = this.props
    const baseUrl = isForAlternance ? 'https://labonnealternance.pole-emploi.fr/' :
      'https://labonneboite.pole-emploi.fr/'
    return `${baseUrl}entreprises/commune/${cityId}/rome/${romeId}${utmTrackingQuery}`
  }

  renderCompanies(companies, isForAlternance) {
    const {onExplore, profile: {gender}, project: {
      city: {name = ''} = {},
      targetJob,
    }} = this.props
    if (!companies || !companies.length) {
      return null
    }

    const {modifiedName: cityName, prefix} = ofPrefix(name)
    const {jobGroup: {romeId = ''} = {}} = targetJob

    const moreLink = this.createLink(isForAlternance)
    const appTitle = `La Bonne ${isForAlternance ? 'Alternance' : 'Boîte'}`

    return <React.Fragment>
      <div style={{fontSize: 16, marginBottom: 15}}>
        <strong>{companies.length} entreprise{companies.length > 1 ? 's' : ''}</strong> à
        fort potentiel d'embauche pour {gender === 'FEMININE' ? 'une ' : 'un '}
        {lowerFirstLetter(genderizeJob(targetJob, gender))}
        {isForAlternance ? ' en alternance' : ''} près {prefix}{cityName}
      </div>
      <AdviceSuggestionList>
        {[
          ...companies.map((company, index) => <CompanyLink
            key={`company-${index}`} {...company}
            {...{isForAlternance, romeId}}
            onClick={() => onExplore(isForAlternance ? 'alternance' : 'company')}
            isNotClickable={!company.siret} />),
          <MoreCompaniesLink
            key="more" onClick={() => {
              onExplore(`more ${isForAlternance ? 'alternances' : 'companies'}`)
              window.open(moreLink, '_blank')
            }}>
            Voir d'autres entreprises sur {appTitle}
          </MoreCompaniesLink>,
        ]}
      </AdviceSuggestionList>
      <DataSource>
        {appTitle} / Pôle emploi
      </DataSource>
    </React.Fragment>
  }

  render() {
    const {
      adviceData: {alternanceCompanies, companies},
      project: {employmentTypes = []},
    } = this.props
    const isLookingForAlternance = employmentTypes.indexOf('ALTERNANCE') >= 0
    const isOnlyLookingForAlternance = isLookingForAlternance && employmentTypes.length === 1
    const toolCardStyle = {
      maxWidth: 470,
    }
    const usefulCompanies = !isOnlyLookingForAlternance && companies || []
    const usefulAlternanceCompanies = isLookingForAlternance && alternanceCompanies || []
    if (usefulCompanies.length || usefulAlternanceCompanies.length) {
      return <React.Fragment>
        {this.renderCompanies(usefulCompanies)}
        {this.renderCompanies(usefulAlternanceCompanies, true)}
      </React.Fragment>
    }
    return <div>
      Trouver des entreprises {isOnlyLookingForAlternance ? 'qui recrutent en alternance ' : ' '}
      sur&nbsp;:

      {isOnlyLookingForAlternance ? null : <ToolCard
        imageSrc={laBonneBoiteImage} href={this.createLink()} style={toolCardStyle}>
        La Bonne Boite
        <div style={{fontSize: 13, fontWeight: 'normal'}}>
          pour trouver des entreprises à fort potentiel d'embauche
        </div>
      </ToolCard>}
      {isLookingForAlternance ? <ToolCard
        imageSrc={laBonneAlternanceImage} href={this.createLink(true)} style={toolCardStyle}>
        La Bonne Alternance
        <div style={{fontSize: 13, fontWeight: 'normal'}}>
          pour trouver des entreprises qui embauchent en alternance
        </div>
      </ToolCard> : null}
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class CompanyLinkBase extends React.Component {
  static propTypes = {
    cityName: PropTypes.string,
    hiringPotential: PropTypes.number,
    isForAlternance: PropTypes.bool,
    name: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    romeId: PropTypes.string.isRequired,
    siret: PropTypes.string,
    style: PropTypes.object,
  }

  createLBBUrl(siret, tracking) {
    return `https://labonneboite.pole-emploi.fr/${siret}/details?${tracking}`
  }

  createLBAUrl(siret, tracking) {
    const {romeId} = this.props
    const baseUrl = 'https://labonnealternance.pole-emploi.fr/details-entreprises/'
    return `${baseUrl}${siret}?${tracking}&rome=${romeId}`
  }

  open = () => {
    const {isForAlternance, onClick, siret} = this.props
    const tracking = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-ent'
    const url = isForAlternance ? this.createLBAUrl(siret, tracking) :
      this.createLBBUrl(siret, tracking)
    window.open(url, '_blank')
    onClick && onClick()
  }

  renderStars() {
    const {hiringPotential} = this.props
    if (!hiringPotential) {
      return null
    }
    const titleStyle = {
      color: colors.COOL_GREY,
    }
    const starStyle = starIndex => ({
      fill: starIndex < hiringPotential - 1 ? colors.GREENISH_TEAL : colors.PINKISH_GREY,
      height: 20,
      width: 20,
    })
    return <span style={{alignItems: 'center', display: 'flex'}}>
      {isMobileVersion ? null : <span style={titleStyle}>
        Potentiel d'embauche&nbsp;:
      </span>}
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
    if (isMobileVersion) {
      containerStyle.paddingRight = 0
    }
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
      flexShrink: 0,
      height: 25,
      opacity: siret ? 1 : 0,
      padding: '0 10px',
      width: 45,
    }
    return <div style={containerStyle} onClick={siret ? this.open : null}>
      <strong>{toTitleCase(name)}</strong>
      {cityName && !isMobileVersion ?
        <span style={{paddingLeft: '.3em'}}>
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
      fill: colors.CHARCOAL_GREY,
      flexShrink: 0,
      height: 25,
      lineHeight: 1,
      padding: '0 10px',
      width: 45,
    }
    const containerStyle = isMobileVersion ? {...style, paddingRight: 0} : style
    return <div style={containerStyle} {...extraProps}>
      <strong>
        {children}
      </strong>
      <span style={{flex: 1}} />
      <img src={poleEmploiImage} style={{height: 35}} alt="Pôle emploi" />
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const MoreCompaniesLink = Radium(MoreCompaniesLinkBase)


export default {ExpandedAdviceCardContent, Picto}
