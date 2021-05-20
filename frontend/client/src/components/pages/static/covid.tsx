import copyToClipboard from 'copy-to-clipboard'
import ContentCopyIcon from 'mdi-react/ContentCopyIcon'
import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Link} from 'react-router-dom'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {useRadium} from 'components/radium'
import {StaticPage, TitleSection} from 'components/static'
import {SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'
import covidImage from 'images/covid.svg'


const countryContext = {context: config.countryId}

interface EmailExampleProps {
  children: string
  title: React.ReactNode
}


const emailCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.1)',
  margin: '25px 0',
  padding: '45px 75px',
}
const buttonStyle: React.CSSProperties = {
  backgroundColor: colors.FOOTER_GREY,
  boxShadow: 'none',
  color: colors.DARK_TWO,
  fontSize: 11,
  textTransform: 'uppercase',
}
const EmailExampleBase = (props: EmailExampleProps): React.ReactElement => {
  const {t} = useTranslation()
  const {children, title} = props
  const [hasJustBeenCopied, setHasJustBeenCopied] = useState(false)
  const copyText = useCallback((): void => {
    copyToClipboard(children)
    setHasJustBeenCopied(true)
  }, [children])
  useEffect((): (() => void) => {
    if (!hasJustBeenCopied) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => setHasJustBeenCopied(false), 2000)
    return (): void => window.clearTimeout(timeout)
  }, [hasJustBeenCopied])
  const copiedStyle: React.CSSProperties = {
    color: colors.BOB_BLUE,
    fontSize: 13,
    marginLeft: '1em',
    opacity: hasJustBeenCopied ? 1 : 0,
    transition: hasJustBeenCopied ? 'none' : SmoothTransitions.transition,
  }
  return <div style={emailCardStyle}>
    <span style={{fontWeight: 'bold'}}>{title}</span><br /><br />
    {children}
    <div style={{marginTop: 30}}>
      <Button style={buttonStyle} isNarrow={true} onClick={copyText}>
        <ContentCopyIcon size={11} /> {t('Copier le texte')}
      </Button>
      <Trans parent="span" style={copiedStyle}>Texte copié dans le presse-papier</Trans>
    </div>
  </div>
}
const EmailExample = React.memo(EmailExampleBase)


const titleStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  lineHeight: 1.09,
  marginBottom: 80,
}
const pageStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: colors.DARK_TWO,
  fontSize: 18,
  lineHeight: '24px',
}
const contentStyle: React.CSSProperties = {
  margin: 'auto',
  maxWidth: 800,
  position: 'relative',
}
const coverImageStyle: React.CSSProperties = {
  boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.2)',
  left: 0,
  position: 'absolute',
  top: -80,
  zIndex: 1,
}
const pStyle: React.CSSProperties = {
  margin: 'auto',
  maxWidth: 650,
}
const hrStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  height: 2,
  margin: 'auto',
  width: 250,
}
const headerStyle: React.CSSProperties = {
  ...pStyle,
  fontSize: 20,
  fontWeight: 'bold',
  margin: '0 auto 10px',
  paddingTop: 60,
}
const quoteStyle: React.CSSProperties = {
  ...pStyle,
  fontStyle: 'italic',
  margin: '20px auto',
  position: 'relative',
}
const quoteBorderStyle: React.CSSProperties = {
  backgroundColor: colors.FOOTER_GREY,
  height: '100%',
  left: -30,
  position: 'absolute',
  top: 0,
  width: 4,
}
const tocStyle: React.CSSProperties = {
  fontWeight: 'bold',
  margin: '50px auto',
  maxWidth: 650,
}
const tocLinkStyle: RadiumCSSProperties = {
  ':hover': {
    textDecoration: 'underline',
  },
  'color': colors.DARK_TWO,
  'display': 'block',
  'textDecoration': 'none',
}


interface TocLinkProps {
  children: string
  href: string
}

const TocLinkBase = (props: TocLinkProps): React.ReactElement => {
  const {children, href} = props
  const [radiumProps] = useRadium<HTMLAnchorElement>({style: tocLinkStyle})
  return <a style={tocLinkStyle} href={href} {...radiumProps}>
    {children}
  </a>
}
const TocLink = React.memo(TocLinkBase)


const CovidPage = (): React.ReactElement => {
  const {t} = useTranslation()
  const hr = <div style={hrStyle} />
  useEffect((): (() => void) => {
    const html = document.body.parentElement
    if (!html) {
      return (): void => void 0
    }
    const scrollBehavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'smooth'
    return (): void => {
      html.style.scrollBehavior = scrollBehavior
    }
  }, [])
  // TODO(pascal): Fix styling for mobile.
  return <StaticPage
    page="covid-19" style={pageStyle} isChatButtonShown={true} isContentScrollable={false}
    isNavBarTransparent={true}>
    <TitleSection pageContent={{title: <Trans style={titleStyle}>
      Chercher un emploi<br />
      pendant la crise du coronavirus
    </Trans>}} />
    <div style={contentStyle}>
      <img src={covidImage} style={coverImageStyle} alt="" />
      <div style={{height: 190}} />

      <div style={tocStyle}>
        <TocLink href="#jobsearch">
          {t('Comment avancer dans sa recherche tout en adoptant les gestes barrières\u00A0?')}
        </TocLink>
        <TocLink href="#jobgroup">
          {t('Comment identifier les secteurs qui recrutent\u00A0?')}
        </TocLink>
        <TocLink href="#hiring">
          {t('Les recrutements ont-ils changé\u00A0?')}
        </TocLink>
        <TocLink href="#examples">
          {t('Adapter ses formulations')}
        </TocLink>
        <TocLink href="#allowance">
          {t('Allocation et radiation')}
        </TocLink>
      </div>

      {hr}

      <Trans style={headerStyle} id="jobsearch">
        Comment avancer dans sa recherche tout en adoptant les gestes barrières&nbsp;?
      </Trans>
      <Trans style={pStyle}>
      Chercher via quelqu'un que vous connaissez est une méthode très efficace pour trouver un
      emploi dans la plupart des métiers. On le sait grâce aux statistiques sur comment les gens
      retrouvent un emploi. Mais pendant quelques temps encore, il peut arriver que vous rencontriez
      des difficultés pour organiser un rendez-vous avec un contact, chez Pôle emploi, ou même pour
      être reçu.e en entretien. On va tous devoir s'adapter.
      </Trans>
      <div style={pStyle}>
        <Markdown
          // i18next-extract-mark-context-next-line ["uk", "us"]
          isSingleLine={true} content={t(
            'Si vous pouvez lire cette page, vous avez probablement accès à internet et ' +
            'pouvez faire bon nombre de démarches via internet. Se renseigner sur un métier, ' +
            'préparer une candidature, envoyer une lettre de motivation… tout cela peut se ' +
            "réaliser depuis chez soi. Même les entretiens d'embauche peuvent se faire en " +
            'ligne de nos jours\u00A0! Si cela est nouveau pour vous, ' +
            '{{productName}} peut vous accompagner dans les différentes étapes ' +
            "de votre recherche d'emploi en ligne.",
            {productName: config.productName, ...countryContext},
          )} />
      </div>
      <div style={{margin: '30px auto', textAlign: 'center'}}>
        {/* TODO(sil): DRY this, here and in the landing page. */}
        <Link to={Routes.INTRO_PAGE}><Button type="validation">
          {t('Se lancer avec {{productName}}', {productName: config.productName})}
        </Button></Link>
      </div>
      <Trans style={pStyle}>
        Dans un monde qui va très vite et où l'on vous pousse souvent à faire toujours plus,
        toujours plus de candidatures, toujours plus vite, cette période peut être l'occasion de
        ralentir et de faire le point (si vous pouvez vous le permettre).
      </Trans>
      <Trans style={quoteStyle}>
        <div style={quoteBorderStyle} />
        "Merci pour cette réflexion qui fait du bien et qui permet de se recentrer.
        Je me sers de ces réflexions pour chercher des postes ou des environnements de travail qui
        me correspondent."
      </Trans>
      <Trans style={pStyle}>
        Prendre le temps de mieux préparer votre projet professionnel et vos méthodes de recherche
        est une très bonne utilisation de votre temps. En une semaine, si vous arrivez à faire une
        candidature soignée à un employeur sur lequel vous vous êtes renseigné, c'est plus efficace
        que de poster 100 candidatures identiques sur les plateformes.
      </Trans>
      <div style={{margin: '30px auto', textAlign: 'center'}}>
        <Link to={Routes.INTRO_PAGE}><Button type="validation">
          {t('Faire le point avec {{productName}}', {productName: config.productName})}
        </Button></Link>
      </div>

      <Trans style={headerStyle}>
        Profitez-en pour faire une formation en ligne ou à distance
      </Trans>
      <Trans style={quoteStyle}>
        <div style={quoteBorderStyle} />
        "En tant que cheffe d'entreprise, mon candidat idéal post-confinement, c'est quelqu'un
        qui a profité de cette période pour se former à de nouvelles compétences."
      </Trans>
      <div style={pStyle}>
        <Markdown
          // i18next-extract-mark-context-next-line ["uk", "us"]
          isSingleLine={true} content={t(
            "Ce temps où l'économie fonctionne au ralenti peut être l'occasion de suivre une " +
            'formation ou un cours en ligne. Pourquoi ne pas explorer ce domaine qui vous a ' +
            'toujours intrigué\u00A0? Vous pouvez par exemple suivre des formations ' +
            "d'informatique sur [OpenClassrooms](https://openclassrooms.com), ou suivre des " +
            'cours sur [Coursera](https://www.coursera.org), ' +
            '[France Université Numérique](https://www.fun-mooc.fr), ou ' +
            '[Khan Academy](https://fr.khanacademy.org). Certaines formations disponibles sur ' +
            'votre [Compte Formation](https://www.moncompteformation.gouv.fr) peuvent égalemnent ' +
            'se faire en ligne.',
            countryContext,
          )} />
      </div>
      <Trans style={pStyle}>
        Si vous connaissez quelqu'un qui fait le métier que vous aimeriez faire, pourquoi ne pas lui
        demander de vous recommander une formation qui pourrait augmenter vos chances&nbsp;?
      </Trans>

      <Trans style={headerStyle} id="jobgroup">
        Comment identifier les secteurs qui recrutent&nbsp;?
      </Trans>
      <Trans style={pStyle}>
        Comme tout est encore très récent, les données dont on dispose sur les secteurs qui
        recrutent ou non sont encore très partielles. Cependant, voici quelques idées qui pourront
        vous être utiles&nbsp;:
      </Trans>

      <div style={pStyle}>
        <ul>
          <Trans parent="li">
            <strong>Suivre l'argent</strong><br />
            Les secteurs qui ont dû accélérer leur activité
            sont ceux qui auront le plus besoin de recruter. En particulier&nbsp;: l'agriculture,
            l'action sociale, la santé. On parle aussi de l'immobilier et l'armée, avec une petite
            reprise également dans la construction, l'éducation et la vente. (<ExternalLink
              // i18next-extract-mark-context-next-line ["uk", "us"]
              href={t(
                'https://dares.travail-emploi.gouv.fr/IMG/pdf/dares_resultats_detailles_acemo-covid-17-04-2020.pdf',
                countryContext,
              )}>
              source
            </ExternalLink>)
          </Trans>
          <Trans parent="li">
            <strong>Suivre les comportements</strong><br />
            Achats en ligne, livraison, numérique... beaucoup de gens s'y sont mis pendant le
            confinement. Il s'agit de nouvelles habitudes qui vont s'ancrer dans le quotidien. On
            peut prévoir une forte activité, et donc des recrutements, dans les domaines du
            e-commerce, de la logistique, ainsi que dans le numérique en général.
          </Trans>
          <Trans parent="li">
            <strong>Suivre les tendances</strong><br />
            En plus des tendances comportementales, des économistes prévoient des tendances de ce
            sur quoi on va investir suite à la crise. Ces tendances peuvent vous aider à cibler vos
            recherches. En parler dans une lettre de motivation et en entretien serait aussi une
            bonne méthode pour démontrer que vous avez compris les enjeux de l'employeur&nbsp;:
            <ul>
              <Trans parent="li">
                Digitalisation de services (&amp; services publics)
              </Trans>
              <Trans parent="li">
                Aide aux communautés locales à accéder au numérique
              </Trans>
              <Trans parent="li">
                Production alimentaire locale avec chaînes de production plus courtes
              </Trans>
              <Trans parent="li">
                Investissement dans des projets avec des communautés de migrants qui seront
                davantage marginalisés après la crise
              </Trans>
              <Trans parent="li">
                Implémentation des mesures vertes aux niveaux national et local
              </Trans>
              <Trans parent="li">
                L'économie sociale et solidaire, et les initiatives des entreprises
              </Trans>
              <Trans parent="li">
                Revoir la qualité de vie au travail pour les travailleurs essentiels
              </Trans>
              <Trans parent="li">
                Changements à l'urbanisme (distanciation physique durable&nbsp;?)
              </Trans>
              <Trans parent="li">
                Repenser les évènements culturels et sportifs
              </Trans>
            </ul>
          </Trans>
        </ul>
      </div>

      <Trans style={headerStyle} id="hiring">
        Les recrutements ont-ils changé&nbsp;?
      </Trans>
      <Trans style={pStyle}>
        Il est encore trop tôt pour évaluer comment cette crise va affecter les recrutements en
        France et dans le monde. Les conseils de {{productName: config.productName}} utilisent
        notamment les statistiques publiées mensuellement par Pôle emploi et vont donc s'ajuster au
        fur et à mesure que le marché de l'emploi change. Néanmoins nous continuons nos recherches
        pour comprendre ces changements et ce qu'ils signifient dans votre cas.
      </Trans>

      <Trans style={headerStyle} id="examples">
        Adapter ses formulations
      </Trans>
      <Trans style={pStyle}>
        Dans toutes vos communications "emploi"&nbsp;: candidature spontanée, lettre de motivation,
        email de relance, il est toujours important de personnaliser chaque message pour avoir plus
        de chance de toucher son destinataire. En ces temps incertains, il est tout aussi
        important d'adapter vos formulations en prenant en compte à la fois la situation générale
        mais également la situation de votre interlocuteur. N'hésitez pas à vous tenir informé·e de
        la situation de l'entreprise dans laquelle vous candidatez en surveillant ses réseaux
        sociaux.<br />
        <br />
        Voici quelques exemples&nbsp;:
      </Trans>
      <EmailExample
        // i18next-extract-mark-context-next-line title
        title={t('Candidature spontanée (n\'oubliez pas de remplacer "votre entreprise" par le ' +
          'nom de l\'entreprise)', {context: 'title'})}
      >{t(
          'La mission de votre entreprise est particulièrement importante en ce temps de sortie ' +
          'de crise. Penser à l\'avenir de vos équipes est nécessaire, c\'est pourquoi je vous ' +
          'contacte pour un poste de (...)',
        )}</EmailExample>
      <EmailExample title={t('Email de relance')}>{t(
        'Quand je vous ai envoyé mon CV et ma lettre de motivation, il y a 2 semaines, ' +
        'l\'épidémie de Coronavirus était la préoccupation immédiate de tout le monde. ' +
        'Aujourd\'hui nous sortons de cette situation et je crois que votre besoin d\'un·e ' +
        '(nom du poste) est toujours présent, c\'est pourquoi je me permets de vous relancer ' +
        'afin de connaître l\'actualité de cette offre.',
        {context: 'gender'},
      )}</EmailExample>
      <EmailExample title={t('Proposition de vidéo conférence')}>{t(
        'Si vous préférez attendre avant de se rencontrer en personne, je me tiens à votre ' +
        'disposition pour un entretien en vidéo conférence, par exemple via le site ' +
        'https://zoom.us/ qui permet de faire un entretien directement depuis votre ' +
        'navigateur. Si nous pouvons trouver un créneau pour se rencontrer, je vous enverrai un ' +
        'lien de connexion pour notre rendez-vous.',
      )}</EmailExample>

      <Trans style={headerStyle} id="allowance">
        Allocation et radiation
      </Trans>
      <Trans style={pStyle}>
        Si vous touchez l'allocation chômage de Pôle emploi, ces derniers ont annulé toutes les
        convocations et vous ne serez donc pas radié·e pour
        non-présentation. <ExternalLink href={t(
          'https://www.pole-emploi.fr/actualites/a-laffiche/pole-emploi-face-a-la-crise-sani.html',
          countryContext)}>
          Les agent·e·s de Pôle emploi se mobilisent
        </ExternalLink> et sont disponibles par téléphone au 3949 ou sur leur site internet.
      </Trans>

      <div style={{height: 100}} />
      {hr}

      <Trans style={{margin: '60px 0', textAlign: 'center'}}>
        <div style={{fontWeight: 'bold'}}>
          Besoin d'aide dans votre recherche d'emploi&nbsp;?
        </div>
        <div style={{color: colors.COOL_GREY}}>
          {{productName: config.productName}} vous accompagne gratuitement et à votre rythme.
        </div>
      </Trans>
      <div style={{marginBottom: 60, textAlign: 'center'}}>
        <Link to={Routes.INTRO_PAGE}><Button type="validation">
          {t('Commencer tout de suite')}
        </Button></Link>
      </div>

    </div>
  </StaticPage>
}


export default React.memo(CovidPage)
