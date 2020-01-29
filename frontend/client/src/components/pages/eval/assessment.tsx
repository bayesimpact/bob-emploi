import PlusIcon from 'mdi-react/PlusIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'

import {ScoreComponent, colorFromPercent, computeBobScore} from 'store/score'
import {BobScoreCircle, Markdown, Textarea} from 'components/theme'

import commentImage from 'images/comment-picto.svg'

import {EvalElementButton} from './advices_recap'


const coverAllStyle: React.CSSProperties = {
  padding: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}


type IconType = React.ComponentType<{color?: string}>
interface CommentButtonProps {
  Icon?: IconType
  alt?: string
  comment?: string
  isShown?: boolean
  setIsShown: (isShown: boolean) => void
}


const CommentButtonBase = (props: CommentButtonProps): React.ReactElement => {
  const {Icon, alt, comment, isShown, setIsShown} = props
  const onClick = useCallback((): void => setIsShown(!isShown), [isShown, setIsShown])
  return <EvalElementButton
    isSelected={!!comment || isShown} onClick={onClick} style={coverAllStyle}>
    {Icon ? <Icon color={colors.ROBINS_EGG} /> :
      <img src={commentImage} alt={alt || 'Commenter'} title={alt || 'Commenter'} />}
  </EvalElementButton>
}
const CommentButton = React.memo(CommentButtonBase)


interface CommentProps {
  comment: string
  isShown: boolean
  onChange: (value: string) => void
}


const textareaStyle = {
  borderColor: colors.BOB_BLUE,
  fontSize: 14,
  marginTop: 5,
  width: '100%',
}


const CommentBase = (props: CommentProps): React.ReactElement|null => {
  const {comment, isShown, onChange} = props
  if (!isShown) {
    return null
  }

  return <Textarea style={textareaStyle} value={comment} onChange={onChange} />
}
const Comment = React.memo(CommentBase)


interface EvaluationProps {
  diagnosticEvaluations: SectionEvaluations
  onEvaluateSection: SectionEvaluate
}


function useComment(
  {diagnosticEvaluations, onEvaluateSection}: EvaluationProps, sectionId: string,
  alt?: string, Icon?: IconType,
): [React.ReactElement, React.ReactElement] {
  const [isCommentShown, setIsCommentShown] = useState()
  const onChange = useCallback(
    (value: string): void => onEvaluateSection(sectionId, {comment: value}),
    [onEvaluateSection, sectionId],
  )
  const {comment = ''} = diagnosticEvaluations[sectionId] || {}
  return [
    <CommentButton
      isShown={isCommentShown} setIsShown={setIsCommentShown} alt={alt} Icon={Icon}
      comment={comment} key={`comment-button-${sectionId}`} />,
    <Comment
      onChange={onChange} comment={comment}
      isShown={isCommentShown} key={`comment-${sectionId}`} />,
  ]
}


interface SectionEvaluations {
  [sectionId: string]: bayes.bob.GenericEvaluation
}

type SectionEvaluate = (sectionId: string, evaluation: bayes.bob.GenericEvaluation) => void


interface ComponentCommentSectionProps extends ScoreComponent {
  evalProps: EvaluationProps
}


const ComponentCommentSectionBase = (props: ComponentCommentSectionProps): React.ReactElement => {
  const {evalProps, observations, percent, shortTitle, topic} = props
  const [scoreCommentButton, scoreComment] =
    useComment(evalProps, `${topic}-score`, 'Commenter le score')
  const [observationsCommentButton, observationsComment] =
    useComment(evalProps, `${topic}-observations`, 'Ajouter des observations', PlusIcon)
  return <div>
    <h4 style={{position: 'relative'}}>
      {shortTitle} ({percent}%)
      {scoreCommentButton}
      {scoreComment}
    </h4>
    <ul style={{position: 'relative'}}>
      {(observations || []).map(({text, isAttentionNeeded}, index): React.ReactNode =>
        <li key={index} style={{color: isAttentionNeeded ? colors.RED_PINK : 'initial'}}>
          {text}
        </li>,
      )}
      {observationsCommentButton}
      {observationsComment}
    </ul>
  </div>
}
const ComponentCommentSection = React.memo(ComponentCommentSectionBase)


const bobScoreStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  margin: '0 auto 5.6px',
  position: 'relative',
}
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 'bold',
  lineHeight: 1,
  marginLeft: 30,
}
const subTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 'bold',
  lineHeight: 1,
  marginBottom: 15,
  marginTop: 20,
}
const pepTalkStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  fontSize: 14,
  lineHeight: '22px',
  marginBottom: 25,
  position: 'relative',
}



interface AssessmentProps extends EvaluationProps {
  diagnostic: bayes.bob.Diagnostic
}


const AssessmentBase = (props: AssessmentProps): React.ReactElement => {
  const {diagnostic, diagnosticEvaluations, onEvaluateSection} = props
  const evalProps = useMemo((): EvaluationProps => ({
    diagnosticEvaluations,
    onEvaluateSection,
  }), [diagnosticEvaluations, onEvaluateSection])

  const [thinkCommentButton, thinkComment] = useComment(evalProps, 'think')
  const [titleCommentButton, titleComment] = useComment(evalProps, 'title')
  const [textCommentButton, textComment] = useComment(evalProps, 'text')

  const {categoryId, text} = diagnostic
  const {components = [], percent, shortTitle} = computeBobScore(diagnostic)
  return <div style={{color: colors.DARK_TWO, display: 'flex', flexDirection: 'column'}}>
    <div style={{alignSelf: 'center', fontWeight: 'bold', marginBottom: 10}}>
      BobThink&nbsp;: {categoryId || 'Aucun'}
      {thinkCommentButton}
      {thinkComment}
    </div>
    <div style={{marginBottom: 20, position: 'relative'}}>
      <div style={bobScoreStyle}>
        <BobScoreCircle
          isAnimated={false}
          isCaptionShown={false}
          color={colorFromPercent(percent)}
          percent={percent}
          radius={47.15}
          scoreSize={20}
          strokeWidth={3.1}
        />
        <Markdown style={titleStyle} content={shortTitle} />
      </div>
      {titleCommentButton}
      {titleComment}
    </div>
    <div>
      <div style={pepTalkStyle}>
        <div style={subTitleStyle}>Synthèse</div>
        {textCommentButton}
        <Markdown content={text} />
        {textComment}
      </div>
    </div>
    <div>
      {components.map((props: ScoreComponent) => <ComponentCommentSection
        {...props} evalProps={evalProps} key={props.topic} />)}
    </div>
  </div>
}
AssessmentBase.propTypes = {
  diagnostic: PropTypes.shape({
    categoryId: PropTypes.string,
    text: PropTypes.string,
  }).isRequired,
  diagnosticEvaluations: PropTypes.objectOf(PropTypes.object.isRequired).isRequired,
  onEvaluateSection: PropTypes.func.isRequired,
}
const Assessment = React.memo(AssessmentBase)


export {Assessment}
