import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {dataSourceYear as yearForData} from 'store/statistics'

import {colorGradient} from 'components/colors'
import DataSource from 'components/data_source'
import DynamicMap from 'components/dynamic_map'
import Trans from 'components/i18n_trans'

const emptyArray = [] as const


interface Props {
  stats?: readonly bayes.bob.DepartementStats[]
  selectedAreaId?: string
  style?: React.CSSProperties
}

// Rescale the offers per 10 candidates to fit between 0 and 12 and to have a logarithmic
// progression.
const imtToValue = ({yearlyAvgOffersPer10Candidates}: bayes.bob.ImtLocalJobStats = {}): number => {
  // -1 values in the proto actually mean 0 offers.
  const offersPer10 = yearlyAvgOffersPer10Candidates && yearlyAvgOffersPer10Candidates < 0 ? 0 :
    yearlyAvgOffersPer10Candidates || 0
  return Math.min(1, Math.log10((offersPer10 + 1.3) / 1.3))
}


const CountryMap: React.FC<Props> = (props: Props): React.ReactElement => {
  const {stats = emptyArray, selectedAreaId, style} = props

  const {t, t: translate} = useTranslation()

  const sortFunc = useCallback((depA: string, depB: string): number => {
    if (depA === selectedAreaId) {
      return 1
    }
    if (depB === selectedAreaId) {
      return -1
    }
    return depA < depB ? -1 : 1
  }, [selectedAreaId])

  const areaProps = useMemo(() => {
    const depProps = _mapValues(
      _keyBy(stats, (stat: bayes.bob.DepartementStats): string =>
        stat.areaId || stat.departementId || ''),
      ({localStats: {imt = undefined} = {}}): React.SVGProps<SVGPathElement> => ({
        fill: colorGradient(
          '#fff', colors.BOB_BLUE,
          imtToValue(imt) * .9 + .1),
      }))
    if (selectedAreaId) {
      depProps[selectedAreaId] = {
        ...depProps[selectedAreaId],
        stroke: '#000',
      }
    }
    return depProps
  }, [stats, selectedAreaId])
  const selectedValue = useMemo((): number | undefined => {
    if (selectedAreaId) {
      const selectedDepartement = stats.
        find(({areaId, departementId}): boolean =>
          areaId === selectedAreaId || departementId === selectedAreaId)
      const {localStats: {imt = undefined} = {}} = selectedDepartement || {}
      if (imt) {
        return imtToValue(imt)
      }
    }
  }, [stats, selectedAreaId])
  const hasSelectedValue = selectedValue !== undefined
  const scaleStyle = useMemo((): React.CSSProperties => ({
    background: `linear-gradient(to right,
      ${colorGradient('#fff', colors.BOB_BLUE, .1)}, ${colors.BOB_BLUE})`,
    height: 20,
    margin: hasSelectedValue ? '5px 0 23px' : 0,
    position: 'relative',
  }), [hasSelectedValue])
  const selectedMarkerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: '#000',
    bottom: -5,
    left: `${(selectedValue || 0) * 100}%`,
    position: 'absolute',
    top: -5,
    transform: 'translateX(-50%)',
    width: 2,
  }), [selectedValue])
  const youTextStyle = useMemo((): React.CSSProperties => ({
    left: '50%',
    position: 'absolute',
    top: '100%',
    transform: selectedValue && selectedValue > .9 ? 'translateX(-100%)' :
      (!selectedValue || selectedValue < .1) ? '' : 'translateX(-50%)',
  }), [selectedValue])
  return <div style={style}>
    <DynamicMap
      areaProps={areaProps} style={{height: 'auto', width: '100%'}}
      pathProps={{fill: colors.MODAL_PROJECT_GREY, stroke: 'none'}}
      sortFunc={selectedAreaId ? sortFunc : undefined} mapName={config.countryMapName} />
    <div style={{overflow: 'hidden'}}>
      <Trans style={{display: 'flex', justifyContent: 'space-between', marginBottom: 10}}>
        <span>Concurrence forte</span>
        <span style={{textAlign: 'right'}}>Plus d'offres que de candidats</span>
      </Trans>
      <div style={scaleStyle}>
        {hasSelectedValue ? <div style={selectedMarkerStyle}>
          <div style={youTextStyle}>{t('vous')}</div>
        </div> : null}
      </div>
    </div>
    <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
      {translate(config.dataSourceLMI, {dataSourceYear: yearForData})}
    </DataSource>
  </div>
}
export default React.memo(CountryMap)
