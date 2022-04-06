import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {colorFromPercent, computeBobScore} from 'store/score'

import CircularProgress from 'components/circular_progress'
import Markdown from 'components/markdown'
import Textarea from 'components/textarea'
import BobScoreCircle from 'components/bob_score_circle'
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
  const {t} = useTranslation()
  const {Icon, alt = t('Commenter'), comment, isShown, setIsShown} = props
  const onClick = useCallback((): void => setIsShown(!isShown), [isShown, setIsShown])
  return <EvalElementButton
    isSelected={!!comment || isShown} onClick={onClick} style={coverAllStyle}>
    {Icon ? <Icon color={colors.ROBINS_EGG} /> :
      <img src={commentImage} alt={alt} title={alt} />}
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
  const [isCommentShown, setIsCommentShown] = useState(false)
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


const bobScoreStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  margin: '0 auto 5.6px',
  position: 'relative',
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
  isLoading: boolean
}


const Assessment = (props: AssessmentProps): React.ReactElement => {
  const {diagnostic, diagnosticEvaluations, isLoading, onEvaluateSection} = props
  const {t} = useTranslation()
  const evalProps = useMemo((): EvaluationProps => ({
    diagnosticEvaluations,
    onEvaluateSection,
  }), [diagnosticEvaluations, onEvaluateSection])

  const [thinkCommentButton, thinkComment] = useComment(evalProps, 'think')
  const [titleCommentButton, titleComment] = useComment(evalProps, 'title')
  const [textCommentButton, textComment] = useComment(evalProps, 'text')

  if (isLoading) {
    return <CircularProgress />
  }

  const {categoryId, text} = diagnostic
  const {percent, shortTitle} = computeBobScore(diagnostic)
  return <div style={{color: colors.DARK_TWO, display: 'flex', flexDirection: 'column'}}>
    <div style={{alignSelf: 'center', fontWeight: 'bold', marginBottom: 10}}>
      BobThink&nbsp;: {categoryId || t('Aucun')}
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
        <Markdown content={shortTitle} />
      </div>
      {titleCommentButton}
      {titleComment}
    </div>
    <div>
      <div style={pepTalkStyle}>
        <div style={subTitleStyle}>{t('Synthèse')}</div>
        {textCommentButton}
        <Markdown content={text} />
        {textComment}
      </div>
    </div>
  </div>
}


export default React.memo(Assessment)
