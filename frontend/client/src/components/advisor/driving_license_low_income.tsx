import PropTypes from 'prop-types'
import {stringify} from 'query-string'
import React from 'react'

import {getEmailTemplates} from 'store/i18n'

import vroomVroomImage from 'images/vroom-vroom-picto.jpg'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-driving-license.svg'

import {CardProps, EmailTemplate, ExpandableAction, ToolCard, useAdviceData} from './base'


interface RequirementsProps extends CardProps {
  style: React.CSSProperties
}


const RequirementsBase: React.FC<RequirementsProps> =
(props: RequirementsProps): React.ReactElement => {
  const {advice: {numStars}, profile: {gender}, style, t} = props
  const aLot = numStars && numStars >= 3 ? t('beaucoup ') : ''
  return <div style={style}>
    {t(
      'Nous vous proposons ce conseil parce que vous avez plus de 18 ans et il semblerait ' +
      'que\u00A0:',
    )}<br />
    <ul>
      <li>{t(
        "vous soyez inscrit·e comme demandeur·se d'emploi à Pôle emploi depuis plus de 6 mois",
        {context: gender},
      )}</li>
      <li>{t(
        'vous auriez {{aLot}}plus de chances de trouver un emploi en ayant le permis',
        {aLot},
      )}</li>
    </ul>

    {t('Pour pouvoir bénéficier de cette aide il faut aussi que\u00A0:')}
    <ul>
      <Trans parent="li" t={t}>
        vous ne receviez pas d'allocations chômage <strong>ou</strong>
      </Trans>
      <li>{t('vos allocations chômage soient inférieures à 28,84\u00A0€\u00A0/\u00A0jour')}</li>
    </ul>

    {t(
      'Si vous remplissez ces conditions de base, vous devriez contacter votre conseiller ' +
      'Pôle emploi pour avancer avec lui.',
    )}
  </div>
}
const Requirements = React.memo(RequirementsBase)


const comparatorStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 13,
  fontStyle: 'italic',
  fontWeight: 'normal',
}


const getVroomVroomUrl =
  ({latitude, longitude}: bayes.bob.FrenchCity, city?: bayes.bob.FrenchCity): string => {
    if (!city || !latitude || !longitude) {
      return 'https://www.vroomvroom.fr/'
    }
    const {name, regionName} = city
    const location = `${name}, ${regionName}, France`
    const params = stringify({latitude, location, longitude})
    return `https://www.vroomvroom.fr/auto-ecoles?${params}`
  }


const SchoolsBase: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, project: {city}, t} = props
  const {data: adviceData, loading} = useAdviceData<bayes.bob.FrenchCity>(props)
  const schoolComparators = [
    <ToolCard
      imageSrc={vroomVroomImage} href={getVroomVroomUrl(adviceData, city)}
      key="comparator-vroom-vroom"
      hasBorder={true} onClick={handleExplore('tool')}>
      VroomVroom.fr
      <div style={{fontSize: 13, fontWeight: 'normal'}}>
        {t('pour comparer les auto-écoles près de chez vous')}
      </div>
      <div style={comparatorStyle}>{t("Comparateur en ligne d'auto-écoles")}</div>
    </ToolCard>,
  ]
  const schoolsStyle = {
    paddingBottom: 35,
  }
  if (loading) {
    return loading
  }
  return <ExpandableAction
    onContentShown={handleExplore('schools list')}
    title={t('Trouver une auto-école')} contentName={t('les sites')}>
    <div style={schoolsStyle}>
      <Trans style={{marginBottom: 35}} t={t} count={schoolComparators.length}>
        Vous pouvez utiliser un comparateur d'auto-école, pour comparer les prix, le taux de
        réussite et la qualité des auto-écoles près de chez vous. Nous avons sélectionné
        pour vous <GrowingNumber
          style={{fontWeight: 'bold'}}
          number={schoolComparators.length} isSteady={true} /> comparateur en ligne&nbsp;:
      </Trans>
      {schoolComparators}
    </div>
  </ExpandableAction>
}
const Schools = React.memo(SchoolsBase)


const DrivingLicenseLowIncome: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {advice: {adviceId}, handleExplore, t} = props
  const templates = getEmailTemplates(t)[adviceId]
  const actions = templates.map((template, index): React.ReactNode =>
    <EmailTemplate {...template} key={`email-${index}`} onContentShown={handleExplore('email')} />,
  )
  actions.splice(1, 0, <Schools key="schools" {...props} />)
  return <div>
    <Requirements {...props} style={{marginBottom: 35}} />
    {actions}
  </div>
}
DrivingLicenseLowIncome.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
    numStars: PropTypes.number,
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.oneOf(['FEMININE', 'MASCULINE']),
  }).isRequired,
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string,
      regionName: PropTypes.string,
    }),
  }).isRequired,
}
const ExpandedAdviceCardContent = React.memo(DrivingLicenseLowIncome)


export default {ExpandedAdviceCardContent, Picto}
