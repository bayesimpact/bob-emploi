import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {YouChooser} from 'store/french'

import {RadiumExternalLink} from 'components/radium'
import {ExternalLink, GrowingNumber, Tag, VideoFrame} from 'components/theme'
import immersionVideoPoster from 'images/advices/immersion_video_poster.png'
import Picto from 'images/advices/picto-immersion.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const pmsmpEmailContent = (name, eFeminine): string => `Chère Madame, cher Monsieur,\n\n

J'ai commencé à construire un projet d'orientation vers le métier de .....

J'ai vu que j'avais la possibilité de faire un stage d'immersion (PMSMP), et je suis
convaincu${eFeminine} que cela m'aiderait à valider mon projet. J'ai trois objectifs\u00A0:

1. essayer le métier pour confirmer ma motivation
2. obtenir une expérience récente sur mon CV pour m'aider à postuler dans ce métier
3. avoir un premier contact dans le milieu

Pourrions-nous convenir d'un rendez-vous pour en discuter\u00A0?
Auriez-vous des disponibilités cette semaine\u00A0?
Merci.

Bien cordialement,

${name}`

interface ImmersionElementProps {
  isFree?: boolean
  isForYou?: boolean
  subtitle: string
  title: string
  url: string
}

interface ImmersionLinkProps extends ImmersionElementProps {
  style?: RadiumCSSProperties
  userYou: YouChooser
}

const links: ImmersionElementProps[] = [
  {
    isForYou: true,
    subtitle: 'Pour essayer les métiers manuels',
    title: 'Savoir-Faire et Découverte',
    url: 'http://www.lesavoirfaire.fr/',
  },
  {
    isForYou: true,
    isFree: true,
    subtitle: 'Pour essayer des métiers en voyageant',
    title: 'WorkAway',
    url: 'https://www.workaway.info/index-fr.html',
  },
  {
    isForYou: true,
    subtitle: 'Pour faire des mini-stages de 1 à 30 jours',
    title: 'Test un métier',
    url: 'https://www.testunmetier.com/',
  },
  {
    isForYou: true,
    subtitle: 'Pour faire des mini-stages de 1 à 5 jours',
    title: 'Test un job',
    url: 'https://www.testmonjob.fr/',
  },
  {
    isFree: true,
    subtitle: 'Pour les stages de troisième',
    title: 'Viens voir mon taf',
    url: 'https://www.viensvoirmontaf.fr/',
  },
  {
    isFree: true,
    subtitle: 'Pour les stages de troisième',
    title: 'Mon stage de troisième',
    url: 'https://www.monstagedetroisieme.fr/',
  },
]

const tagStyle: React.CSSProperties = {
  backgroundColor: colors.BOB_BLUE,
  borderRadius: 3,
  color: '#fff',
  fontSize: 11,
  fontStyle: 'italic',
  fontWeight: 'normal',
  marginLeft: 5,
  // skewed padding to center italic font horizontally.
  padding: '2px 6px 2px 4px',
  textTransform: 'none',
}

const subtitleStyle: React.CSSProperties = {
  color: colors.WARM_GREY,
  fontStyle: 'italic',
  fontWeight: 'normal',
  marginTop: 3,
}

const getContainerStyle = (style?: React.CSSProperties): React.CSSProperties => ({
  color: 'inherit',
  display: 'block',
  textDecoration: 'none',
  ...style,
})

const ImmersionLinkBase: React.FC<ImmersionLinkProps> =
  (props: ImmersionLinkProps): React.ReactElement => {
    const {isForYou, isFree, style: propsStyle, subtitle, title, url, userYou} = props
    const style = useMemo(() => getContainerStyle(propsStyle), [propsStyle])

    return <RadiumExternalLink href={url} style={style}>
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <span>
          {title}<span style={{fontStyle: 'italic'}}>{isFree ? null : ' (payant)'}</span>
          {isForYou ? <Tag style={tagStyle}>Pour {userYou('toi', 'vous')}</Tag> : null}
        </span>
        <span style={subtitleStyle}>{subtitle}</span>
      </div>
      <ChevronRightIcon size={16} style={{flex: 'none'}} />
    </RadiumExternalLink>
  }
ImmersionLinkBase.propTypes = {
  isForYou: PropTypes.bool,
  isFree: PropTypes.bool,
  style: PropTypes.object,
  subtitle: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  userYou: PropTypes.func.isRequired,
}
const ImmersionLink = React.memo(ImmersionLinkBase)

interface ProgramProps {
  handleExplore: (visualElement: string) => () => void
  profile: bayes.bob.UserProfile
  userYou: YouChooser
}

const linkSentenceStyle = {
  fontStyle: 'italic',
  margin: '15px 0 20px',
}

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const ProgramBase: React.FC<ProgramProps> = (props: ProgramProps): React.ReactElement => {
  const {handleExplore, profile: {gender, name}, userYou} = props
  const url = 'https://clara.pole-emploi.fr/aides/detail/pmsmp'
  return <MethodSuggestionList
    title="Faire un mini-stage en entreprise"
    subtitle="Il faut déjà être accompagné par une structure d'insertion (Pôle emploi, Cap Emploi,
      Mission Locale &hellip;)."
    headerContent={<React.Fragment>
      <VideoFrame style={{marginTop: 15}}><video poster={immersionVideoPoster} controls={true}>
        <source
          src="https://cdn2.webtv-solution.com/pole-emploi/mp4/dossier-immersion-pro-st-0o1avome_38_3574_850.mp4"
          type="video/mp4" />
      </video></VideoFrame>
      <p style={linkSentenceStyle}>
        Me renseigner sur ce programme de stages
        sur <ExternalLink href={url} onClick={handleExplore('link')} style={linkStyle}>
          pole-emploi.fr
        </ExternalLink>
      </p>
    </React.Fragment>}>
    <EmailTemplate
      isMethodSuggestion={true} userYou={userYou}
      title="Comment en parler avec mon conseiller&nbsp;?" onContentShown={handleExplore('email')}
      content={pmsmpEmailContent(name, gender === 'FEMININE' ? 'e' : '')} />
    {/* TODO(cyrille): Add a direct action to show an email template for pe counselor asking for
    a PMSMP.*/}
  </MethodSuggestionList>
}
ProgramBase.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  userYou: PropTypes.func.isRequired,
}
const Program = React.memo(ProgramBase)

const ProgramLinksBase: React.FC<{userYou: YouChooser}> =
  ({userYou}: {userYou: YouChooser}): React.ReactElement => {
    const title = <React.Fragment>
      <GrowingNumber isSteady={true} number={links.length} /> autres organismes pour faire un
      mini-stage
    </React.Fragment>
    // TODO(cyrille): Make this one collapsable.
    return <MethodSuggestionList style={{marginTop: 15}} title={title}>
      {links.map((link, index): React.ReactElement<ImmersionLinkProps> =>
        <ImmersionLink {...link} key={index} userYou={userYou} />)}
    </MethodSuggestionList>
  }
const ProgramLinks = React.memo(ProgramLinksBase)

const ExpandedAdviceCardContentBase: React.FC<CardProps> =
  (props: CardProps): React.ReactElement => {
    return <div>
      <Program {...props} />
      <ProgramLinks userYou={props.userYou} />
    </div>
  }
ExpandedAdviceCardContentBase.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
