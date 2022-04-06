import React from 'react'

interface Props {
  children: React.ReactNode
  hasComment?: boolean
  note: React.ReactNode
}


const noteContainerStyle: React.CSSProperties = {display: 'flex', flexDirection: 'column'}
const noteStyleWithoutComment: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 15,
  lineHeight: 1.1,
  marginTop: 8,
}
const noteStyleWithComment: React.CSSProperties = {
  ...noteStyleWithoutComment,
  marginBottom: 20,
}


interface NoteProps {
  children: React.ReactNode
  id?: string
}
const NoteBase = ({children, id}: NoteProps): React.ReactElement => <div
  style={noteStyleWithoutComment} id={id}>
  {children}
</div>
export const Note = React.memo(NoteBase)


const WithNote = (props: Props): React.ReactElement => {
  const {children, hasComment, note} = props
  const noteStyle = hasComment ? noteStyleWithComment : noteStyleWithoutComment
  return <div style={noteContainerStyle}>
    {children}
    <div style={noteStyle}>
      {note}
    </div>
  </div>
}
export default React.memo(WithNote)

