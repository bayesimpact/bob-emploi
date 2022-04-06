import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useRef, useState} from 'react'
import {useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useSafeDispatch} from 'store/promise'

import {InertButton} from 'components/button'
import ExternalLink from 'components/external_link'
import type {ModalConfig} from 'components/modal'
import RadioGroup from 'components/radio_group'

import type {DispatchAllUpskillingActions} from '../../store/actions'
import {closeCoachingModalAction, registerCoachingUpskillingAction} from '../../store/actions'
import Modal from '../../components/modal'
import type {Submitable} from '../../components/job_evaluation'
import {EvalSection, JobEvalButtons} from '../../components/job_evaluation'

const booleanOptions = [
  {name: 'non', value: false},
  {name: 'oui', value: true},
]
const invertedBooleanOptions = [
  {name: 'non', value: true},
  {name: 'oui', value: false},
]

const radioChildStyle: React.CSSProperties = {
  marginRight: 10,
}
const modalStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_BACKGROUND,
  color: colors.TEXT,
  fontSize: 15,
  margin: isMobileVersion ? 20 : 10,
  padding: 40,
}
const whoDivStyle: React.CSSProperties = {
  color: colors.JOB_DESCRIPTION_TEXT,
  fontSize: 12,
  fontStyle: 'italic',
  marginTop: 20,
  textAlign: 'center',
}
const discreetLinkStyle: React.CSSProperties = {
  color: 'inherit',
}
const titleStyle: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: 21,
  marginBottom: 32,
  marginTop: 0,
}
type Props = Omit<ModalConfig, 'isShown' | 'onClose' | 'children' | 'style'>
const CoachingModal = (props: Props): React.ReactElement|null => {
  const {...modalProps} = props
  const [job, sectionId, visualElement] = useSelector(
    ({app: {upskillingJobForCoaching}}: RootState) => upskillingJobForCoaching,
    (job1, job2) => job1?.[0].jobGroup?.romeId === job2?.[0].jobGroup?.romeId,
  ) || []
  const hasEval = useSelector(({app: {upskillingEvaluatedJobs}}: RootState): boolean =>
    !upskillingEvaluatedJobs?.some(({jobGroup: {romeId}}) => romeId === job?.jobGroup.romeId))
  const isShown = !!job
  const {postcodes = '', name: cityName} =
    useSelector(({user: {projects: [{city = {}} = {}] = []}}: RootState) => city)
  const dispatch = useSafeDispatch<DispatchAllUpskillingActions>()
  const title = visualElement === 'after-save' ?
    'Vous pouvez vous entretenir avec un conseiller pour réaliser votre projet.' :
    'Avant de démarrer, dites-nous en plus sur votre situation'
  const ref = useRef<Submitable>(null)
  const onClose = useCallback(() => void dispatch(closeCoachingModalAction), [dispatch])
  const [isEmployed, setIsEmployed] = useState<boolean>()
  const employmentQuestionId = useMemo(_uniqueId, [])
  const [isManagement, setIsManagement] = useState<boolean>()
  const managementQuestionId = useMemo(_uniqueId, [])
  const [isMiLo, setIsMiLo] = useState<boolean>()
  const miLoQuestionId = useMemo(_uniqueId, [])
  const isFormValid = ![isEmployed, isManagement, isMiLo].
    some(field => typeof field === 'undefined')
  const bestLink = isMiLo ?
    `https://mon-cep.org/carte?codePostal=${postcodes.split('-')[0]}&libelleDAcheminement=${cityName}&distance=30&type=MISSION_LOCALE` :
    isManagement ? 'https://www.apec.fr/candidat/les-services-apec/rendez-vous-conseil.html#/rendezVousConseil' : // checkURL
      isEmployed ? 'https://www.mon-service-cep.fr/rappelez-moi?cep=30&utm_source=Transitions+Pro&utm_medium=Site+Web&utm_campaign=Publicité+ARA' : // checkURL
        'https://www.pole-emploi.fr/candidat/vos-services-en-ligne/les-pas-a-pas-les-videos-qui-vou/comment-contacter-mon-conseiller.html' // checkURL
  const onSubmit = useCallback((event: React.SyntheticEvent) => {
    if (!isFormValid) {
      // TODO(cyrille): Add an error message.
      event.preventDefault()
      return
    }
    dispatch(registerCoachingUpskillingAction(new URL(bestLink)))
    ref.current?.submit()
    onClose()
  }, [bestLink, dispatch, isFormValid, onClose])
  const miloTitle =
    'Avez-vous plus de 26 ans ou un diplôme au moins égal à la licence (Bac+3)\u00A0?'

  return <Modal {...modalProps} {...{isShown, onClose}} style={modalStyle}>
    <div style={{maxWidth: isMobileVersion ? 255 : 500}}>
      <h2 style={titleStyle}>{title}</h2>
      <form>
        {hasEval ? <JobEvalButtons visualElement="coaching" {...{job, ref, sectionId}} /> : null}
        <EvalSection
          titleId={employmentQuestionId} title="Êtes-vous demandeur d'emploi&nbsp;?">
          <RadioGroup
            aria-labelledby={employmentQuestionId}
            onChange={setIsEmployed} childStyle={radioChildStyle}
            options={invertedBooleanOptions} value={isEmployed} />
        </EvalSection>
        <EvalSection title="Êtes-vous cadre&nbsp;?" titleId={managementQuestionId}>
          <RadioGroup
            onChange={setIsManagement} childStyle={radioChildStyle}
            options={booleanOptions} value={isManagement}
            aria-labelledby={managementQuestionId} />
        </EvalSection>
        <EvalSection title={miloTitle} titleId={miLoQuestionId}>
          <RadioGroup
            aria-labelledby={miLoQuestionId}
            onChange={setIsMiLo} childStyle={radioChildStyle}
            options={invertedBooleanOptions} value={isMiLo} />
        </EvalSection>
      </form>
      <div style={{margin: '10px 0', textAlign: 'center'}}>
        <ExternalLink onClick={onSubmit} href={bestLink}>
          <InertButton type="navigation" disabled={!isFormValid}>
            Prendre contact avec un conseiller
          </InertButton>
        </ExternalLink>
      </div>
      <div style={whoDivStyle}>
        Créé avec <span aria-label="amour" role="img">❤️</span> par l'ONG <ExternalLink
          href="https://www.bayesimpact.org" style={discreetLinkStyle}>
          Bayes Impact
        </ExternalLink>.
      </div>
    </div>
  </Modal>
}

export default React.memo(CoachingModal)
