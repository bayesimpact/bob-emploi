import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {lowerFirstLetter, maybeContractPrefix, slugify} from 'store/french'
import {genderizeJob} from 'store/job'

import {Trans} from 'components/i18n'
import {RadiumExternalLink} from 'components/radium'
import {ExternalLink, GrowingNumber} from 'components/theme'
import laBonneFormationImage from 'images/labonneformation-picto.png'
import Picto from 'images/advices/picto-training.svg'

import {MethodSuggestionList, CardProps, EmailTemplate, EmailTemplateProps,
  HandyLink, useAdviceData} from './base'


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

const valueToText: {[K in keyof typeof valueToColor]: string} = {
  // 0 is unknown
  0: 'Inconnu',
  1: 'Faible',
  2: 'Correct',
  3: 'Satisfaisant',
  4: 'Bon',
  5: 'Excellent',
} as const


const HANDICAP_FOOTER = <HandyLink
  linkIntro="Se renseigner sur les aides formation pour les gens en situation de handicap&nbsp;:"
  href="https://www.pole-emploi.fr/candidat/travailleurs-handicapes-@/article.jspz?id=60726">
  Pôle emploi
</HandyLink>


// TODO(cyrille): Make a working link.
function createLBFLink(domain?: string): string {
  if (!domain) {
    return 'https://labonneformation.pole-emploi.fr/formations/'
  }
  return `https://labonneformation.pole-emploi.fr/formations/${domain}/france`
}


const TrainingMethod = (props: CardProps): React.ReactElement => {
  const {
    handleExplore,
    profile: {gender = undefined, hasHandicap = false} = {},
    project: {targetJob = undefined} = {},
    t,
  } = props
  const {trainings = emptyArray} = useAdviceData<bayes.bob.Trainings>(props)

  const tipsTemplates = useMemo(
    (): readonly Pick<EmailTemplateProps, 'content' | 'contentName' | 'title'>[] => {
      const jobName = lowerFirstLetter(genderizeJob(targetJob, gender))
      const ofJobName = maybeContractPrefix('de ', "d'", jobName)
      const counselorTip = {
        content: t(`
Bonjour,

Je m'intéresse à la possibilité de faire une formation pour le poste {{ofJobName}}.

Serait-il possible de convenir d'un rendez-vous afin d'en discuter\u00A0?

Je suis disponible cette semaine, et la semaine prochaine, à votre convenance.

Je vous remercie pour votre réponse.

Bien cordialement,
`, {ofJobName}),
        title: hasHandicap ?
          t('Demander à son conseiller Cap emploi') : t('Demander à son conseiller emploi'),
      }
      return [
        ...hasHandicap && [
          counselorTip,
          {
            content: t(`
Ne tombez pas dans les pièges de formation d'agent administratif.

C'est un métier qui se transforme, et beaucoup de centres de formation ne se sont pas adaptés.

Commencez par vous demander ce qui vous intéresse réellement.
`),
            contentName: t("l'astuce Hanploi"),
            title: t('Prendre conscience des pièges à éviter'),
          },
        ] || [],
        {
          content: t(`
Bonjour,

Je parlais à \\[prénom de votre ami·e en commun\\] de mon projet de devenir
{{jobName}}, et elle/il m'a parlé de vous.

Je cherche des informations sur les formations nécessaires pour ce poste.
Je souhaiterais savoir si faire une formation de \\[intitulé de la formation\\] serait
essentiel pour être recruté·e.

Auriez-vous 15 minutes pour en discuter au téléphone, ou pour prendre un café ensemble\u00A0?

Merci beaucoup.

Bonne journée,
`, {context: gender, jobName}),
          title: t('Demander aux gens qui font le métier visé'),
        },
        {
          content: t(`
J'ai des questions à propos de votre offre de \\[titre de l'offre\\]. Est-ce qu'une expérience
de \\[années d'experience\\] serait suffisante même si le·a candidat·e n'a pas de diplôme\u00A0?
`, {context: gender}),
          contentName: t('comment demander'),
          title: t('Téléphoner aux recruteurs pour connaitre leurs critères'),
        },
        ...hasHandicap && [] || [counselorTip],
      ]
    }, [gender, hasHandicap, t, targetJob])

  const footer = useMemo((): React.ReactNode => {
    const {jobGroup: {name = undefined} = {}} = targetJob || {}
    const domain = name && slugify(name)
    // TODO(cyrille): DRY this up in base.tsx.
    const linkStyle = {
      color: colors.BOB_BLUE,
      textDecoration: 'none',
    }
    return <Trans parent={null} t={t}>
      <img
        style={{height: 20, marginRight: 10}} src={laBonneFormationImage}
        alt="la bonne formation" />
      Trouvez une formation et lisez des témoignages sur <ExternalLink
        style={linkStyle} href={createLBFLink(domain)}>labonneformation.fr</ExternalLink>
    </Trans>
  }, [t, targetJob])

  const tipsSection = useMemo((): React.ReactNode => {
    const templates = tipsTemplates
    if (!templates.length) {
      return null
    }
    const stepOrTip = hasHandicap ?
      t('étape', {count: templates.length}) : t('astuce', {count: templates.length})
    const title = <Trans parent={null} t={t}>
      <GrowingNumber number={templates.length} isSteady={true} /> {{stepOrTip}} pour savoir quelle
      formation il vous faudrait
    </Trans>
    const listFooter = hasHandicap ? HANDICAP_FOOTER : trainings.length ? null : footer
    return <MethodSuggestionList title={title} footer={listFooter}>
      {templates.map((template, index): ReactStylableElement => <EmailTemplate
        onContentShown={handleExplore('tip')}
        key={index} {...template} isMethodSuggestion={true} />)}
    </MethodSuggestionList>
  }, [trainings, footer, handleExplore, hasHandicap, t, tipsTemplates])

  const wrapperStyle = useMemo(
    (): React.CSSProperties => tipsSection ? {marginTop: 20} : {},
    [tipsSection],
  )
  const renderTrainings = useMemo((): React.ReactNode => {
    if (!trainings.length) {
      return null
    }
    const title = <Trans parent={null} t={t} count={trainings.length}>
      <GrowingNumber number={trainings.length} isSteady={true} />
      {' '}exemple de formation près de chez vous
    </Trans>
    return <MethodSuggestionList title={title} footer={footer} style={wrapperStyle}>
      {trainings.map((training, index): ReactStylableElement => <TrainingSuggestion
        onClick={handleExplore('training')} training={training} key={index} />)}
    </MethodSuggestionList>
  }, [footer, t, handleExplore, trainings, wrapperStyle])

  return <div>
    {tipsSection}
    {renderTrainings}
  </div>
}
TrainingMethod.propTypes = {
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(TrainingMethod)


interface SuggestionProps {
  onClick: () => void
  style?: RadiumCSSProperties
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
  const {onClick, training: {
    cityName = '',
    name = '',
    hiringPotential: score = undefined,
    url = undefined,
  } = {}, style} = props
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
        {valueToText[scoreKey]}
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
  }, [score])

  const containerStyle = useMemo((): React.CSSProperties => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
    fontWeight: 'normal',
  }), [style])
  return <RadiumExternalLink style={containerStyle} onClick={onClick} href={url}>
    <span style={trainingStyle}>
      <strong>{name}</strong> - {cityName}
    </span>
    <div style={{flex: 1}} />
    {boxes}
    <ChevronRightIcon style={chevronStyle} />
  </RadiumExternalLink>
}
TrainingSuggestionBase.propTypes = {
  onClick: PropTypes.func.isRequired,
  style: PropTypes.object,
  training: PropTypes.shape({
    cityName: PropTypes.string,
    hiringPotential: PropTypes.number,
    name: PropTypes.string,
    url: PropTypes.string,
  }).isRequired,
}
const TrainingSuggestion = React.memo(TrainingSuggestionBase)


export default {ExpandedAdviceCardContent, Picto}
