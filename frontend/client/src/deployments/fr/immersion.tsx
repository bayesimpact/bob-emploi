import type {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import type {LocalizableString} from 'store/i18n'
import {combineTOptions, prepareT} from 'store/i18n'
import {EmailTemplate, MethodSuggestionList} from 'components/advisor/base'
import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import Tag from 'components/tag'

import type {EmailProps} from '../types/immersion'

const countryContext = {context: config.countryId} as const

interface Props {
  handleExplore: (visualElement: string) => () => void
  linkStyle?: React.CSSProperties
}

const SubtitleBase = (unusedProps: Props): React.ReactElement => <Trans>
  Il faut déjà être accompagné·e par une structure d'insertion (Pôle emploi, Cap Emploi,
  Mission Locale …).
</Trans>

const Subtitle = React.memo(SubtitleBase)

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
    url: 'http://www.lesavoirfaire.fr/', // checkURL
  },
  {
    isForYou: true,
    isFree: true,
    subtitle: prepareT('Pour essayer des métiers en voyageant'),
    title: 'WorkAway',
    url: 'https://www.workaway.info/index-fr.html', // checkURL
  },
  {
    isForYou: true,
    subtitle: prepareT('Pour faire des mini-stages de 1 à 30 jours'),
    title: 'Test un métier',
    url: 'https://www.testunmetier.com/', // checkURL
  },
  {
    isForYou: true,
    subtitle: prepareT('Pour faire des mini-stages de 1 à 5 jours'),
    title: 'Test un job',
    url: 'https://www.testmonjob.fr/', // checkURL
  },
  {
    isFree: true,
    subtitle: prepareT('Pour les stages de troisième'),
    title: 'Viens voir mon taf',
    url: 'https://www.viensvoirmontaf.fr/', // checkURL
  },
  {
    isFree: true,
    subtitle: prepareT('Pour les stages de troisième'),
    title: 'Mon stage de troisième',
    url: 'https://www.monstagedetroisieme.fr/', // checkURL
  },
]

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

const Email = (props: EmailProps): React.ReactElement|null => {
  const {gender, handleExplore, name} = props
  const {t, t: translate} = useTranslation()
  return <EmailTemplate
    title={t('Comment en parler avec mon conseiller\u00A0?')}
    onContentShown={handleExplore('email')}
    content={translate(...combineTOptions(pmsmpEmailContent, {context: gender, name}))} />
}


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
const ImmersionLink = React.memo(ImmersionLinkBase)

const ProgramDetailsBase = (): React.ReactElement|null => {
  const {t} = useTranslation()
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
const ProgramDetails = React.memo(ProgramDetailsBase)

const linkSentenceStyle = {
  fontStyle: 'italic',
  margin: '15px 0 20px',
}

const ProgramVideoMoreBase = ({handleExplore, linkStyle}: Props): React.ReactElement => {
  {/* i18next-extract-mark-context-next-line ["uk", "usa"] */}
  return <Trans style={linkSentenceStyle} tOptions={countryContext}>
    Me renseigner sur ce programme de stages
    sur <ExternalLink href="https://clara.pole-emploi.fr/aides/detail/pmsmp"
      onClick={handleExplore('link')} style={linkStyle}>
    pole-emploi.fr</ExternalLink>
  </Trans>
}

const ProgramVideoMore = React.memo(ProgramVideoMoreBase)

export {Email, ProgramDetails, ProgramVideoMore, Subtitle}
