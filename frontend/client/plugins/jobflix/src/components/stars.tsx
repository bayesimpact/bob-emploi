import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import FeedbackStars, {totalNumStars} from 'components/feedback_stars'
import type {ModalConfig} from 'components/modal'
import {useModal} from 'components/modal'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import Modal from './modal'

import type {DispatchAllUpskillingActions} from '../store/actions'
import {sendUpskillingFeedback} from '../store/actions'

type ModalProps = Omit<ModalConfig, 'children' | 'style'> & {
  onClose: () => void
  score: number
  sectionId?: string
  setScore: (score: number) => void
  starsDescribedby?: string
}

const modalStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_BACKGROUND,
  color: colors.TEXT,
  fontSize: isMobileVersion ? 15 : 19,
  margin: isMobileVersion ? 20 : 10,
  padding: isMobileVersion ? 30 : 50,
}
const modalStarsStyle: React.CSSProperties = {
  textAlign: 'initial',
}
const textAreaStyle: React.CSSProperties = {
  backgroundColor: colors.TEXTAREA_BACKGROUND,
  border: 'none',
  borderRadius: 3,
  color: colors.TEXTAREA_TEXT,
  fontFamily: config.font,
  fontSize: 15,
  margin: '35px 0',
  minHeight: 120,
  padding: 15,
  width: '100%',
}
const sendEvalButtonStyle: React.CSSProperties = {
  backgroundColor: colors.NAVIGATION_BUTTON_BACKGROUND,
  fontSize: isMobileVersion ? 14 : 15,
  padding: isMobileVersion ? '17px 11px' : '12px 20px',
}
const titleStyle: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: isMobileVersion ? 22 : 35,
  margin: '5px 0',
}
const noPStyle: React.CSSProperties = {
  margin: 0,
}
const StarsModalBase = (props: ModalProps): React.ReactElement|null => {
  const {isShown, onClose, score, sectionId, setScore, starsDescribedby, ...modalProps} = props
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const title = score < 4 ?
    t('Comment nous améliorer\u00A0?') :
    score < 5 ? t('Comment gagner cette étoile\u00A0?') :
      t('Wow\u00A0! Merci\u00A0!')
  const subtitle = score < 5 ?
    t('Soyez honnête, nous lisons tous les commentaires\u00A0!') :
    t("Qu'avez-vous aimé\u00A0? Nous lisons tous les commentaires\u00A0!")
  const [feedback, setFeedback] = useState('')
  const onSubmit = useCallback(() => {
    dispatch(sendUpskillingFeedback({feedback, score, sectionId}, t))
    onClose?.()
  }, [dispatch, feedback, onClose, score, sectionId, t])
  const titleId = useMemo(_uniqueId, [])
  return <Modal
    {...modalProps} {...{isShown, onClose}} style={modalStyle}
    skipFocusOnFirstElements={totalNumStars} aria-labelledby={titleId}>
    <div style={{maxWidth: 560}}>
      <FeedbackStars
        style={modalStarsStyle} aria-describedby={starsDescribedby}
        isWhite={true} score={score} title={false} onStarClick={setScore} />
      <h2 style={titleStyle} id={titleId}>{title}</h2>
      <p style={noPStyle}>{subtitle}</p>
      <Textarea
        style={textAreaStyle} placeholder={t('Saisissez un commentaire ici (Facultatif)')}
        value={feedback} onChange={setFeedback} aria-labelledby={titleId} />
      <Button onClick={onSubmit} type="navigation" style={sendEvalButtonStyle}>
        {t('Envoyer mon évaluation')}
      </Button>
    </div>
  </Modal>
}
const StarsModal = React.memo(StarsModalBase)

interface Props {
  sectionId?: string
  style?: React.CSSProperties
}
const h2Style: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  margin: 0,
}

const innerStarBlockStyle: React.CSSProperties = {
  background: colors.FEEDBACK_STARS_INNER_BACKGROUND,
  padding: '50px 0',
  ...config.hasRoundEdges ? {borderRadius: 16} : {},
}

const Stars = ({sectionId, style}: Props): null|React.ReactElement => {
  const {t} = useTranslation()
  const sectionStyle: React.CSSProperties = {
    backgroundColor: colors.FEEDBACK_STARS_BACKGROUND,
    color: '#fff',
    padding: '30px 50px',
    textAlign: 'center',
  }
  const [score, setScore] = useState(0)
  const [isShown, open, close] = useModal()
  const onStarClick = useCallback((score) => {
    setScore(score)
    open()
  }, [open])
  const isAlreadyRated = useSelector(({app: {upskillingStarredSections = {}}}: RootState) =>
    // The empty string stands for the feedback from the main page.
    !!upskillingStarredSections[sectionId || ''])
  const hideIfAlreadyRated: React.CSSProperties = {
    maxHeight: isAlreadyRated ? 0 : 500,
    overflow: 'hidden',
    ...SmoothTransitions,
  }
  const title = sectionId ? t('Que pensez-vous de cette section\u00A0?') :
    t('Que pensez-vous de nos recommandations\u00A0?')
  const titleId = useMemo(_uniqueId, [])
  return <div aria-hidden={isAlreadyRated} style={{...hideIfAlreadyRated, ...style}}>
    <section style={sectionStyle}>
      <StarsModal
        starsDescribedby={titleId}
        {...{isShown, score, sectionId, setScore}} onClose={close} />
      <div style={innerStarBlockStyle}>
        <h2 style={h2Style} id={titleId}>{title}</h2>
        <FeedbackStars
          title={t<string>('Soyez honnête, nous lisons tous vos commentaires')} isWhite={true}
          isDark={true} score={score} onStarClick={onStarClick}
          aria-describedby={titleId} />
      </div>
    </section>
  </div>
}
export default React.memo(Stars)
