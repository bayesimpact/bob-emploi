import _memoize from 'lodash/memoize'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import React, {useMemo, useCallback} from 'react'

import {genderizeJob} from 'store/job'
import {lowerFirstLetter, maybeContract, ofPrefix, toTitleCase} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import {RadiumDiv} from 'components/radium'
import {ExternalLink, GrowingNumber} from 'components/theme'
import laBonneBoiteImage from 'images/labonneboite-picto.png'
import laBonneAlternanceImage from 'images/labonnealternance-picto.svg'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import Picto from 'images/advices/picto-spontaneous-application.svg'

import {MethodSuggestionList, CardProps, CardWithContentProps, ToolCard,
  connectExpandedCardWithContent} from './base'


const emptyArray = [] as const


const utmTrackingQuery = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-rech&'


interface ValidCompany extends bayes.bob.Company {
  name: string
}

const createLink = (
  maxDistanceToCompaniesKm: number, isForAlternance?: boolean,
  cityId?: string, romeId?: string): string => {
  const baseUrl = isForAlternance ? 'https://labonnealternance.pole-emploi.fr/' :
    'https://labonneboite.pole-emploi.fr/'
  const distanceParam = maxDistanceToCompaniesKm ? `d=${maxDistanceToCompaniesKm}&` : ''
  return `${baseUrl}entreprises/commune` +
    `/${cityId}/rome/${romeId}?${utmTrackingQuery}${distanceParam}`
}

interface CompaniesProps {
  companies: readonly bayes.bob.Company[]
  handleExplore: (visualElement: string) => () => void
  maxDistanceToCompaniesKm: number
  isForAlternance?: boolean
  isAfterOther?: boolean
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
}

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const CompaniesBase: React.FC<CompaniesProps> =
(props: CompaniesProps): React.ReactElement|null => {
  const {companies, handleExplore, isForAlternance, isAfterOther, maxDistanceToCompaniesKm,
    profile: {gender}, project: {
      city: {cityId = '', name = ''} = {},
      targetJob,
    }} = props
  const handleExploreMore = useCallback((isForAlternance?: boolean): (() => void) => (): void => {
    handleExplore(`more ${isForAlternance ? 'alternances' : 'companies'}`)()
  }, [handleExplore])


  const {modifiedName: cityName, prefix} = ofPrefix(name)
  const {jobGroup: {romeId = ''} = {}} = targetJob || {}

  const appTitle = `La Bonne ${isForAlternance ? 'Alternance' : 'Boîte'}`

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
  const footer = useMemo((): React.ReactElement =>
    <React.Fragment>
      <img
        src={poleEmploiImage} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
        alt="Pôle emploi" />
      Voir d'autres entreprises sur <ExternalLink
        style={linkStyle}
        href={createLink(maxDistanceToCompaniesKm, isForAlternance, cityId, romeId)}
        onClick={handleExploreMore(isForAlternance)}>{appTitle}</ExternalLink>
    </React.Fragment>,
  [appTitle, cityId, handleExploreMore, romeId, maxDistanceToCompaniesKm, isForAlternance])
  if (!companies || !companies.length) {
    return null
  }
  return <MethodSuggestionList
    title={title} subtitle={subtitle} footer={footer} style={isAfterOther ? {marginTop: 20} : {}}>
    {companies.filter((c: bayes.bob.Company): c is ValidCompany => !!c.name).
      map((company: ValidCompany, index: number): ReactStylableElement =>
        <CompanyLink
          key={`company-${index}`} {...company} {...{isForAlternance, romeId}}
          onClick={handleExplore(isForAlternance ? 'alternance' : 'company')}
          isNotClickable={!company.siret} />)}
  </MethodSuggestionList>
}
const Companies = React.memo(CompaniesBase)


const SpontaneousMethod: React.FC<CardWithContentProps<bayes.bob.SpontaneousApplicationData>> =
(props: CardWithContentProps<bayes.bob.SpontaneousApplicationData>): React.ReactElement => {
  const {
    adviceData: {
      alternanceCompanies,
      companies,
      maxDistanceToCompaniesKm = 10,
      maxDistanceToAlternanceCompaniesKm = 10,
    },
    profile: {gender},
    project: {diagnostic, employmentTypes = [], targetJob},
    strategyId,
  } = props
  const isMissingDiploma = diagnostic && diagnostic.categoryId === 'missing-diploma'
  const isLookingForAlternance = isMissingDiploma ?
    strategyId === 'get-alternance' :
    employmentTypes.includes('ALTERNANCE')
  const isOnlyLookingForAlternance = isMissingDiploma ?
    strategyId === 'get-alternance' :
    isLookingForAlternance && employmentTypes.length === 1
  const usefulCompanies = !isOnlyLookingForAlternance && companies || emptyArray
  const usefulAlternanceCompanies = isLookingForAlternance && alternanceCompanies || emptyArray
  if (usefulCompanies.length || usefulAlternanceCompanies.length) {
    return <React.Fragment>
      <Companies companies={usefulCompanies} {...{maxDistanceToCompaniesKm}} {...props} />
      <Companies
        isForAlternance={true} isAfterOther={!!usefulCompanies.length}
        maxDistanceToCompaniesKm={maxDistanceToAlternanceCompaniesKm}
        companies={usefulAlternanceCompanies} {...props} />
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
      imageSrc={laBonneBoiteImage} href={createLink(maxDistanceToCompaniesKm)}>
      La Bonne Boite
      <div style={{fontSize: 13, fontWeight: 'normal'}}>
        pour trouver des entreprises à fort potentiel d'embauche
      </div>
    </ToolCard>}
    {isLookingForAlternance ? <ToolCard
      imageSrc={laBonneAlternanceImage}
      href={createLink(maxDistanceToAlternanceCompaniesKm, true)}>
      La Bonne Alternance
      <div style={{fontSize: 13, fontWeight: 'normal'}}>
        pour trouver des entreprises qui embauchent en alternance
      </div>
    </ToolCard> : null}
  </MethodSuggestionList>
}
SpontaneousMethod.propTypes = {
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
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.SpontaneousApplicationData, CardProps>(
    React.memo(SpontaneousMethod))


const titleStyle = {
  color: colors.COOL_GREY,
}

const iconTextStyle = {
  alignItems: 'center',
  display: 'flex',
}

const getStarStyle = _memoize(
  (starIndex: number, hiringPotential: number): React.CSSProperties => ({
    fill: starIndex < hiringPotential - 1 ? colors.GREENISH_TEAL : colors.PINKISH_GREY,
    height: 20,
    width: 20,
  }),
  (starIndex: number, hiringPotential: number): string => `${starIndex}-${hiringPotential}`,
)

const StarsBase: React.FC<{hiringPotential: number}> =
  ({hiringPotential}: {hiringPotential: number}): React.ReactElement|null => {
    if (!hiringPotential) {
      return null
    }
    return <span style={iconTextStyle}>
      {isMobileVersion ? null : <span style={titleStyle}>
        Potentiel d'embauche&nbsp;:
      </span>}
      {new Array(3).fill(null).map((unused, index): React.ReactNode =>
        <StarIcon
          style={getStarStyle(index, hiringPotential)} key={`star-${index}`} />)}
    </span>
  }
StarsBase.propTypes = {
  hiringPotential: PropTypes.number,
}
const Stars = React.memo(StarsBase)


interface CompanyLinkProps extends ValidCompany {
  isForAlternance?: boolean
  isNotClickable: boolean
  onClick: () => void
  romeId: string
  style?: React.CSSProperties
}


const createLBBUrl = (siret: string|undefined, tracking: string): string => {
  if (!siret) {
    return ''
  }
  return `https://labonneboite.pole-emploi.fr/${siret}/details?${tracking}`
}


const createLBAUrl = (siret: string|undefined, tracking: string, romeId: string): string => {
  if (!siret) {
    return ''
  }
  const baseUrl = 'https://labonnealternance.pole-emploi.fr/details-entreprises/'
  return `${baseUrl}${siret}?${tracking}&rome=${romeId}`
}


const CompanyLinkBase: React.FC<CompanyLinkProps> =
  (props: CompanyLinkProps): React.ReactElement => {
    const {cityName, hiringPotential, isForAlternance, onClick, name, romeId, siret, style} = props
    const tracking = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-ent'
    const LBBUrl = useMemo(() => createLBBUrl(siret, tracking), [siret, tracking])
    const LBAUrl = useMemo(() => createLBAUrl(siret, tracking, romeId), [siret, tracking, romeId])
    const url = isForAlternance ? LBBUrl : LBAUrl

    const handleClick = useMemo(() => (): void => {
      window.open(url, '_blank')
      onClick && onClick()
    }, [onClick, url])

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
    return <RadiumDiv style={containerStyle} onClick={siret ? handleClick : undefined}>
      <span style={{flex: 1}}><strong>{toTitleCase(name)}</strong>
        {cityName && !isMobileVersion ?
          <span style={{paddingLeft: '.3em'}}>
            - {toTitleCase(cityName)}
          </span> : null}
      </span>
      <Stars hiringPotential={hiringPotential || 0} />
      <ChevronRightIcon style={chevronStyle} />
    </RadiumDiv>
  }
CompanyLinkBase.propTypes = {
  cityName: PropTypes.string,
  hiringPotential: PropTypes.number,
  isForAlternance: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  romeId: PropTypes.string.isRequired,
  siret: PropTypes.string,
  style: PropTypes.object,
}
const CompanyLink = React.memo(CompanyLinkBase)


export default {ExpandedAdviceCardContent, Picto}
