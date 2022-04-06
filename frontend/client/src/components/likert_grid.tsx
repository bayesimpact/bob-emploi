import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo} from 'react'

import type {Props as LikertScaleProps} from 'components/likert_scale'
import LikertScale, {TextScale} from 'components/likert_scale'

const typedMemo: <T>(c: T) => T = React.memo

interface LineProps<Id, T extends string|number = number>
  extends Pick<LikertScaleProps<T>, 'isTextShown'|'scale'|'style'|'value'> {
  id: Id
  name: string
  onChange: (id: Id, value: T) => void
}

const likertScaleStyle: React.CSSProperties = {
  fontSize: '.875em',
  fontWeight: 'normal',
  margin: '10px 0 20px',
}

const LikertGridLineBase = <Id, T extends string|number>(
  props: LineProps<Id, T>,
): React.ReactElement => {
  const {id, name, onChange, ...otherProps} = props
  const labelId = useMemo(_uniqueId, [])
  const handleChange = useCallback((value: T) => onChange(id, value), [id, onChange])
  return <React.Fragment>
    <span id={labelId}>{name}</span>
    <LikertScale onChange={handleChange} {...otherProps} aria-labelledby={labelId} />
  </React.Fragment>
}
const LikertGridLine = typedMemo(LikertGridLineBase)

interface Props<Id extends string, T extends string|number> {
  // If false, the questions of the grid will be shown one after the other.
  isShownAsGrid: boolean
  onChange: (id: Id, value: T) => void
  questions: readonly {id: Id; name: string}[]
  scale: LikertScaleProps<T>['scale']
  values: {[id in Id]?: T}
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: '1fr 1fr',
}
const textHeaderStyle: React.CSSProperties = {
  alignItems: 'flex-end',
  fontSize: '.875em',
}

const LikertGrid = <Id extends string, T extends string|number>(
  props: Props<Id, T>,
): React.ReactElement => {
  const {isShownAsGrid = true, onChange, questions, scale, values} = props
  return <div style={isShownAsGrid ? gridStyle : undefined}>
    {isShownAsGrid ? <React.Fragment>
      <div />
      <TextScale scale={scale} style={textHeaderStyle} />
    </React.Fragment> : null}
    {questions.map(({id, name}) => <LikertGridLine
      key={id} id={id} scale={scale} value={values[id]} onChange={onChange} name={name}
      isTextShown={!isShownAsGrid} style={isShownAsGrid ? undefined : likertScaleStyle} />)}
  </div>
}

export default typedMemo(LikertGrid)
