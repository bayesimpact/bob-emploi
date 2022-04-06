import _memoize from 'lodash/memoize'
import React, {useCallback} from 'react'

import {colorToAlpha} from 'components/colors'

interface ButtonProps {
  isSelected: boolean
  onClick: (score: number) => void
  score: number
  theme: 'dark' | 'light'
}

const getThemeColors = _memoize((theme: ButtonProps['theme']) => {
  const backgroundColor = theme === 'light' ? colors.BOB_BLUE : colors.WARM_GREY
  return {
    backgroundColor,
    border: `solid 1px ${backgroundColor}`,
    color: theme === 'light' ? colors.BOB_BLUE : '#fff',
    contrastColor: theme === 'light' ? '#fff' : '#000',
  }
})

const ScoreButtonBase = (props: ButtonProps): React.ReactElement => {
  const {isSelected, onClick, score, theme} = props
  const {backgroundColor, border, color, contrastColor} = getThemeColors(theme)
  const scoreButtonStyle: React.CSSProperties = {
    background: colorToAlpha(backgroundColor, .1),
    borderBottom: border,
    borderRight: border,
    color,
    flex: 1,
    flexBasis: 60,
    fontSize: 18,
    height: 50,
    textAlign: 'center',
  }
  const scoreButtonSelectedStyle: React.CSSProperties = {
    ...scoreButtonStyle,
    background: color,
    color: contrastColor,
  }
  const handleClick = useCallback(() => onClick(score), [onClick, score])
  return <button
    onClick={handleClick} style={isSelected ? scoreButtonSelectedStyle : scoreButtonStyle}
    type="button">
    {score}
  </button>
}
const ScoreButton = React.memo(ScoreButtonBase)

interface Props extends Pick<Partial<ButtonProps>, 'theme'> {
  maxText: string
  minText: string
  numScoreButtons?: number
  onScoreChange: (score: number) => void
  score?: number
  style?: React.CSSProperties
  title?: string
}
const legendContainerStyle: React.CSSProperties = {
  display: 'flex',
  fontSize: 13,
  fontStyle: 'italic',
  justifyContent: 'space-between',
}
const legendStyle: React.CSSProperties = {
  maxWidth: 100,
}
const rightLegendStyle: React.CSSProperties = {
  ...legendStyle,
  textAlign: 'right',
}
const ScoreButtonsBase = (props: Props): React.ReactElement => {
  const {maxText, minText, numScoreButtons = 5, onScoreChange, score, style,
    theme = 'light', title} = props
  const {border} = getThemeColors(theme)
  const scoreButtonsContainerStyle: React.CSSProperties = {
    borderLeft: border,
    borderTop: border,
    display: 'flex',
    margin: '10px 0',
    padding: 0,
  }
  return <section style={{maxWidth: numScoreButtons * 63, ...style}}>
    {title ? <header>{title}</header> : null}
    <ol style={scoreButtonsContainerStyle}>
      {Array.from({length: numScoreButtons}, (unused, index) => <ScoreButton
        key={index} theme={theme} isSelected={index === score}
        score={index} onClick={onScoreChange} />)}
    </ol>
    <div style={legendContainerStyle}>
      <span style={legendStyle}>{minText}</span>
      <span style={rightLegendStyle}>{maxText}</span>
    </div>
  </section>
}
export default React.memo(ScoreButtonsBase)
