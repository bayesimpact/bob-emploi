import _memoize from 'lodash/memoize'
import React from 'react'
import {useTranslation} from 'react-i18next'

import {getTranslatedVAEStats} from 'store/statistics'

import {colorToAlpha} from 'components/colors'
import DataSource from 'components/data_source'


interface Props {
  style?: React.CSSProperties
  targetJobGroup?: bayes.bob.JobGroup
}


interface VAEDiploma {
  name: string
  romeIds: readonly string[]
  vaeRatioInDiploma: number
}


const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
}


const tableRowStyle = _memoize(
  (isEven: boolean, isTargeted: boolean): React.CSSProperties => ({
    backgroundColor: isEven ? colorToAlpha(colors.BOB_BLUE, .1) : 'transparent',
    fontWeight: isTargeted ? 900 : undefined,
  }),
  (isEven: boolean, isTargeted: boolean): string => `${isEven}-${isTargeted}`,
)


const cellStyle: React.CSSProperties = {
  padding: 10,
}


const numberCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
}

const sourceStyle: React.CSSProperties = {
  marginTop: 15,
}


const MostVaeDiplomaTable: React.FC<Props> = (props: Props): React.ReactElement => {
  const {style, targetJobGroup: {romeId = undefined} = {}} = props
  const {t} = useTranslation()
  const translatedVAEStats = getTranslatedVAEStats(t)
  return <div style={style}>
    <table style={tableStyle}><tbody>
      {translatedVAEStats.map((diploma: VAEDiploma, index: number): React.ReactElement => <tr
        key={diploma.name}
        style={tableRowStyle(!(index % 2), !!romeId && diploma.romeIds.includes(romeId))}>
        <td style={cellStyle}>{diploma.name}</td>
        <td style={numberCellStyle}>{diploma.vaeRatioInDiploma.toLocaleString(undefined, {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}%</td>
      </tr>)}
    </tbody></table>
    <DataSource style={sourceStyle}>
      MENJ-DEPP, enquête n°62
    </DataSource>
  </div>
}


export default React.memo(MostVaeDiplomaTable)
