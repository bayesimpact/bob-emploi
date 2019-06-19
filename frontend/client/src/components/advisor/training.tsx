import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {genderize, lowerFirstLetter, maybeContractPrefix, slugify, tutoyer} from 'store/french'
import {genderizeJob} from 'store/job'

import {ExternalLink, GrowingNumber} from 'components/theme'
import laBonneFormationImage from 'images/labonneformation-picto.png'
import NewPicto from 'images/advices/picto-training.svg'

import {MethodSuggestionList, CardProps, CardWithContentProps, EmailTemplate, TakeAwayTemplate,
  WithAdvice, WithAdviceData, connectExpandedCardWithContent} from './base'

const valueToColor = {
  // 0 is unknown
  0: 'initial',
  1: colors.RED_PINK,
  2: colors.BUTTERSCOTCH,
  3: colors.BOB_BLUE,
  4: colors.GREENISH_TEAL,
  5: colors.GREENISH_TEAL,
}

const valueToText = {
  // 0 is unknown
  0: 'Inconnu',
  1: 'Faible',
  2: 'Correct',
  3: 'Satisfaisant',
  4: 'Bon',
  5: 'Excellent',
}

class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.Trainings>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      trainings: PropTypes.arrayOf(PropTypes.shape({
        cityName: PropTypes.string,
        hiringPotential: PropTypes.number,
        name: PropTypes.string,
        url: PropTypes.string,
      }).isRequired),
    }).isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public static getTipsTemplates = (props):
  Pick<EmailTemplate['props'], 'content' | 'contentName' | 'title'>[] => {
    const {profile: {gender = undefined} = {}, project: {targetJob = undefined} = {},
      userYou = tutoyer} = props
    const jobName = lowerFirstLetter(genderizeJob(targetJob, gender))
    const ofJobName = maybeContractPrefix('de ', "d'", jobName)
    return [
      {
        content: `
Bonjour,

Je parlais à \\[prénom de ${userYou('ton', 'votre')} ami•e en commun\\] de mon projet de devenir
${jobName}, et elle/il m'a parlé de vous.

Je cherche des informations sur les formations nécessaires pour ce poste.
Je souhaiterais savoir si faire une formation de \\[intitulé de la formation\\] serait
essentiel pour être recruté${genderize('•e', 'e', '', gender)}.

Auriez-vous 15 minutes pour en discuter au téléphone, ou pour prendre un café ensemble\u00A0?

Merci beaucoup.

Bonne journée,
`,
        title: 'Demander aux gens qui font le métier visé',
      },
      {
        content: `
J'ai des questions à propos de votre offre de \\[titre de l'offre\\]. Est-ce qu'une expérience
de \\[années d'experience\\] serait suffisante même si
${genderize('le•a candidat•e', 'la candidate', 'le candidat', gender)} n'a pas de diplôme\u00A0?
`,
        contentName: 'comment demander',
        title: 'Téléphoner aux recruteurs pour connaitre leurs critères',
      },
      {
        content: `
Bonjour,

Je m'intéresse à la possibilité de faire une formation pour le poste ${ofJobName}.

Serait-il possible de convenir d'un rendez-vous afin d'en discuter\u00A0?

Je suis disponible cette semaine, et la semaine prochaine, à votre convenance.

Je vous remercie pour votre réponse.

Bien cordialement,
`,
        title: 'Demander à son conseiller emploi',
      },
    ]
  }

  private createLBFLink(): string {
    // TODO(cyrille): Make a working link.
    const domain = slugify(this.props.project.targetJob.jobGroup.name)
    return `https://labonneformation.pole-emploi.fr/formations/${domain}/france`
  }

  private getFooter = (): React.ReactNode => {
    const {userYou} = this.props
    // TODO(cyrille): DRY this up in base.tsx.
    const linkStyle = {
      color: colors.BOB_BLUE,
      textDecoration: 'none',
    }
    return <React.Fragment>
      <img
        style={{height: 20, marginRight: 10}} src={laBonneFormationImage}
        alt="la bonne formation" />
      Trouve{userYou('', 'z')} une formation et lis{userYou('', 'ez')} des témoignages
      sur <ExternalLink
        style={linkStyle} href={this.createLBFLink()}>labonneformation.fr</ExternalLink>
    </React.Fragment>
  }

  private renderTips(): React.ReactNode {
    const {adviceData: {trainings = []}, handleExplore, userYou} = this.props
    const templates = ExpandedAdviceCardContentBase.getTipsTemplates(this.props)
    if (!templates.length) {
      return null
    }
    const title = <React.Fragment>
      <GrowingNumber number={templates.length} isSteady={true} />
      {' '}astuce{templates.length > 1 ? 's' : ''} pour savoir quelle formation
      il {userYou('te', 'vous')} faudrait
    </React.Fragment>
    const footer = trainings.length ? null : this.getFooter()
    return <MethodSuggestionList title={title} footer={footer}>
      {templates.map((template, index): ReactStylableElement => <EmailTemplate
        onContentShown={handleExplore('tip')}
        key={index} userYou={userYou} {...template} isMethodSuggestion={true} />)}
    </MethodSuggestionList>
  }

  private renderTrainings(style): React.ReactNode {
    const {adviceData: {trainings = []}, handleExplore, userYou} = this.props
    if (!trainings.length) {
      return null
    }
    const title = <React.Fragment>
      <GrowingNumber number={trainings.length} isSteady={true} />
      {' '}exemple{trainings.length > 1 ? 's' : ''} de formation près de
      chez {userYou('toi', 'vous')}
    </React.Fragment>
    return <MethodSuggestionList title={title} footer={this.getFooter()} style={style}>
      {trainings.map((training, index): ReactStylableElement => <TrainingSuggestion
        onClick={handleExplore('training')} training={training} key={index} />)}
    </MethodSuggestionList>
  }

  public render(): React.ReactNode {
    const tipsSection = this.renderTips()
    return <div>
      {tipsSection}
      {this.renderTrainings(tipsSection ? {marginTop: 20} : {})}
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.Trainings, CardProps>()(
    ExpandedAdviceCardContentBase)


interface SuggestionProps {
  onClick: () => void
  style?: React.CSSProperties
  training?: bayes.bob.Training
}


class TrainingSuggestionBase extends React.PureComponent<SuggestionProps> {
  public static propTypes = {
    onClick: PropTypes.func.isRequired,
    style: PropTypes.string,
    training: PropTypes.shape({
      cityName: PropTypes.string,
      hiringPotential: PropTypes.number,
      name: PropTypes.string,
      url: PropTypes.string,
    }).isRequired,
  }

  private renderBoxes(score): React.ReactNode {
    if (!score) {
      return null
    }

    const boxStyle: React.CSSProperties = {
      display: 'inline-block',
      height: 10,
      marginRight: 1,
      width: 20,
    }
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      marginLeft: 10,
    }

    const selectedColor = valueToColor[score]
    const defaultColor = colors.MODAL_PROJECT_GREY
    // There might be a more elegant way to do that, but it would be overkill and less readable.
    return <div style={containerStyle}>
      <div style={{color: valueToColor[score], textAlign: 'center'}}>
        {valueToText[score]}
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
  }

  public render(): React.ReactNode {
    const {onClick, training: {cityName, name, hiringPotential, url}, style} = this.props
    const containerStyle: React.CSSProperties = {
      color: 'inherit',
      textDecoration: 'none',
      ...style,
      fontWeight: 'normal',
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
    return <ExternalLink style={containerStyle} onClick={onClick} href={url}>
      <span style={trainingStyle}>
        <strong>{name}</strong> - {cityName}
      </span>
      <div style={{flex: 1}} />
      {this.renderBoxes(hiringPotential)}
      <ChevronRightIcon style={chevronStyle} />
    </ExternalLink>
  }
}
const TrainingSuggestion = Radium(TrainingSuggestionBase)


class TakeAwayBase extends React.PureComponent<WithAdviceData<bayes.bob.Trainings> & WithAdvice> {
  public render(): React.ReactNode {
    const {trainings = []} = this.props.adviceData
    if (trainings.length) {
      return <TakeAwayTemplate found="formation" isFeminine={true} list={trainings} />
    }
    const tips = ExpandedAdviceCardContentBase.getTipsTemplates({})
    return <TakeAwayTemplate found="astuce" isFeminine={true} list={tips} />
  }
}
const TakeAway = connectExpandedCardWithContent<{}, bayes.bob.Trainings, WithAdvice>()(TakeAwayBase)

export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
