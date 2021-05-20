import {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {LocalizableString, combineTOptions, prepareT} from 'store/i18n'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import Tag from 'components/tag'
import VideoFrame from 'components/video_frame'
import Picto from 'images/advices/picto-immersion.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const pmsmpEmailContent = prepareT(
  `Chère Madame, cher Monsieur,\n\n

J'ai commencé à construire un projet d'orientation vers le métier de .....

J'ai vu que j'avais la possibilité de faire un stage d'immersion (PMSMP), et je suis
convaincu·e que cela m'aiderait à valider mon projet. J'ai trois objectifs\u00A0:

1. essayer le métier pour confirmer ma motivation
2. obtenir une expérience récente sur mon CV pour m'aider à postuler dans ce métier
3. avoir un premier contact dans le milieu

Pourrions-nous convenir d'un rendez-vous pour en discuter\u00A0?
Auriez-vous des disponibilités cette semaine\u00A0?
Merci.

Bien cordialement,

{{name}}`)

interface ImmersionElementProps {
  isFree?: boolean
  isForYou?: boolean
  subtitle: LocalizableString
  title: string
  url: string
}

interface ImmersionLinkProps extends ImmersionElementProps {
  style?: RadiumCSSProperties
  t: TFunction
}

const links: readonly ImmersionElementProps[] = [
  {
    isForYou: true,
    subtitle: prepareT('Pour essayer les métiers manuels'),
    title: 'Savoir-Faire et Découverte',
    url: 'http://www.lesavoirfaire.fr/',
  },
  {
    isForYou: true,
    isFree: true,
    subtitle: prepareT('Pour essayer des métiers en voyageant'),
    title: 'WorkAway',
    url: 'https://www.workaway.info/index-fr.html',
  },
  {
    isForYou: true,
    subtitle: prepareT('Pour faire des mini-stages de 1 à 30 jours'),
    title: 'Test un métier',
    url: 'https://www.testunmetier.com/',
  },
  {
    isForYou: true,
    subtitle: prepareT('Pour faire des mini-stages de 1 à 5 jours'),
    title: 'Test un job',
    url: 'https://www.testmonjob.fr/',
  },
  {
    isFree: true,
    subtitle: prepareT('Pour les stages de troisième'),
    title: 'Viens voir mon taf',
    url: 'https://www.viensvoirmontaf.fr/',
  },
  {
    isFree: true,
    subtitle: prepareT('Pour les stages de troisième'),
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
    const {isForYou, isFree, style: propsStyle, subtitle, t, t: translate, title, url} = props
    const style = useMemo(() => getContainerStyle(propsStyle), [propsStyle])

    return <RadiumExternalLink href={url} style={style}>
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <span>
          {title}<span style={{fontStyle: 'italic'}}>{isFree ? null : ` (${t('payant')})`}</span>
          {isForYou ? <Tag style={tagStyle}>{t('Pour vous')}</Tag> : null}
        </span>
        <span style={subtitleStyle}>{translate(...subtitle)}</span>
      </div>
      <ChevronRightIcon size={16} style={{flex: 'none'}} />
    </RadiumExternalLink>
  }
ImmersionLinkBase.propTypes = {
  isForYou: PropTypes.bool,
  isFree: PropTypes.bool,
  style: PropTypes.object,
  subtitle: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
}
const ImmersionLink = React.memo(ImmersionLinkBase)

interface ProgramProps {
  handleExplore: (visualElement: string) => () => void
  profile: bayes.bob.UserProfile
  t: TFunction
}

const linkSentenceStyle = {
  fontStyle: 'italic',
  margin: '15px 0 20px',
}

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}
const coverallStyle: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

const ProgramBase: React.FC<ProgramProps> = (props: ProgramProps): React.ReactElement => {
  const {handleExplore, profile: {gender, name = ''}, t, t: translate} = props
  const url = 'https://clara.pole-emploi.fr/aides/detail/pmsmp'
  return <MethodSuggestionList
    title={t('Faire un mini-stage en entreprise')}
    subtitle={t(
      "Il faut déjà être accompagné·e par une structure d'insertion (Pôle emploi, Cap Emploi, " +
      'Mission Locale …).',
      {context: gender},
    )}
    headerContent={<React.Fragment>
      <VideoFrame style={{marginTop: 15}}>
        <iframe
          // TODO(cyrille): Handle explore 'video' when clicking in the iframe.
          src="https://www.youtube.com/embed/XWkDvcRc0gU"
          width="100%" height="100%" style={coverallStyle}
          frameBorder={0} scrolling="no" allowFullScreen={true}
          title={t("L'immersion professionnelle en vidéo")} />
      </VideoFrame>
      <Trans t={t} style={linkSentenceStyle}>
        Me renseigner sur ce programme de stages
        sur <ExternalLink href={url} onClick={handleExplore('link')} style={linkStyle}>
          pole-emploi.fr
        </ExternalLink>
      </Trans>
    </React.Fragment>}>
    <EmailTemplate
      title={t('Comment en parler avec mon conseiller\u00A0?')}
      onContentShown={handleExplore('email')}
      content={translate(...combineTOptions(pmsmpEmailContent, {context: gender, name}))} />
    {/* TODO(cyrille): Add a direct action to show an email template for pe counselor asking for
    a PMSMP.*/}
  </MethodSuggestionList>
}
ProgramBase.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const Program = React.memo(ProgramBase)

const ProgramLinksBase: React.FC<{t: TFunction}> =
  ({t}: {t: TFunction}): React.ReactElement => {
    const title = <Trans parent={null} t={t} count={links.length}>
      <GrowingNumber isSteady={true} number={links.length} /> autre organisme pour faire un
      mini-stage
    </Trans>
    // TODO(cyrille): Make this one collapsable.
    return <MethodSuggestionList style={{marginTop: 15}} title={title}>
      {links.map((link, index): React.ReactElement<ImmersionLinkProps> =>
        <ImmersionLink {...link} key={index} t={t} />)}
    </MethodSuggestionList>
  }
const ProgramLinks = React.memo(ProgramLinksBase)

const ImmersionMethod: React.FC<CardProps> =
  (props: CardProps): React.ReactElement => {
    return <div>
      <Program {...props} />
      <ProgramLinks t={props.t} />
    </div>
  }
ImmersionMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ImmersionMethod)


export default {ExpandedAdviceCardContent, Picto}
