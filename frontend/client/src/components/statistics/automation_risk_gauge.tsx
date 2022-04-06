import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {ofJobName} from 'store/french'
import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'

import {changeColorLightness} from 'components/colors'
import DataSource from 'components/data_source'
import Gauge from 'components/gauge'
import Trans from 'components/i18n_trans'


const gaugeHeaderStyle: React.CSSProperties = {
  margin: '0 0 10px',
  textAlign: 'center',
}

// This is a stunt to acknowledge that we do not name what could be a named
// React component (an alternative would be to systematically disable the
// react/display-name rule).
const unnamedComponent = (c: React.ReactNode): React.ReactNode => c

export const AUTOMATION_RISK_LEVELS: readonly {
  caption: LocalizableString
  color: string
  getTitle: (color: string, ofJobName: string) => React.ReactNode
  label: LocalizableString
  max: number
  min: number
  name: string
}[] = [
  {
    caption: prepareT('Votre métier a peu de risque'),
    color: changeColorLightness(colors.BOB_BLUE, 20),
    getTitle: (color: string, ofJobName: string) => unnamedComponent(<Trans parent={null}>
      <span style={{color}}>Faible</span> risque d'automatisation
      pour le métier {{ofJobName}}
    </Trans>),
    label: prepareT('Faible', {context: 'risk'}),
    max: 30,
    min: 0,
    name: 'low',
  },
  {
    caption: prepareT('Votre métier a un risque moyen'),
    color: 'hsl(211, 100%, 55%)', // colors.BOB_BLUE
    getTitle: (color: string, ofJobName: string) => unnamedComponent(<Trans parent={null}>
      <span style={{color}}>Possible</span> risque d'automatisation
      pour le métier {{ofJobName}}
    </Trans>),
    label: prepareT('Moyen', {context: 'risk'}),
    max: 60,
    min: 30,
    name: 'mid',
  },
  {
    caption: prepareT('Votre métier a un fort risque'),
    color: changeColorLightness(colors.BOB_BLUE, -20),
    getTitle: (color: string, ofJobName: string) => unnamedComponent(<Trans parent={null}>
      <span style={{color}}>Fort</span> risque d'automatisation
      pour le métier {{ofJobName}}
    </Trans>),
    label: prepareT('Élevé', {context: 'risk'}),
    max: 100,
    min: 60,
    name: 'high',
  },
] as const

interface Props {
  jobName: string
  percent: number
  style?: React.CSSProperties
}
const AutomationRiskGauge = ({jobName, percent, style}: Props): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const {caption, color = '', getTitle, name: riskLevel} = AUTOMATION_RISK_LEVELS.
    find(({min, max}) => min < percent && max >= percent) || {}
  const tOptions = useMemo(() => ({context: riskLevel}), [riskLevel])
  return <div style={style}>
    <h4 style={gaugeHeaderStyle}>{getTitle?.(color, ofJobName(jobName, t))}</h4>
    <figure style={{margin: '25px auto 0', width: 250}}>
      <Gauge segments={AUTOMATION_RISK_LEVELS} percent={percent} />
      <figcaption style={{display: 'flex', justifyContent: 'space-between'}}>
        <span>{t('Risque faible')}</span>
        <span>{t('Risque fort')}</span>
      </figcaption>
      <div style={{color, fontWeight: 'bold', marginTop: 25, textAlign: 'center'}}>
        {caption && translate(...caption) || ''}
      </div>
    </figure>
    {/* i18next-extract-mark-context-next-line ["low", "mid", "high"] */}
    <Trans tOptions={tOptions}>
      <span style={{color, fontWeight: 'bold'}}>{{percent}}%</span> des tâches liées
      à votre métier pourraient être faites par la technologie (des programmes d'ordinateurs,
      des algorithmes ou même des robots).
    </Trans>
    <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
      {config.dataSourceAutomation}
    </DataSource>
  </div>
}


export default React.memo(AutomationRiskGauge)
