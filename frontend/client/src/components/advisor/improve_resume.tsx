import {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-improve-resume.svg'

import {CardProps, ExpandableAction, HandyLink, ImproveApplicationTips,
  MethodSuggestionList} from './base'


const SECTIONS = [
  {
    data: 'qualities',
    title: prepareT('Qualités les plus attendues par les recruteurs\u00A0:'),
  },
  {
    data: 'improvements',
    title: prepareT('Pour améliorer votre candidature'),
  },
] as const


interface Tip {
  description: React.ReactNode
  title: string
}

const tips = _memoize((t: TFunction): readonly Tip[] => [
  {
    description: <Trans parent={null} t={t}>
      <p>
        Sur un site dédié handicap tel que Hanploi.com, vous n'êtes pas
        obligé de le noter. Ici, les recruteurs recherchent avant tout des compétences avec la
        spécificité <strong>RQTH</strong>.
      </p>
      <p>
        Notez bien vos aménagements non pas sur le CV, mais dans
        l'espace dédié sur le site de recrutement, ou dans un document à part.
      </p>
    </Trans>,
    title: t('Candidature via un site de recrutement dédié au handicap'),
  },
  {
    description: <Trans parent={null} t={t}>
      Mettre la mention <strong>RQTH</strong> sur votre CV dans la rubrique "profil".
    </Trans>,
    title: t("Candidature à la mission handicap d'une entreprise"),
  },
  {
    description: <Trans parent={null} t={t}>
      C'est à vous de décider si vous voulez parler
      de votre handicap sur votre CV ou pas. C'est un choix personnel qui ne concerne que vous.
      Mais selon Hanploi&nbsp;:
      <blockquote>
        <p>
          Ne le notez pas, vous aurez plus de chance de décrocher un entretien. Et il sera toujours
          temps de l'aborder lors de vos échanges avec le recruteur. C'est votre choix, mais
          uniquement si vous le sentez et si vous avez besoin d'un aménagement de poste.
        </p>
        <p>
          Dans le cas contraire, personne ne vous oblige à en parler.
          Si l'entreprise est dotée d'une mission handicap, vous pourrez toujours le signaler après
          la validation de votre période d'essai.
        </p>
      </blockquote>
    </Trans>,
    title: t('Candidature sur un site généraliste'),
  },
  {
    description: <Trans parent={null} t={t}>
      Cela peut être judicieux de mentionner <strong>RQTH</strong> sur le CV, car cela peut
      suffire à expliquer votre parcours atypique.
    </Trans>,
    title: t('Il y a de longues périodes sans travail dans votre parcours'),
  },
])


const handicapSectionStyle = {
  marginBottom: 40,
}
const descriptionStyle = {
  lineHeight: 1.5,
}


// TODO(cyrille): Add a Hanploi tag.
const HandicapResumeBase: React.FC<CardProps> =
({handleExplore, t}): React.ReactElement => {
  const subtitle = t(
    "C'est à vous de décider si vous voulez parler de votre handicap sur votre CV ou pas. " +
    "Réfléchir à comment ce sera reçu chez l'employeur ciblé est une bonne méthode pour choisir.")
  const handicapTitle = useMemo((): React.ReactNode => <Trans parent={null} t={t}>
    <GrowingNumber number={4} /> astuces pour un CV bien ciblé
  </Trans>, [t])
  const handicapFooter = useMemo((): React.ReactElement => <HandyLink
    linkIntro={t('Plus de conseils pour vous aider à faire votre CV\u00A0:')}
    href="https://hizy.org/fr/emploi/informer/parler-handicap-entretien-embauche-ou-cv">
    Hizy
  </HandyLink>, [t])
  return <MethodSuggestionList
    title={handicapTitle} subtitle={subtitle} footer={handicapFooter}
    style={handicapSectionStyle}>
    {tips(t).map(({description, title}, index): ReactStylableElement => <ExpandableAction
      key={index}
      contentName={t("l'astuce")}
      onContentShown={handleExplore('tip')}
      title={title}><div style={descriptionStyle}>{description}</div></ExpandableAction>)}
  </MethodSuggestionList>
}
HandicapResumeBase.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const HandicapResume = React.memo(HandicapResumeBase)


const ImproveResume: React.FC<CardProps> = (props): React.ReactElement => {
  const {profile: {hasHandicap}} = props
  return <React.Fragment>
    {hasHandicap ? <HandicapResume {...props} /> : null}
    <ImproveApplicationTips {...props} sections={SECTIONS} />
  </React.Fragment>
}
ImproveResume.propTypes = {
  profile: PropTypes.shape({
    hasHandicap: PropTypes.bool,
  }),
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ImproveResume)


export default {ExpandedAdviceCardContent, Picto}
