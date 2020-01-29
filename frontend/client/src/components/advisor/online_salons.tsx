import {TFunction} from 'i18next'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {getDateString, inCityPrefix} from 'store/french'

import {Trans} from 'components/i18n'
import {RadiumExternalLink} from 'components/radium'
import {ExternalLink, GrowingNumber, StringJoiner} from 'components/theme'
import Picto from 'images/advices/picto-online-salons.svg'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import {CardProps, ExpandableAction, MethodSuggestionList, useAdviceData} from './base'


const daysBetween = (date1: Date, date2: Date): number =>
  (date2.getTime() - date1.getTime()) / 86400000


interface LocationProps {
  departementId?: string
  name: string
  prefix: string
}

const LocationBase: React.FC<LocationProps> = (props: LocationProps): React.ReactElement => {
  const {departementId, name, prefix} = props
  return <React.Fragment key="location">
    {prefix}<strong>{name}</strong>{departementId ? ` (${departementId})` : ''}
  </React.Fragment>
}
LocationBase.propTypes = {
  departementId: PropTypes.string,
  name: PropTypes.string.isRequired,
  prefix: PropTypes.string.isRequired,
}
const Location = React.memo(LocationBase)


type HTMLAnchorElementProps = React.HTMLProps<HTMLAnchorElement>


interface NewWindowLinkProps
  extends Pick<HTMLAnchorElementProps, Exclude<keyof HTMLAnchorElementProps, 'ref'>> {
  isStandardStyle?: boolean
}

// TODO(cyrille): See if it's relevant to keep this one now we use ExternalLink.
const NewWindowLinkBase: React.FC<NewWindowLinkProps> =
  (props: NewWindowLinkProps): React.ReactElement => {
    const {isStandardStyle, style, ...otherProps} = props
    const linkStyle = {
      color: 'inherit',
      textDecoration: 'initial',
      ...style,
    }
    return <RadiumExternalLink style={isStandardStyle ? style : linkStyle} {...otherProps} />
  }
NewWindowLinkBase.propTypes = {
  isStandardStyle: PropTypes.bool,
  style: PropTypes.object,
}
const NewWindowLink = React.memo(NewWindowLinkBase)


const OnlineSalonsMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement|null => {
  const {
    handleExplore,
    profile: {gender},
    project: {city: {cityId: userCityId = '', regionId: userRegionId = ''} = {}},
    t,
  } = props
  const {salons = []} = useAdviceData<bayes.bob.OnlineSalons>(props)

  if (!salons.length) {
    return null
  }

  // TODO(cyrille): Remove reference to Pôle emploi if we ever find other salons.
  const footer = <Trans parent={null} t={t}>
    <img src={poleEmploiLogo} style={{height: 40, marginLeft: 20}} alt="" />
    Voir tous les salons sur <ExternalLink
      href="https://salonenligne.pole-emploi.fr/candidat/voirtouslessalons"
      style={{color: colors.BOB_BLUE, textDecoration: 'none'}}>
      le site de Pôle emploi
    </ExternalLink>
  </Trans>

  const title = <Trans parent={null} t={t} count={salons.length}>
    <GrowingNumber number={salons.length} /> salon en ligne où candidater
  </Trans>
  const subtitle = t(
    'Vous pouvez être mis·e directement en relation avec des entreprises qui recrutent et passer ' +
    'des entretiens sans avoir à sortir de chez vous',
    {context: gender},
  )

  return <MethodSuggestionList title={title} subtitle={subtitle} footer={footer}>
    {salons.map((salon, index): React.ReactElement<SalonProps>|null => <Salon
      {...salon} key={`salon-${index}`}
      {...{handleExplore, t, userCityId, userRegionId}} />)}
  </MethodSuggestionList>
}
OnlineSalonsMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.oneOf(['FEMININE', 'MASCULINE']),
  }).isRequired,
  project: PropTypes.shape({
    city: PropTypes.shape({
      cityId: PropTypes.string,
      regionId: PropTypes.string,
    }),
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(OnlineSalonsMethod)


interface Interest {
  color?: string
  personal?: boolean
  value: string
}
interface InterestProps {
  interests: readonly Interest[]
  t: TFunction
}

const InterestsBase: React.FC<InterestProps> = (props: InterestProps): React.ReactElement|null => {
  const {interests, t} = props
  if (!interests.length) {
    return null
  }
  return <div>
    {t('Ce salon pourrait vous intéresser parce que\u00A0:')}
    <ul>{interests.map(({value}): React.ReactNode => <li key={value}>{value}</li>)}
    </ul>
  </div>
}
const Interests = React.memo(InterestsBase)

const getInterests = (
  jobGroupIds: readonly string[], locations: readonly bayes.bob.Location[],
  offerCount: number, userRegionId: string, t: TFunction): Interest[] => {
  const interests: Interest[] = []
  if (offerCount > 20) {
    interests.push({
      color: colors.BOB_BLUE,
      value: t("il y a beaucoup d'offres"),
    })
  }
  if (locations.some(({city: {regionId = ''} = {}}): boolean => regionId === userRegionId)) {
    interests.push({
      personal: true,
      value: t('il propose des postes dans votre région'),
    })
  }
  // If job groups are given, it means the user's is one of them.
  if (jobGroupIds.length) {
    interests.push({
      personal: true,
      value: t('il propose des postes dans votre domaine'),
    })
  }
  return interests
}


// TODO(cyrille): Choose which location to show if several.
const getLocationProps = (areaType?: bayes.bob.AreaType, city?: bayes.bob.FrenchCity):
LocationProps|null => {
  if (!city) {
    return null
  }
  if (areaType === 'REGION') {
    const {regionName: name = '', regionPrefix: prefix = ''} = city
    return {...{name, prefix}}
  }
  if (areaType === 'DEPARTEMENT') {
    const {departementId = '', departementName: name = '', departementPrefix: prefix = ''} = city
    return {...{departementId, name, prefix}}
  }
  if (areaType === 'CITY') {
    const {departementId = '', name: cityName = ''} = city
    const {cityName: name, prefix} = inCityPrefix(cityName)
    return {...{departementId, name, prefix}}
  }
  return null
}


type TagProps = GetProps<typeof ExpandableAction>['tag']


const makeTimeTagProps = (applicationEndDate: Date, startDate: Date): TagProps|undefined => {
  const now = new Date()
  if (daysBetween(now, applicationEndDate) < 15) {
    return {color: colors.SQUASH, value: 'Ferme bientôt'}
  }
  if (now > startDate) {
    return {color: colors.GREENISH_TEAL, value: 'En ce moment'}
  }
  return undefined
}


const emptyArray = [] as const


interface SalonProps extends bayes.bob.OnlineSalon {
  handleExplore: (visualElement: string) => (() => void)
  style?: React.CSSProperties
  t: TFunction
  userCityId: string
  userRegionId: string
}

const SalonBase: React.FC<SalonProps> = (props: SalonProps): React.ReactElement|null => {
  const {
    applicationEndDate,
    applicationStartDate,
    domain,
    handleExplore,
    jobGroupIds,
    locations,
    locations: [
      {areaType = undefined, city, city: {cityId = '', name: cityName = ''} = {}}] = [{}],
    offerCount,
    style,
    t,
    title,
    url,
    userCityId,
    userRegionId,
  } = props
  const moreInfos: React.ReactElement[] = []
  if (domain) {
    moreInfos.push(<React.Fragment key="domain">{domain}</React.Fragment>)
  }
  if (cityId) {
    const locationProps = getLocationProps(areaType, city)
    if (locationProps) {
      moreInfos.push(<Location {...locationProps} />)
    }
  }
  const interests =
    useMemo(() => getInterests(
      jobGroupIds || emptyArray, locations || emptyArray, offerCount || 0, userRegionId, t),
    [jobGroupIds, locations, offerCount, userRegionId, t])
  if (!applicationStartDate || !applicationEndDate) {
    return null
  }
  const startDate = new Date(applicationStartDate)
  const endDate = new Date(applicationEndDate)
  endDate.setDate(endDate.getDate() - 1)
  return <ExpandableAction
    whyForYou={interests.some(({personal}): boolean => !!personal) ? 'personnel' : ''}
    tag={makeTimeTagProps(startDate, endDate)}
    isMethodSuggestion={true} {...{style, title}}
    onContentShown={handleExplore('salon info')}>
    <div>
      <Interests {...{interests, t}} />
      <div>
        Candidatures du {getDateString(startDate)} au {getDateString(endDate)}
        {moreInfos.length ? <React.Fragment><br />
          <StringJoiner separator=" - " lastSeparator=" - ">{moreInfos}</StringJoiner>
        </React.Fragment> : null}
      </div>
      <div style={{display: 'flex', fontWeight: 'bold', margin: '12px 0'}}>
        <NewWindowLink href={url} isStandardStyle={true} onClick={handleExplore('salon')}>
          {t('En savoir plus sur le salon')}
        </NewWindowLink>
        {(cityId && cityId !== userCityId && areaType === 'CITY') ?
          <NewWindowLink
            href={`/api/redirect/eterritoire/${cityId}`} isStandardStyle={true}
            onClick={handleExplore('city')}
            style={{marginLeft: 10}}>
            Découvrir {cityName}
          </NewWindowLink> : null}
      </div>
    </div>
  </ExpandableAction>
}
SalonBase.propTypes = {
  applicationEndDate: PropTypes.string,
  applicationStartDate: PropTypes.string,
  domain: PropTypes.string,
  handleExplore: PropTypes.func,
  jobGroupIds: PropTypes.arrayOf(PropTypes.string.isRequired),
  locations: PropTypes.arrayOf(PropTypes.shape({
    areaType: PropTypes.string,
    city: PropTypes.shape({
      cityId: PropTypes.string.isRequired,
      departementId: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  }).isRequired),
  offerCount: PropTypes.number,
  startDate: PropTypes.string,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  userCityId: PropTypes.string,
  userRegionId: PropTypes.string,
}
const Salon = React.memo(SalonBase)


export default {ExpandedAdviceCardContent, Picto}
