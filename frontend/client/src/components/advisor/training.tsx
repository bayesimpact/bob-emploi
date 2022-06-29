import type {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo, useState} from 'react'

import type {GetTipsProps} from 'deployment/training'
import {getTips, websites} from 'deployment/training'

import {lowerFirstLetter, ofJobName} from 'store/french'
import {genderizeJob} from 'store/job'
import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import {useAsynceffect} from 'store/promise'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import {fetchCityByAdmin2Code} from 'components/city_input'

import type {CardProps} from './base'
import {EmailTemplate, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const


const valueToColor = {
  // 0 is unknown
  0: 'initial',
  1: colors.RED_PINK,
  2: colors.BUTTERSCOTCH,
  3: colors.BOB_BLUE,
  4: colors.GREENISH_TEAL,
  5: colors.GREENISH_TEAL,
} as const

const valueToText: {[K in keyof typeof valueToColor]: LocalizableString} = {
  // 0 is unknown
  0: prepareT('Inconnu'),
  1: prepareT('Faible'),
  2: prepareT('Correct'),
  3: prepareT('Satisfaisant'),
  4: prepareT('Bon'),
  5: prepareT('Excellent'),
} as const

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
}

// The training method is built with 2 sections:
// - a list of tips
// - a list of training sessions, replaced by a list of websites if we have none.

const TrainingMethod = (props: CardProps): React.ReactElement => {
  const {
    handleExplore,
    profile, profile: {gender = undefined} = {},
    project, project: {targetJob = undefined, city: {departementId = undefined} = {}} = {},
    t,
  } = props
  const {data, data: {trainings = emptyArray}, loading} = useAdviceData<bayes.bob.Trainings>(props)

  const onContentShown = handleExplore('tip')
  const jobName = lowerFirstLetter(genderizeJob(targetJob, gender))
  const commonTips = useMemo((): GetTipsProps['commonTips'] => ({
    coach: <EmailTemplate
      onContentShown={onContentShown} key="coach"
      title={t('Demander à son conseiller emploi')}
      content={t(`Bonjour,

Je m'intéresse à la possibilité de faire une formation pour le poste {{ofJobName}}.

Serait-il possible de convenir d'un rendez-vous afin d'en discuter\u00A0?

Je suis disponible cette semaine, et la semaine prochaine, à votre convenance.

Je vous remercie pour votre réponse.

Bien cordialement,
`, {ofJobName: ofJobName(jobName, t)})} />,
    friend: <EmailTemplate
      key="friend" onContentShown={onContentShown}
      title={t('Demander aux gens qui font le métier visé')}
      content={t(`Bonjour,

Je parlais à \\[prénom de votre ami·e en commun\\] de mon projet de devenir
{{jobName}}, et elle/il m'a parlé de vous.

Je cherche des informations sur les formations nécessaires pour ce poste.
Je souhaiterais savoir si faire une formation de \\[intitulé de la formation\\] serait
essentiel pour être recruté·e.

Auriez-vous 15 minutes pour en discuter au téléphone, ou pour prendre un café ensemble\u00A0?

Merci beaucoup.

Bonne journée,
`, {jobName})} />,
    recruiter: <EmailTemplate
      key="recruiter" onContentShown={onContentShown}
      title={t('Téléphoner aux recruteurs pour connaitre leurs critères')}
      contentName={t('comment demander')}
      content={t(
        "J'ai des questions à propos de votre offre de \\[titre de l'offre\\]. Est-ce qu'une " +
        "expérience de \\[années d'experience\\] serait suffisante même si le·a candidat·e n'a " +
        'pas de diplôme\u00A0?')} />,
  }), [t, jobName, onContentShown])
  const {isOrdered, tips} = useMemo(
    () => getTips({commonTips, data, onContentShown, profile, project, t}),
    [commonTips, data, onContentShown, profile, project, t],
  )

  const tipsSection = useMemo((): React.ReactNode => {
    if (!tips.length) {
      return null
    }
    const stepOrTip = isOrdered ?
      t('étape', {count: tips.length}) : t('astuce', {count: tips.length})
    const title = <Trans parent={null} t={t}>
      <GrowingNumber number={tips.length} isSteady={true} /> {{stepOrTip}} pour savoir quelle
      formation il vous faudrait
    </Trans>
    return <MethodSuggestionList title={title} style={sectionStyle}>
      {tips}
    </MethodSuggestionList>
  }, [isOrdered, t, tips])

  const trainingsSection = useMemo((): React.ReactNode => {
    if (!trainings.length) {
      return null
    }
    const title = <Trans parent={null} t={t} count={trainings.length}>
      <GrowingNumber number={trainings.length} isSteady={true} />
      {' '}exemple de formation près de chez vous
    </Trans>
    return <MethodSuggestionList title={title}>
      {trainings.map((training, index): ReactStylableElement => <TrainingSuggestion
        onClick={handleExplore('training')} training={training} key={index} t={t}
        departementId={departementId} />)}
    </MethodSuggestionList>
  }, [departementId, t, handleExplore, trainings])

  const trainingWebsites = useMemo((): React.ReactNode|null => {
    if (!websites.length) {
      return null
    }
    const title = <Trans parent={null} t={t} count={websites.length}>
      <GrowingNumber number={websites.length} isSteady={true} /> sites pour découvrir
      des formations</Trans>
    const containerStyle: React.CSSProperties = {
      color: 'inherit',
      height: 70,
      padding: '15px 20px',
      textDecoration: 'none',
    }
    const logoContainerStyle: React.CSSProperties = {
      alignItems: 'center',
      border: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      boxSizing: 'border-box',
      display: 'flex',
      height: 40,
      justifyContent: 'center',
      marginRight: 20,
      width: 42,
    }
    const logoStyle: React.CSSProperties = {
      width: 30,
    }
    return <MethodSuggestionList title={title}>
      {websites.map((website, index): ReactStylableElement =>
        <RadiumExternalLink href={website.url} key={index} style={containerStyle}>
          <div style={logoContainerStyle}><img src={website.logo} alt="" style={logoStyle} /></div>
          {website.name}
          <div style={{flex: 1}} />
          <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
        </RadiumExternalLink>)}
    </MethodSuggestionList>
  }, [t])
  if (loading) {
    return loading
  }
  return <div>
    {tipsSection}
    {trainings.length ? trainingsSection : trainingWebsites}
  </div>
}
const ExpandedAdviceCardContent = React.memo(TrainingMethod)


interface SuggestionProps {
  departementId?: string
  onClick: () => void
  style?: RadiumCSSProperties
  t: TFunction
  training?: bayes.bob.Training
}


const trainingStyle: React.CSSProperties = {
  fontStyle: 'italic',
  marginRight: 10,
}
const chevronStyle: React.CSSProperties = {
  fill: colors.CHARCOAL_GREY,
  flexShrink: 0,
  height: 20,
  lineHeight: 1,
  padding: '0 0 0 10px',
  width: 30,
}
const boxStyle: React.CSSProperties = {
  display: 'inline-block',
  height: 10,
  marginRight: 1,
  width: 20,
}
const boxesContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 10,
}


const TrainingSuggestionBase = (props: SuggestionProps): React.ReactElement => {
  const {departementId, onClick, training: {
    cityName = '',
    name = '',
    hiringPotential: score = undefined,
    url = undefined,
  } = {}, style, t: translate} = props
  const boxes = useMemo((): React.ReactNode => {
    const scoreKey = score as keyof typeof valueToColor
    if (!score || !valueToColor[scoreKey]) {
      return null
    }
    const selectedColor = valueToColor[scoreKey]
    const defaultColor = colors.MODAL_PROJECT_GREY
    // There might be a more elegant way to do that, but it would be overkill and less readable.
    return <div style={boxesContainerStyle}>
      <div style={{color: valueToColor[scoreKey], textAlign: 'center'}}>
        {translate(...valueToText[scoreKey])}
      </div>
      <div style={{width: 105}}>
        <div style={{...boxStyle, backgroundColor: selectedColor, borderRadius: '20px 0 0 20px'}} />
        <div style={{...boxStyle, backgroundColor: score > 1 ? selectedColor : defaultColor}} />
        <div style={{...boxStyle, backgroundColor: score > 2 ? selectedColor : defaultColor}} />
        <div style={{...boxStyle, backgroundColor: score > 3 ? selectedColor : defaultColor}} />
        <div style={{...boxStyle, backgroundColor: score > 4 ? selectedColor : defaultColor,
          borderRadius: '0 20px 20px 0'}} />
      </div>
    </div>
  }, [score, translate])

  const [cityDisplay, setCityDisplay] = useState(cityName)
  // The training is available in their departement, so that's why we use this city
  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    if (cityName) {
      setCityDisplay(cityName)
      return
    }
    const city = await fetchCityByAdmin2Code(departementId)
    if (checkIfCanceled() || !city || !city.name) {
      return
    }
    setCityDisplay(city.name)
  }, [cityName, departementId])
  const containerStyle = useMemo((): React.CSSProperties => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
    fontWeight: 'normal',
  }), [style])
  return <RadiumExternalLink style={containerStyle} onClick={onClick} href={url}>
    <span style={trainingStyle}>
      <strong>{name}</strong> - {cityDisplay}
    </span>
    <div style={{flex: 1}} />
    {boxes}
    <ChevronRightIcon style={chevronStyle} />
  </RadiumExternalLink>
}
const TrainingSuggestion = React.memo(TrainingSuggestionBase)


export default {ExpandedAdviceCardContent, pictoName: 'rocket' as const}
