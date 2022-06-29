import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {scoreProjectChallengeAgreement, sendProjectFeedback, useDispatch} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {NO_CHALLENGE_CATEGORY_ID, getDiagnosticIllustrations} from 'store/project'

import useOnScreen from 'hooks/on_screen'

import BobInteraction from 'components/bob_interaction'
import Button from 'components/button'
import MainChallengesTrain from 'components/challenges_train'
import {colorToAlpha} from 'components/colors'
import Markdown from 'components/markdown'
import {Modal, useModal} from 'components/modal'
import {FixedButtonNavigation, PageWithNavigationBar} from 'components/navigation'
import ScoreButtons from 'components/score_buttons'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import {STRAT_PREVIEW_PAGE} from 'components/url'

import useProjectReview from './project_review'

const emptyArray = [] as const
const pageMargin = 30
const desktopContainerWidth = 650
export const isStratsPreviewPageEnabled = !config.isStableDemo


interface DisagreeModalProps {
  comment?: string
  isShown: boolean
  onComplete: (comment?: string) => void
}
const modalStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 15 : 19,
  margin: isMobileVersion ? 20 : 10,
  padding: isMobileVersion ? 30 : 50,
}
const modalContentStyle: React.CSSProperties = {
  maxWidth: 400,
}
const modalTitleStyle: React.CSSProperties = {
  fontSize: 22,
  margin: '0 0 10px',
}
const modalSubtitleStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 16,
  margin: 0,
}
const textAreaStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_GREY,
  border: 'none',
  borderRadius: 3,
  fontSize: 15,
  margin: '25px 0',
  minHeight: 120,
  padding: 15,
  width: '100%',
}

const DisagreeModalBase = (props: DisagreeModalProps): React.ReactElement => {
  const {comment, isShown, onComplete} = props
  const {t} = useTranslation()
  const [text, setText] = useState('')
  const hasNewComment = (comment || '') !== text
  useEffect((): void => {
    if (!isShown && hasNewComment) {
      setText(comment || '')
    }
  }, [comment, hasNewComment, isShown])
  const handleSubmit = useCallback((): void => onComplete(text), [onComplete, text])
  const onClose = useCallback((): void => onComplete(comment), [onComplete, comment])
  return <Modal {...{isShown, onClose}} style={modalStyle}>
    <div style={modalContentStyle}>
      <h2 style={modalTitleStyle}>
        {t('Selon vous, quelle est votre plus grande priorité\u00A0?')}
      </h2>
      <p style={modalSubtitleStyle}>
        {t('Soyez honnêtes, nous lisons tous les commentaires\u00A0!')}
      </p>
      <Textarea
        style={textAreaStyle} placeholder={t('Saisissez un commentaire ici (Facultatif)')}
        value={text} onChange={setText} />
      <Button onClick={handleSubmit} type="navigation">
        {t('Envoyer mon évaluation')}
      </Button>
    </div>
  </Modal>
}
const DisagreeModal = React.memo(DisagreeModalBase)

interface SectionProps {
  project: bayes.bob.Project
}
const feedbackSectionStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_GREY,
  marginTop: 6,
  padding: 30,
  ...isMobileVersion ? {} : {borderRadius: 30, width: desktopContainerWidth},
}
const FeedbackSectionBase = (props: SectionProps): React.ReactElement => {
  const {project, project: {
    diagnostic: {overallSentence = ''} = {},
    feedback: {challengeAgreementScore: score, text: disagreeComment = ''} = {},
  } = {}} = props
  const dispatch = useDispatch()
  const [isDisagreeModalShown, showDisagreeModal, hideDisagreeModal] = useModal()
  const {t} = useTranslation()
  const setScore = useCallback(
    (newScore: number) => {
      if (newScore <= 2) {
        showDisagreeModal()
      }
      if (score !== newScore + 1) {
        dispatch(scoreProjectChallengeAgreement(project, newScore + 1))
      }
    },
    [dispatch, project, score, showDisagreeModal],
  )
  const handleFeedback = useCallback((newComment?: string): void => {
    hideDisagreeModal()
    if (newComment === undefined || newComment === disagreeComment) {
      return
    }
    dispatch(sendProjectFeedback(project, {...project.feedback, text: newComment}, t))
  }, [dispatch, disagreeComment, hideDisagreeModal, project, t])
  const scoreButtonsSectionStyle: React.CSSProperties = isMobileVersion ? {} : {
    margin: 'auto',
    width: 315,
  }
  const scoreButtonsTitleStyle: React.CSSProperties = isMobileVersion ? {} : {
    textAlign: 'center',
  }
  const scoreButtonsTitleThinkStyle: React.CSSProperties = isMobileVersion ? {} : {
    margin: '20px 0 30px 0',
    textAlign: 'center',
  }
  return <div style={feedbackSectionStyle}>
    <DisagreeModal
      isShown={isDisagreeModalShown} onComplete={handleFeedback} comment={disagreeComment} />
    <div style={scoreButtonsSectionStyle}>
      {overallSentence ? <div style={scoreButtonsTitleStyle}><strong>{overallSentence} </strong>
        {t('est votre plus grande priorité selon {{productName}}.',
          {productName: config.productName})}</div> : null
      }
      <div style={scoreButtonsTitleThinkStyle}>{t("Qu'en pensez-vous\u00A0?")}</div>
      <ScoreButtons
        score={score && (score - 1)} onScoreChange={setScore}
        minText={t("Pas du tout d'accord")} maxText={t("Tout à fait d'accord")} />
    </div>
  </div>
}
const FeedbackSection = React.memo(FeedbackSectionBase)

const illustrationsContainerStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  display: 'flex',
  margin: isMobileVersion ? '15px 0 25px ' : '15px auto 25px',
  overflow: 'auto',
  paddingLeft: `${pageMargin}px`,
  width: isMobileVersion ? '100vw' : desktopContainerWidth,
}
const illustrationStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colorToAlpha(colors.BOB_BLUE, .1),
  borderRadius: 20,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minWidth: 225,
  padding: 20,
  textAlign: 'center',
}
const illustrationMargedStyle: React.CSSProperties = {
  ...illustrationStyle,
  marginRight: 15,
}
const illustrationHighlightStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  fontSize: 30,
  fontWeight: 'bold',
}
const illustrationTextStyle: React.CSSProperties = {
  fontSize: 13,
  marginTop: 10,
}
const separatorStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 30,
}
const IllustrationSectionBase = (props: SectionProps): React.ReactElement|null => {
  const {project: {diagnostic: {bobExplanation, categoryId} = {}}} = props
  const {t} = useTranslation()
  const content = getDiagnosticIllustrations(categoryId, t)
  if (!content.length) {
    return null
  }
  const whyQuestion = categoryId === NO_CHALLENGE_CATEGORY_ID ?
    t('Pourquoi on pense que ça avance bien\u00A0?') :
    t("Pourquoi c'est votre priorité\u00A0?")
  return <React.Fragment>
    <div style={whyStyle}>{whyQuestion}</div>
    <div style={illustrationsContainerStyle}>
      {content.map(({highlight, text}, index) =>
        <div key={index} style={(index === content.length - 1) ? illustrationStyle
          : illustrationMargedStyle}>
          <div style={illustrationHighlightStyle}>{highlight}</div>
          <div style={illustrationTextStyle}><Markdown content={text} isSingleLine={true} /></div>
        </div>)}
      {isMobileVersion ? <div style={separatorStyle} /> : null}
    </div>
    {bobExplanation ? <BobInteraction style={bobInteractionStyle}>
      {t("Un point d'attention\u00A0: ") + bobExplanation}
    </BobInteraction> : null}
  </React.Fragment>
}
const IllustrationSection = React.memo(IllustrationSectionBase)

interface Props {
  baseUrl: string
  project: bayes.bob.Project
}

const pageStyle: React.CSSProperties = {
  alignItems: isMobileVersion ? 'stretch' : 'center',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  padding: '35px 0px 0px',
}
const priorityTitleStyle: React.CSSProperties = {
  fontSize: 16,
  textAlign: isMobileVersion ? 'left' : 'center',
  ...isMobileVersion ? {marginLeft: pageMargin} : {width: desktopContainerWidth},
}
const priorityValueStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 20,
  fontWeight: 'bold',
}
const whyStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 'bold',
  paddingLeft: pageMargin,
  ...isMobileVersion ? {} : {width: desktopContainerWidth},
}

const bobInteractionStyle: React.CSSProperties = isMobileVersion ? {
  margin: '20px 30px 30px',
} : {
  margin: '15px auto 45px',
  width: 315,
}
const trainStyle: React.CSSProperties = isMobileVersion ? {
  alignSelf: 'flex-start',
  border: 'solid 1px rgba(255, 255, 255, .5)',
  boxShadow: '0 10px 15px 0 rgba(0, 0, 0, .08)',
  margin: '20px 0',
  width: 'fit-content',
} : {
  margin: '20px 0',
}
const trainContainerStyle: React.CSSProperties = isMobileVersion ? {
  display: 'flex',
  overflow: 'auto',
  paddingLeft: 30,
  width: '100vw',
} : {}
const navButtonStyle = SmoothTransitions
const hiddenNavButtonStyle: React.CSSProperties = {
  transform: 'translateY(100%)',
  ...navButtonStyle,
}
const buttonPlaceHolderStyle: React.CSSProperties = {
  height: 1,
  minWidth: 1,
}

const trainMarginStyle: React.CSSProperties = {
  flexShrink: 0,
  width: pageMargin,
}
const ConvincePageBase = (props: Props): React.ReactElement => {
  const {baseUrl, project, project: {
    diagnostic: {categories = emptyArray, overallSentence = '', response = ''} = {},
    originalSelfDiagnostic: {categoryId: selfDiagnostic} = {},
  } = {}} = props
  const {t} = useTranslation()
  const bottomDomRef = useRef<HTMLDivElement>(null)
  const isNextButtonVisible = useOnScreen(bottomDomRef, {isForAppearing: true})
  const gotoUrl = config.postDiagnosticUrl || config.isStableDemo && baseUrl ||
    `${baseUrl}/${STRAT_PREVIEW_PAGE}`
  const gotoNextPage = useProjectReview(gotoUrl, project, 'REVIEW_PROJECT_MAIN_CHALLENGE')
  return <PageWithNavigationBar
    page="main-challenge"
    navBarContent={t('Mon diagnostic')}
    isChatButtonShown={false} style={pageStyle}>
    <div style={priorityTitleStyle}>
      {t('Votre priorité\u00A0:')}
      <span style={priorityValueStyle}>{overallSentence}</span>
    </div>
    <div style={trainContainerStyle}>
      <MainChallengesTrain
        selfDiagnostic={selfDiagnostic} style={trainStyle} mainChallenges={categories} />
      {isMobileVersion ? <div style={trainMarginStyle} />
        : null}
    </div>
    <BobInteraction style={bobInteractionStyle}>
      {response}
    </BobInteraction>
    <IllustrationSection project={project} />
    <FeedbackSection project={project} />
    {isNextButtonVisible ? null : <div ref={bottomDomRef} style={buttonPlaceHolderStyle} />}
    <FixedButtonNavigation
      onClick={gotoNextPage}
      placeHolderExtraHeight={isMobileVersion ? -30 : 0}
      width={isMobileVersion ? undefined : desktopContainerWidth}
      style={isNextButtonVisible ? navButtonStyle : hiddenNavButtonStyle}>
      {t('Comment relever le défi\u00A0?')}
    </FixedButtonNavigation>
  </PageWithNavigationBar>
}

export const ConvincePage = React.memo(ConvincePageBase)
