import type {TFunction} from 'i18next'
import React, {useMemo} from 'react'

import {getDateString, inCityPrefix} from 'store/french'
import {prepareT} from 'store/i18n'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import StringJoiner from 'components/string_joiner'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import type {CardProps} from './base'
import {ExpandableAction, MethodSuggestionList, useAdviceData} from './base'


const daysBetween = (date1: Date, date2: Date): number =>
  (date2.getTime() - date1.getTime()) / 86_400_000


const noMarginStyle: React.CSSProperties = {
  margin: 0,
}

interface LocationProps {
  departementId?: string
  name: string
  prefix: string
}

const LocationBase: React.FC<LocationProps> = (props: LocationProps): React.ReactElement => {
  const {departementId, name, prefix} = props
  return <React.Fragment>
    {prefix}<strong>{name}</strong>{departementId ? ` (${departementId})` : ''}
  </React.Fragment>
}
const Location = React.memo(LocationBase)


const OnlineSalonsMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement|null => {
  const {
    handleExplore,
    profile: {gender},
    project: {city: {cityId: userCityId = '', regionId: userRegionId = ''} = {}},
    t,
  } = props
  const {data: {salons = []}, loading} = useAdviceData<bayes.bob.OnlineSalons>(props)
  if (loading) {
    return loading
  }

  if (!salons.length) {
    return null
  }

  // TODO(cyrille): Remove reference to Pôle emploi if we ever find other salons.
  const footer = <Trans parent="p" t={t} style={noMarginStyle}>
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
const getLocationProps = (t: TFunction, areaType?: bayes.bob.AreaType, city?: bayes.bob.FrenchCity):
LocationProps|null => {
  if (!city) {
    return null
  }
  if (areaType === 'REGION') {
    const {regionName: name = '', regionPrefix: prefix = ''} = city
    return {name, prefix}
  }
  if (areaType === 'DEPARTEMENT') {
    const {departementId = '', departementName: name = '', departementPrefix: prefix = ''} = city
    return {departementId, name, prefix}
  }
  if (areaType === 'CITY') {
    const {departementId = '', name: cityName = ''} = city
    const {cityName: name, prefix} = inCityPrefix(cityName, t)
    return {departementId, name, prefix}
  }
  return null
}


type TagProps = React.ComponentProps<typeof ExpandableAction>['tag']


const makeTimeTagProps = (applicationEndDate: Date, startDate: Date): TagProps|undefined => {
  const now = new Date()
  if (daysBetween(now, applicationEndDate) < 15) {
    return {color: colors.SQUASH, value: prepareT('Ferme bientôt')}
  }
  if (now > startDate) {
    return {color: colors.GREENISH_TEAL, value: prepareT('En ce moment')}
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
    const locationProps = getLocationProps(t, areaType, city)
    if (locationProps) {
      moreInfos.push(<Location key={url} {...locationProps} />)
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
    isForYou={interests.some(({personal}): boolean => !!personal)}
    tag={makeTimeTagProps(startDate, endDate)}
    {...{style, title}}
    onContentShown={handleExplore('salon info')}>
    <div>
      <Interests {...{interests, t}} />
      <div>
        {t(
          'Candidatures du {{startDate}} au {{endDate}}',
          {endDate: getDateString(endDate, t), startDate: getDateString(startDate, t)},
        )}
        {moreInfos.length ? <React.Fragment><br />
          <StringJoiner separator=" - " lastSeparator=" - ">{moreInfos}</StringJoiner>
        </React.Fragment> : undefined}
      </div>
      <div style={{display: 'flex', fontWeight: 'bold', margin: '12px 0'}}>
        <RadiumExternalLink href={url} onClick={handleExplore('salon')}>
          {t('En savoir plus sur le salon')}
        </RadiumExternalLink>
        {(cityId && cityId !== userCityId && areaType === 'CITY') ?
          <RadiumExternalLink
            href={`/api/redirect/eterritoire/${cityId}`}
            onClick={handleExplore('city')}
            style={{marginLeft: 10}}>
            {t('Découvrir {{cityName}}', {cityName})}
          </RadiumExternalLink> : null}
      </div>
    </div>
  </ExpandableAction>
}
const Salon = React.memo(SalonBase)


export default {ExpandedAdviceCardContent, pictoName: 'headsetMic' as const}
