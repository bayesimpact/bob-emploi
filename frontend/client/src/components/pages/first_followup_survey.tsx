import _uniqueId from 'lodash/uniqueId'
import React, {Suspense, useCallback, useMemo, useState} from 'react'
import ReactDOM from 'react-dom'
import {useTranslation} from 'react-i18next'

import {ensureAuth} from 'store/actions'
import type {LocalizableString} from 'store/i18n'
import {init as i18nInit, localizeOptions, prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import {useAsynceffect} from 'store/promise'

import Button from 'components/button'
import LikertGrid from 'components/likert_grid'
import LikertScale from 'components/likert_scale'
import WaitingPage from 'components/pages/waiting'
import RadioGroup from 'components/radio_group'
import Textarea from 'components/textarea'

import 'styles/App.css'

import {AckFeedback, contentStyle as npsContentStyle, header, pageStyle} from './nps'

interface Params {
  answer?: string
  gender?: bayes.bob.Gender
  mainChallenge?: string
  token?: string
  user?: string
}
const prepareTNoExtract = prepareT

const {
  answer = '',
  gender = '',
  mainChallenge = '',
  user = '',
  token,
} = (parseQueryString(window.location.search) || {}) as Params

const yesNoOptions = [
  {name: prepareT('Non'), value: 'FALSE'},
  {name: prepareT('Oui\u00A0!'), value: 'TRUE'},
] as const

const _MAIN_CHALLENGES: {[challengeId: string]: LocalizableString} = {
  'bravo': prepareT("comment améliorer votre recherche d'emploi"),
  'enhance-methods-to-interview': prepareT('comment améliorer vos candidatures'),
  'find-what-you-like': prepareT('comment trouver un emploi qui vous plaît'),
  'missing-diploma': prepareT('quels programmes de formation sont disponibles'),
  'start-your-search': prepareT("comment démarrer votre recherche d'emploi"),
  'stuck-market': prepareT("comment améliorer votre recherche d'emploi dans un marché compétitif"),
  'undefined-project': prepareT('comment décider quel métier cibler'),
}

const somewhatAnswers = [
  {name: prepareT('Pas du tout'), value: 1},
  {name: prepareTNoExtract(''), value: 2},
  {name: prepareT('Assez'), value: 3},
  {name: prepareTNoExtract(''), value: 4},
  {name: prepareT('Beaucoup'), value: 5},
] as const

const opinionAnswers = [
  {name: prepareT("Pas du tout d'accord"), value: 1},
  {name: prepareTNoExtract(''), value: 2},
  {name: prepareT('Neutre'), value: 3},
  {name: prepareTNoExtract(''), value: 4},
  {name: prepareT("Tout à fait d'accord"), value: 5},
] as const

const opinionQuestions = [
  {
    id: 'newIdeasScore',
    name: prepareT(
      "{{productName}} m'a donné de nouvelles idées sur ce que je dois faire dans ma " +
        "recherche d'emploi.",
      {productName: config.productName},
    ),
  },
  {
    id: 'usefulResourceScore',
    name: prepareT(
      "{{productName}} m'a fourni des ressources et des informations utiles.",
      {productName: config.productName},
    ),
  },
  {
    id: 'helpsPlanScore',
    // i18next-extract-mark-context-next-line ["", "FEMININE", "MASCULINE"]
    name: prepareT(
      "{{productName}} m'a aidé·e à planifier ma recherche d'emploi.",
      {productName: config.productName},
    ),
  },
  {
    id: 'personalizedAdviceScore',
    name: prepareT(
      "{{productName}} m'a donné des conseils personnalisés sur la façon d'améliorer ma " +
        "recherche d'emploi.",
      {productName: config.productName},
    ),
  },
  {
    id: 'knewOwnNeedScore',
    name: prepareT("Je savais déjà ce que je devais travailler dans ma recherche d'emploi."),
  },
  {
    id: 'usefulScheduleScore',
    name: prepareT("J'ai trouvé utiles les options de planification de mon plan d'action."),
  },
] as const

type SFCR = bayes.bob.SetFFSCommentRequest
type ScoreField =
  {[F in keyof SFCR]: SFCR[F] extends number|undefined ? F : never}[keyof SFCR] & string

const likertScaleStyle: React.CSSProperties = {
  fontSize: '.875em',
  fontWeight: 'normal',
  marginTop: 10,
}

const textareaStyle: React.CSSProperties = {
  minHeight: 200,
  width: '100%',
}
const contentStyle: React.CSSProperties = {
  ...npsContentStyle,
  maxWidth: isMobileVersion ? 500 : 800,
}
const formStyle: React.CSSProperties = {
  margin: 'auto',
  maxWidth: 1000,
  padding: 50,
}
const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontWeight: 'bold',
}
const paragraphStyle: React.CSSProperties = {
  marginBottom: 20,
}
const simpleParagraphStyle: React.CSSProperties = {
  ...labelStyle,
  ...paragraphStyle,
}
const submitButtonContainerStyle: React.CSSProperties = {
  textAlign: 'center',
}

const useResponseField = <T extends keyof SFCR>(
  field: T,
  setResponse: (fromPrevious: ((sfcr: SFCR) => SFCR)) => void,
): [string, (newValue: bayes.bob.SetFFSCommentRequest[T]) => void] => {
  const id = useMemo(_uniqueId, [])
  const update = useCallback(
    (newValue: bayes.bob.SetFFSCommentRequest[T]) =>
      setResponse(SFCR => ({...SFCR, [field]: newValue})),
    [field, setResponse],
  )
  return [id, update]
}
const FormBase = (): React.ReactElement => {
  // TODO(cyrille): Consider using a specific namespace.
  const {t, t: translate} = useTranslation()
  const [response, setResponse] = useState<bayes.bob.SetFFSCommentRequest>({
    hasTriedSomethingNew: answer === 'yes' ? 'TRUE' : 'FALSE',
  })
  const [isSaving, setSaving] = useState(false)
  const [isSaved, setSaved] = useState(false)
  const handleSubmit = useCallback((event: React.SyntheticEvent) => {
    event.preventDefault?.()
    setSaving(true)
  }, [])
  useAsynceffect(async (checkIfCanceled) => {
    if (!isSaving) {
      return
    }
    // TODO(cyrille): Actually catch errors.
    try {
      await fetch(`/api/user/${user}/first-followup-survey`, {
        body: JSON.stringify(response),
        headers: {
          'Authorization': `Bearer ${ensureAuth(token)}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      if (!checkIfCanceled()) {
        setSaved(true)
      }
    } finally {
      if (!checkIfCanceled()) {
        setSaving(false)
      }
    }
  }, [isSaving, response])
  const [hasTriedSomethingNewId, updateTriedSomething] =
    useResponseField('hasTriedSomethingNew', setResponse)
  const [learnToMeetChallengeScoreId, updateLearnToMeetChallengeScore] =
    useResponseField('learnToMeetChallengeScore', setResponse)
  const updateOpinionScore = useCallback(
    (field: ScoreField, newValue: number) =>
      setResponse(SFCR => ({...SFCR, [field]: newValue})),
    [setResponse],
  )
  const [, updateComment] =
    useResponseField('comment', setResponse)
  const translatedSomewhatAnswers = useMemo(() => localizeOptions(t, somewhatAnswers), [t])
  const translatedOpinionAnswers = useMemo(() => localizeOptions(t, opinionAnswers), [t])
  const translatedOpinionQuestions = useMemo(
    () => localizeOptions(t, opinionQuestions, {context: gender}),
    [t],
  )
  if (isSaved) {
    return <AckFeedback score={10} />
  }
  return <form style={formStyle} onSubmit={handleSubmit}>
    <div style={simpleParagraphStyle}>
      <span id={hasTriedSomethingNewId}>{t(
        '{{productName}} vous a-t-il aidé·e à essayer quelque chose de nouveau dans votre ' +
          "recherche d'emploi\u00A0?",
        {context: gender, productName: config.productName},
      )}</span>
      <RadioGroup
        style={{justifyContent: 'space-around'}}
        onChange={updateTriedSomething} value={response.hasTriedSomethingNew}
        options={localizeOptions(t, yesNoOptions)} aria-labelledby={hasTriedSomethingNewId} />
    </div>
    <div style={simpleParagraphStyle}>
      <span id={learnToMeetChallengeScoreId}>{t(
        'En avez-vous appris plus sur {{mainChallenge}} grâce à {{productName}}\u00A0?',
        {
          mainChallenge: translate(
            ...(_MAIN_CHALLENGES[mainChallenge] || _MAIN_CHALLENGES['bravo']),
          ),
          productName: config.productName,
        },
      )}</span>
      <LikertScale
        onChange={updateLearnToMeetChallengeScore} value={response.learnToMeetChallengeScore}
        scale={translatedSomewhatAnswers} style={likertScaleStyle}
        aria-labelledby={learnToMeetChallengeScoreId} />
    </div>
    <section style={paragraphStyle}>
      <div style={labelStyle}>
        {t("Dans quelle mesure êtes-vous d'accord ou non avec les affirmations suivantes\u00A0:")}
      </div>
      <LikertGrid
        scale={translatedOpinionAnswers} questions={translatedOpinionQuestions}
        values={response} onChange={updateOpinionScore} isShownAsGrid={!isMobileVersion} />
    </section>
    <label style={simpleParagraphStyle}>
      {t(
        'Y a-t-il autre chose que vous aimeriez partager avec nous au sujet de votre expérience ' +
          'avec {{productName}}\u00A0?',
        {productName: config.productName},
      )}
      <Textarea
        placeholder={t('Saisissez un commentaire ici')}
        value={response.comment || ''} onChange={updateComment} style={textareaStyle} />
    </label>
    <div style={submitButtonContainerStyle}>
      <Button onClick={handleSubmit} isProgressShown={isSaving}>
        {t('Valider mes réponses')}
      </Button>
    </div>
  </form>
}
const Form = React.memo(FormBase)
const FirstFollowupSurveyPageBase = () => {
  return <div style={pageStyle}>
    {header}
    <div style={contentStyle}>
      <Form />
    </div>
  </div>
}
const FirstFollowupSurveyPage = React.memo(FirstFollowupSurveyPageBase)

i18nInit()

ReactDOM.render(<Suspense fallback={<WaitingPage />}>
  <FirstFollowupSurveyPage />
</Suspense>, document.getElementById('app'))
