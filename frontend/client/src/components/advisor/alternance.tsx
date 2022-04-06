import type {TOptions} from 'i18next'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import DataSource from 'components/data_source'
import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {getDiscoverAction, footer as footerData, simulatorLink, simulatorName,
  specificExpendableAction, getSubtitle} from 'deployment/alternance'
import Picto from 'images/advices/picto-better-job-in-group.svg'

import type {CardProps} from './base'
import {ActionWithHandyLink, ExpandableAction, HandyLink,
  MethodSuggestionList} from './base'

const HANDICAP_HIRING_LINK = 'https://www.agefiph.fr/articles/conseil-pratiques/pourquoi-recruter-une-personne-handicapee-5-bonnes-raisons' // checkURL

const argumentStyle = {
  borderLeft: `2px solid ${colors.MODAL_PROJECT_GREY}`,
  margin: '10px 0',
  paddingLeft: 10,
}

const shortSourceMarginStyle = {
  margin: '15px 0 0',
}

const AlternanceMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, profile: {gender, hasHandicap, yearOfBirth}, t} = props
  const {t: translate} = useTranslation()
  const isYoung = yearOfBirth && (yearOfBirth >= new Date().getFullYear() - 30)
  const handleClick = useMemo(() => handleExplore('tip'), [handleExplore])
  const title = isYoung ?
    <Trans parent={null} t={t}>
      <GrowingNumber number={4} /> étapes pour démarrer une recherche d'emploi en alternance
    </Trans> :
    <Trans parent={null} t={t}>
      <GrowingNumber number={4} /> étapes pour démarrer une recherche de contrat de
      professionalisation
    </Trans>
  const {source: subtitleSource, text: subtitleText} = getSubtitle(hasHandicap) || {}
  const subtitle = subtitleText ? <span>
    {translate(...subtitleText)}
    {subtitleSource ?
      <DataSource style={shortSourceMarginStyle}>{subtitleSource}</DataSource> : null}
  </span> : null
  const discoverAction = getDiscoverAction(!!hasHandicap, !!isYoung)
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])

  const footer = footerData ? <HandyLink
    linkIntro={translate(...footerData.intro)} href={footerData.url}>
    {translate(...footerData.textUrl)}
  </HandyLink> : null
  return <MethodSuggestionList
    title={title} headerContent={subtitle} isNotClickable={true} footer={footer}>
    {discoverAction ? <ActionWithHandyLink
      onClick={handleClick}
      linkName={translate(...discoverAction.name)} linkIntro={translate(...discoverAction.intro)}
      discoverUrl={discoverAction.url}>
      {discoverAction.text}
    </ActionWithHandyLink> : null}
    {specificExpendableAction ? <ExpandableAction
      title={specificExpendableAction.title}
      contentName={specificExpendableAction.more} onContentShown={handleClick}>
      <ul>{specificExpendableAction.description.map((sentence, index) =>
        <li key={index}>{sentence}</li>)}</ul>
    </ExpandableAction> : null}
    <ActionWithHandyLink
      onClick={handleClick}
      linkName={simulatorName} linkIntro={t('Simulateur\u00A0:')}
      discoverUrl={simulatorLink}>
      {t('Simulez votre rémunération')}
    </ActionWithHandyLink>
    <ExpandableAction
      title={t("Identifiez 3 débouchés possibles d'une formation")}
      contentName={t('comment')} onContentShown={handleClick}>
      <Trans t={t} tOptions={tOptions}>
        Pour donner une impression de professionnalisme, lorsque vous contactez une entreprise
        pour une alternance, soyez clair·e sur le poste que vous visez. Par exemple, si vous
        voulez faire un BTS Management, ne demandez pas simplement une "alternance en
        Management". Renseignez-vous d'abord sur les intitulés de poste qui sont proposés en
        alternance&nbsp;: conseiller·e commercial·e&nbsp;? Chargé·e de clientèle&nbsp;?
        Attaché·e à la direction commerciale&nbsp;?
      </Trans>
    </ExpandableAction>
    <ExpandableAction
      title={t("Préparez que dire à l'entreprise")}
      contentName={t("un exemple d'argumentation")}
      onContentShown={handleClick}>
      <div>
        <Trans parent="null" t={t}>
          Un employeur qui vous intéresse peut répondre "non" pour un recrutement en alternance,
          parce qu'il ne connaît pas bien les conditions de ce type de contrat. Voici quelques
          arguments à lui donner&nbsp;:
        </Trans>
        <Trans parent="p" style={argumentStyle} t={t}>
          Il y a plusieurs avantages pour l'entreprise à recruter en alternance. Par exemple,
          pour un contrat d'apprentissage, l'employeur ne paie pas de cotisations sociales.
          L'entreprise peut aussi bénéficier une prime de 1000 euros minimum, et des crédits
          d'impôts.
        </Trans>
        <Trans parent="p" style={argumentStyle} t={t}>
          Par ailleurs, 6 alternants sur 10 sont recrutés à la suite de l'alternance, donc
          c'est un peu comme une longue période d'essai, sans engagement pour l'entreprise de
          poursuivre à la fin des 12 ou 24 mois. Le salaire est fixe à un montant près du SMIC.
        </Trans>
        <Trans parent="p" style={argumentStyle} t={t}>
          Avec une alternance, vous me formerez précisément à vos méthodes de travail et aux
          compétences spécifiques à ce poste. Je serai utile plus rapidement que si je devais
          m'adapter depuis un poste précédent. J'ai déjà sélectionné des formations qui me
          semblent adaptées mais s'il y a des formations que vous recommanderiez… Ma priorité,
          c'est d'intégrer votre entreprise.
        </Trans>
        {hasHandicap ? <p style={argumentStyle}>
          {t('Je me permets de vous envoyer par mail une liste de 5 bonnes raisons\u00A0:')}{' '}
          <ExternalLink href={HANDICAP_HIRING_LINK}>{HANDICAP_HIRING_LINK}</ExternalLink>
        </p> : null}
      </div>
    </ExpandableAction>
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(AlternanceMethod)


export default {ExpandedAdviceCardContent, Picto}
