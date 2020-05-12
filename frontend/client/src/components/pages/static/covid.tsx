import copyToClipboard from 'copy-to-clipboard'
import ContentCopyIcon from 'mdi-react/ContentCopyIcon'
import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Link} from 'react-router-dom'

import {Trans} from 'components/i18n'
import {useRadium} from 'components/radium'
import {StaticPage, TitleSection} from 'components/static'
import {Button, ExternalLink, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'
import covidImage from 'images/covid.svg'


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
  backgroundColor: colors.MINI_FOOTER_GREY,
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
    return (): void => clearTimeout(timeout)
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
  backgroundColor: colors.MINI_FOOTER_GREY,
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
      Poursuivre sa recherche<br />
      pendant le confinement
    </Trans>}} />
    <div style={contentStyle}>
      <img src={covidImage} style={coverImageStyle} alt="" />
      <div style={{height: 190}} />

      <div style={tocStyle}>
        <TocLink href="#jobsearch">
          {t('Comment avancer dans sa recherche pendant le confinement\u00A0?')}
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
      <Trans style={{fontStyle: 'italic', margin: '40px auto', maxWidth: 650}}>
        Alors que les déplacements et rencontres physiques entre personnes sont drastiquement
        réduites, il nous semble d'autant plus important que les nouvelles technologies aident à
        prendre le relai de la cohésion sociale et de continuer à faire avancer ceux qui en ont
        besoin sur leur chemin vers l'emploi. {{productName: config.productName}} reste donc
        totalement opérationnel durant les mesures de confinement.
      </Trans>
      {hr}

      <Trans style={headerStyle} id="jobsearch">
        Comment avancer dans sa recherche pendant le confinement&nbsp;?
      </Trans>
      <Trans style={pStyle}>
        Si vous pouvez lire cette page, vous avez probablement accès à internet et pouvez faire bon
        nombre de démarches via internet. Se renseigner sur un métier, préparer une candidature,
        envoyer une lettre de motivation… tout cela peut se réaliser depuis chez soi. Même les
        entretiens d'embauche peuvent se faire en ligne de nos jours&nbsp;! Si cela est nouveau pour
        vous, {{productName: config.productName}} peut vous accompagner dans les différentes étapes
        de votre recherche d'emploi tout en respectant les consignes de confinement du gouvernement.
      </Trans>
      <div style={{margin: '30px auto', textAlign: 'center'}}>
        {/* TODO(sil): DRY this, here and in the landing page. */}
        <Link to={Routes.INTRO_PAGE}><Button type="validation">
          {t('Se lancer avec {{productName}}', {productName: config.productName})}
        </Button></Link>
      </div>
      <Trans style={pStyle}>
        Dans un monde qui va très vite et où l'on vous pousse souvent à faire toujours plus,
        toujours plus de candidatures, toujours plus vite, le confinement peut être l'occasion de
        ralentir et de faire le point.
      </Trans>
      <Trans style={quoteStyle}>
        <div style={quoteBorderStyle} />
        "Merci pour cette réflexion qui fait du bien et qui permet de se recentrer.
        Je me sers de ces réflexions pour chercher des postes ou des environnements de travail qui
        me correspondent."
      </Trans>
      <Trans style={pStyle}>
        Prendre le temps de mieux préparer votre projet professionnel et vos méthodes de recherche
        est une très bonne utilisation de votre temps et pour cela vous n'avez pas besoin de sortir
        de chez vous.
      </Trans>
      <div style={{margin: '30px auto', textAlign: 'center'}}>
        <Link to={Routes.INTRO_PAGE}><Button type="validation">
          {t('Faire le point avec {{productName}}', {productName: config.productName})}
        </Button></Link>
      </div>

      <Trans style={headerStyle}>
        Profitez-en pour faire une formation en ligne ou à distance
      </Trans>
      <Trans style={pStyle}>
        Ce temps où l'économie fonctionne au ralenti peut être l'occasion de suivre une formation ou
        un cours en ligne. Pourquoi ne pas explorer ce domaine qui vous a toujours intrigué&nbsp;?
        Vous pouvez par exemple suivre des formations d'informatique
        sur <ExternalLink href="https://openclassrooms.com/">
          OpenClassrooms
        </ExternalLink>, ou suivre des cours sur <ExternalLink href="https://www.coursera.org/">
          Coursera
        </ExternalLink>, <ExternalLink href="https://www.fun-mooc.fr/">
          France Université Numérique
        </ExternalLink>, ou <ExternalLink href={t('https://fr.khanacademy.org/')}>
          Khan Academy
        </ExternalLink>. Certaines formations disponibles sur
        votre <ExternalLink href="https://www.moncompteformation.gouv.fr/">
          Compte Formation
        </ExternalLink> peuvent également se faire en ligne.
      </Trans>

      <Trans style={headerStyle} id="hiring">
        Les recrutements ont-ils changé&nbsp;?
      </Trans>
      <Trans style={pStyle}>
        Il est encore trop tôt pour évaluer comment le confinement généralisé va affecter les
        recrutements en France et dans le monde. Les conseils de {{productName: config.productName}}
        {' '}utilisent notamment les statistiques publiées mensuellement par Pôle emploi et vont
        donc s'ajuster au fur et à mesure que le marché de l'emploi change. Néanmoins nous
        continuons nos recherches pour comprendre ces changements et ce qu'ils signifient dans votre
        cas.
      </Trans>

      <Trans style={headerStyle} id="examples">
        Adapter ses formulations
      </Trans>
      <Trans style={pStyle}>
        Dans toutes vos communications "emploi"&nbsp;: candidature spontanée, lettre de motivation,
        email de relance, il est toujours important de personnaliser chaque message pour avoir plus
        de chance de toucher son destinataire. En ces temps extraordinaires, il est tout aussi
        important d'adapter vos formulations en prenant en compte à la fois la situation générale
        mais également la situation de votre interlocuteur. N'hésitez pas à vous tenir informer de
        la situation de l'entreprise dans laquelle vous candidatez en surveillant ses réseaux
        sociaux et ses éventuelles communications concernant la poursuite de ses activités durant la
        période de confinement.<br />
        <br />
        Voici quelques exemples&nbsp;:
      </Trans>
      <EmailExample
        // i18next-extract-mark-context-next-line title
        title={t('Candidature spontanée', {context: 'title'})}
      >{t(
          "Bien que la France soit à l'arrêt, votre entreprise reste active et sa mission est " +
          "toujours aussi importante. Penser à l'avenir de vos équipes est nécessaire, c'est " +
          'pourquoi je vous contacte pour un poste de (...)',
        )}</EmailExample>
      <EmailExample title={t('Email de relance')}>{t(
        'Quand je vous ai envoyé mon CV et ma lettre de motivation, il y a 2 semaines, ' +
        "l'épidémie de Coronavirus était encore loin de nos préoccupations immédiates. " +
        "Aujourd'hui c'est bien différent et pourtant je crois que votre besoin d'un·e (nom du " +
        "poste) est toujours présent, c'est pourquoi je me permets de vous relancer afin de " +
        "connaître l'actualité de cette offre.",
      )}</EmailExample>
      <EmailExample title={t('Proposition de vidéo conférence')}>{t(
        "Bien qu'il soit impossible de se rencontrer en personne, je me tiens à votre " +
        'disposition pour un entretien en vidéo conférence, par exemple via le site ' +
        'http://itshello.co/ qui permet de faire un entretien directement depuis votre ' +
        'navigateur. Si nous pouvons trouver un créneau pour se rencontrer, je vous enverrai un ' +
        'lien de connexion pour notre rendez-vous.',
      )}</EmailExample>

      <Trans style={headerStyle} id="allowance">
        Allocation et radiation
      </Trans>
      <Trans style={pStyle}>
        Si vous touchez l'allocation chômage de Pôle emploi, ces derniers ont annulé toutes les
        convocations et vous ne serez donc pas radié·e pour
        non-présentation. <ExternalLink href="https://www.pole-emploi.fr/actualites/information-covid-19.html">
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
