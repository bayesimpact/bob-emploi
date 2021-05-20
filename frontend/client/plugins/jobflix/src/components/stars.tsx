import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import {ModalConfig, useModal} from 'components/modal'
import {FeedbackStars} from 'components/pages/connected/project/feedback_bar'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import Modal from './modal'

import {DispatchAllUpskillingActions, sendUpskillingFeedback} from '../store/actions'

type ModalProps = Omit<ModalConfig, 'children' | 'style'> & {
  onClose: () => void
  score: number
  sectionId?: string
  setScore: (score: number) => void
}

const modalStyle: React.CSSProperties = {
  backgroundColor: colors.PURPLISH_BROWN,
  color: '#fff',
  fontSize: isMobileVersion ? 15 : 19,
  margin: isMobileVersion ? 20 : 10,
  padding: isMobileVersion ? 30 : 50,
}
const modalStarsStyle: React.CSSProperties = {
  textAlign: 'initial',
}
const textAreaStyle: React.CSSProperties = {
  backgroundColor: colors.PURPLISH_BROWN_TWO,
  border: 'none',
  borderRadius: 3,
  color: colors.WHITE_TWO,
  fontFamily: 'Lato',
  fontSize: 15,
  margin: '35px 0',
  minHeight: 120,
  padding: 15,
  width: '100%',
}
const sendEvalButtonStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 14 : 15,
  padding: isMobileVersion ? '17px 11px' : 'initial',
}
const StarsModalBase = (props: ModalProps): React.ReactElement|null => {
  const {isShown, onClose, score, sectionId, setScore, ...modalProps} = props
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
  return <Modal {...modalProps} {...{isShown, onClose}} style={modalStyle}>
    <div style={{maxWidth: 560}}>
      <FeedbackStars
        style={modalStarsStyle}
        isWhite={true} score={score} title={false} levels={false} onStarClick={setScore} />
      <h2 style={{fontSize: isMobileVersion ? 22 : 35, margin: '5px 0'}}>{title}</h2>
      <div>{subtitle}</div>
      <Textarea
        style={textAreaStyle} placeholder={t('Saisissez un commentaire ici (Facultatif)')}
        value={feedback} onChange={setFeedback} />
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

const Stars = ({sectionId, style}: Props): null|React.ReactElement => {
  const {t} = useTranslation()
  const sectionStyle: React.CSSProperties = {
    backgroundColor: colors.PURPLISH_BROWN,
    padding: 30,
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
  return <div aria-hidden={isAlreadyRated} style={{...hideIfAlreadyRated, ...style}}>
    <section style={sectionStyle}>
      <StarsModal {...{isShown, score, sectionId, setScore}} onClose={close} />
      <h2 style={{margin: 0}}>{title}</h2>
      <FeedbackStars
        title={t<string>('Soyez honnête, nous lisons tous vos commentaires')} isWhite={true}
        levels={false} score={score} onStarClick={onStarClick} />
    </section>
  </div>
}
export default React.memo(Stars)
