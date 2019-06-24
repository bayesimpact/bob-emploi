import _memoize from 'lodash/memoize'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {genderizeJob} from 'store/job'
import {lowerFirstLetter, maybeContract, ofPrefix, toTitleCase} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import {ExternalLink, GrowingNumber} from 'components/theme'
import laBonneBoiteImage from 'images/labonneboite-picto.png'
import laBonneAlternanceImage from 'images/labonnealternance-picto.svg'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import NewPicto from 'images/advices/picto-spontaneous-application.svg'

import {MethodSuggestionList, CardProps, CardWithContentProps, ToolCard,
  connectExpandedCardWithContent} from './base'


const utmTrackingQuery = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-rech&'

class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.SpontaneousApplicationData>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      alternanceCompanies: PropTypes.array,
      companies: PropTypes.array,
      maxDistanceToAlternanceCompaniesKm: PropTypes.number,
      maxDistanceToCompaniesKm: PropTypes.number,
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
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
    strategyId: PropTypes.string,
  }

  private handleExploreMore = _memoize((isForAlternance: boolean): (() => void) => (): void => {
    this.props.handleExplore(`more ${isForAlternance ? 'alternances' : 'companies'}`)()
  })

  private createLink(maxDistanceToCompaniesKm: number, isForAlternance?: boolean): string {
    const {project: {
      city: {cityId = ''} = {},
      targetJob: {jobGroup: {romeId = ''} = {}} = {},
    }} = this.props
    const baseUrl = isForAlternance ? 'https://labonnealternance.pole-emploi.fr/' :
      'https://labonneboite.pole-emploi.fr/'
    const distanceParam = maxDistanceToCompaniesKm ? `d=${maxDistanceToCompaniesKm}&` : ''
    return `${baseUrl}entreprises/commune` +
      `/${cityId}/rome/${romeId}?${utmTrackingQuery}${distanceParam}`
  }

  private renderCompanies(
    companies, maxDistanceToCompaniesKm: number, isForAlternance?: boolean,
    isAfterOther?: boolean): React.ReactNode {
    const {handleExplore, profile: {gender}, project: {
      city: {name = ''} = {},
      targetJob,
    }} = this.props
    if (!companies || !companies.length) {
      return null
    }

    const {modifiedName: cityName, prefix} = ofPrefix(name)
    const {jobGroup: {romeId = ''} = {}} = targetJob

    const appTitle = `La Bonne ${isForAlternance ? 'Alternance' : 'Boîte'}`

    const linkStyle = {
      color: colors.BOB_BLUE,
      textDecoration: 'none',
    }
    const title = <React.Fragment>
      <GrowingNumber isSteady={true} number={companies.length} />
      {' '}structure{companies.length > 1 ? 's ' : ' '}
      {isForAlternance && isAfterOther ? 'susceptibles de recruter en alternance' :
        'à qui envoyer une candidature spontanée'}
    </React.Fragment>
    const subtitle = isForAlternance && isAfterOther ? `
      Aujourd'hui, l'alternance est ouverte pas seulement aux jeunes, mais à toute personne
      inscrite à Pôle emploi ou bénéficiaire des minimas sociaux.
    ` : `
      Elles ont un fort potentiel d'embauche pour ${gender === 'FEMININE' ? 'une ' : 'un '}
      ${lowerFirstLetter(genderizeJob(targetJob, gender))}
      ${isForAlternance ? ' en alternance' : ''} près ${prefix}${cityName}
    `
    const footer = <React.Fragment>
      <img
        src={poleEmploiImage} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
        alt="Pôle emploi" />
      Voir d'autres entreprises sur <ExternalLink
        style={linkStyle} href={this.createLink(maxDistanceToCompaniesKm, isForAlternance)}
        onClick={this.handleExploreMore(isForAlternance)}>{appTitle}</ExternalLink>
    </React.Fragment>
    return <MethodSuggestionList
      title={title} subtitle={subtitle} footer={footer} style={isAfterOther ? {marginTop: 20} : {}}>
      {companies.map((company, index): ReactStylableElement => <CompanyLink
        key={`company-${index}`} {...company} {...{isForAlternance, romeId}}
        onClick={handleExplore(isForAlternance ? 'alternance' : 'company')}
        isNotClickable={!company.siret} />)}
    </MethodSuggestionList>
  }

  public render(): React.ReactNode {
    const {
      adviceData: {
        alternanceCompanies,
        companies,
        maxDistanceToCompaniesKm,
        maxDistanceToAlternanceCompaniesKm,
      },
      profile: {gender},
      project: {diagnostic, employmentTypes = [], targetJob},
      strategyId,
    } = this.props
    const isMissingDiploma = diagnostic && diagnostic.categoryId === 'missing-diploma'
    const isLookingForAlternance = isMissingDiploma ?
      strategyId === 'get-alternance' :
      employmentTypes.includes('ALTERNANCE')
    const isOnlyLookingForAlternance = isMissingDiploma ?
      strategyId === 'get-alternance' :
      isLookingForAlternance && employmentTypes.length === 1
    const usefulCompanies = !isOnlyLookingForAlternance && companies || []
    const usefulAlternanceCompanies = isLookingForAlternance && alternanceCompanies || []
    if (usefulCompanies.length || usefulAlternanceCompanies.length) {
      return <React.Fragment>
        {this.renderCompanies(usefulCompanies, maxDistanceToCompaniesKm)}
        {this.renderCompanies(
          usefulAlternanceCompanies, maxDistanceToAlternanceCompaniesKm, true,
          !!usefulCompanies.length)}
      </React.Fragment>
    }
    const title = `
      Trouver des entreprises ${isOnlyLookingForAlternance ? 'qui recrutent en alternance' : ''}`
    const jobName = lowerFirstLetter(genderizeJob(targetJob, gender))
    const subtitle = `
      Faire des candidatures spontanées est un des meilleurs moyens de trouver
      un poste ${maybeContract('de ', "d'", jobName)}${jobName}`
    return <MethodSuggestionList title={title} subtitle={subtitle}>
      {isOnlyLookingForAlternance ? null : <ToolCard
        imageSrc={laBonneBoiteImage} href={this.createLink(maxDistanceToCompaniesKm)}>
        La Bonne Boite
        <div style={{fontSize: 13, fontWeight: 'normal'}}>
          pour trouver des entreprises à fort potentiel d'embauche
        </div>
      </ToolCard>}
      {isLookingForAlternance ? <ToolCard
        imageSrc={laBonneAlternanceImage}
        href={this.createLink(maxDistanceToAlternanceCompaniesKm, true)}>
        La Bonne Alternance
        <div style={{fontSize: 13, fontWeight: 'normal'}}>
          pour trouver des entreprises qui embauchent en alternance
        </div>
      </ToolCard> : null}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.SpontaneousApplicationData, CardProps>()(
    ExpandedAdviceCardContentBase)


interface CompanyLinkProps extends bayes.bob.Company {
  isForAlternance: boolean
  isNotClickable: boolean
  onClick: () => void
  romeId: string
  style?: React.CSSProperties
}


class CompanyLinkBase extends React.PureComponent<CompanyLinkProps> {
  public static propTypes = {
    cityName: PropTypes.string,
    hiringPotential: PropTypes.number,
    isForAlternance: PropTypes.bool,
    name: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    romeId: PropTypes.string.isRequired,
    siret: PropTypes.string,
    style: PropTypes.object,
  }

  private createLBBUrl(siret, tracking): string {
    return `https://labonneboite.pole-emploi.fr/${siret}/details?${tracking}`
  }

  private createLBAUrl(siret, tracking): string {
    const {romeId} = this.props
    const baseUrl = 'https://labonnealternance.pole-emploi.fr/details-entreprises/'
    return `${baseUrl}${siret}?${tracking}&rome=${romeId}`
  }

  private open = (): void => {
    const {isForAlternance, onClick, siret} = this.props
    const tracking = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-ent'
    const url = isForAlternance ? this.createLBAUrl(siret, tracking) :
      this.createLBBUrl(siret, tracking)
    window.open(url, '_blank')
    onClick && onClick()
  }

  private renderStars(): React.ReactNode {
    const {hiringPotential} = this.props
    if (!hiringPotential) {
      return null
    }
    const titleStyle = {
      color: colors.COOL_GREY,
    }
    const starStyle = (starIndex): React.CSSProperties => ({
      fill: starIndex < hiringPotential - 1 ? colors.GREENISH_TEAL : colors.PINKISH_GREY,
      height: 20,
      width: 20,
    })
    return <span style={{alignItems: 'center', display: 'flex'}}>
      {isMobileVersion ? null : <span style={titleStyle}>
        Potentiel d'embauche&nbsp;:
      </span>}
      {new Array(3).fill(null).map((unused, index): React.ReactNode =>
        <StarIcon style={starStyle(index)} key={`star-${index}`} />)}
    </span>
  }

  public render(): React.ReactNode {
    const {cityName, siret, name, style} = this.props
    const containerStyle: React.CSSProperties = {
      ...style,
      fontWeight: 'normal',
    }
    if (isMobileVersion) {
      containerStyle.paddingRight = 0
    }
    const chevronStyle: React.CSSProperties = {
      fill: colors.CHARCOAL_GREY,
      flex: 'none',
      height: 25,
      opacity: siret ? 1 : 0,
      padding: '0 10px',
      width: 45,
    }
    return <div style={containerStyle} onClick={siret ? this.open : null}>
      <span style={{flex: 1}}><strong>{toTitleCase(name)}</strong>
        {cityName && !isMobileVersion ?
          <span style={{paddingLeft: '.3em'}}>
            - {toTitleCase(cityName)}
          </span> : null}
      </span>
      {this.renderStars()}
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const CompanyLink = Radium(CompanyLinkBase)


const TakeAway = 'Démarche à suivre'


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
