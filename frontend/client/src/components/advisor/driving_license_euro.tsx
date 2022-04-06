import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useMemo} from 'react'

import {getEmailTemplates} from 'store/advice'
import {inDepartement} from 'store/french'
import {missionLocaleUrl} from 'store/job'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-driving-license.svg'
import missionLocaleImage from 'images/missions-locales-logo.png'

import type {CardProps} from './base'
import {useAdviceData, EmailTemplate, ExpandableAction, MethodSuggestionList,
  ToolCard} from './base'


interface ExploreOnClickProps {
  children: React.ReactNode
  handleExplore: CardProps['handleExplore']
  href?: string
  style?: React.CSSProperties
  visualElement: string
}


const ExploreOnClickBase = (props: ExploreOnClickProps): React.ReactElement => {
  const {children, handleExplore, href, visualElement, ...otherProps} = props
  const onClick = useCallback((event: React.MouseEvent): void => {
    if (!href) {
      return
    }
    event.preventDefault()
    handleExplore(visualElement)()
    window.open(href, '_blank')
  }, [handleExplore, href, visualElement])
  return <a href={href} onClick={onClick} {...otherProps}>
    {children}
  </a>
}
const ExploreOnClick = React.memo(ExploreOnClickBase)


const emptyArray = [] as const
const emptyObject = {} as const


const itemStyle: React.CSSProperties = {
  alignItems: 'center',
  color: 'inherit',
  display: 'flex',
  textDecoration: 'inherit',
} as const


const DrivingLicenseEuro = (props: CardProps): React.ReactElement => {
  const {
    advice: {adviceId},
    handleExplore,
    profile: {gender, yearOfBirth},
    project: {city = emptyObject, city: {departementName = ''} = {}},
    t,
  } = props
  const {data: {missionLocale, partnerBanks, schoolListLink, schools = emptyArray}, loading} =
    useAdviceData<bayes.bob.OneEuroProgram>(props)
  const isMinor = (yearOfBirth && (new Date().getFullYear() - yearOfBirth) < 18) || false

  const ageSpecificParagraph = useMemo((): React.ReactNode => {
    if (isMinor) {
      return <Trans parent="span" t={t}>
        Comme vous êtes mineur·e,
        <ul>
          <li>Soit ce sont vos parents qui empruntent pour vous.</li>
          <li>
            Soit vos parents ne peuvent pas vous aider. Dans ce cas, des structures comme les
            Missions Locales peuvent vous accompagner. Ils pourront vous aider à obtenir une caution
            publique.
          </li>
        </ul>
      </Trans>
    }
    return <Trans parent="span" t={t} tOptions={{context: gender}}>
      Comme vous êtes majeur·e, vous pouvez contacter directement une des banques partenaires pour
      faire votre demande de prêt. Vous aurez ensuite besoin de prouver que vous pourrez rembourser
      le prêt.
    </Trans>
  }, [gender, isMinor, t])

  const explanation = useMemo((): React.ReactNode => {
    return <div style={{marginBottom: 35}}>
      <Trans t={t}>
        Grâce au dispositif "permis à 1€ par jour" mis en place par
        l'État, vous pouvez demander un prêt d'une banque d'un montant de 600, 800, 1&nbsp;000 ou
        1&nbsp;200&nbsp;€ pour financer votre permis de conduire (en fonction des tarifs de
        l'auto-école). Les intérêts du prêt sont pris en charge par l'État.<br /><br />

        De votre côté, vous devez rembourser 30&nbsp;€ par mois.
      </Trans>
      <br />
      {ageSpecificParagraph}
    </div>
  }, [ageSpecificParagraph, t])

  const findingSchool = useMemo((): React.ReactNode => {
    if (!schoolListLink && !schools.length) {
      return null
    }
    const inDepartment = city && inDepartement(city, t) || t('dans votre département')
    return <ExpandableAction key="finding-school"
      contentName={t('la liste des auto-écoles')}
      title={t('Trouver une auto-école agréée pour le permis à 1\u00A0€')}
      onContentShown={handleExplore('schools')}>
      <div style={{marginBottom: 20}}>
        {schools.length ? <Trans parent={null} t={t} count={schools.length}>
          Nous avons trouvé <GrowingNumber style={{fontWeight: 'bold'}}
            number={schools.length} isSteady={true} /> auto-école agréée près de chez vous
        </Trans> : t('Nous avons trouvé la liste des auto-écoles agréées près de chez vous')}
        <MethodSuggestionList style={{marginTop: 10}}>
          {[
            ...schools.map(
              ({address, link, name}: bayes.bob.DrivingSchool, index: number):
              ReactStylableElement =>
                <ExploreOnClick
                  handleExplore={handleExplore} href={link} visualElement="school"
                  style={itemStyle} key={`school-${index}`}>
                  <span style={{marginRight: 10, width: 200}}>
                    {name}
                  </span>
                  <span>{address}</span>
                </ExploreOnClick>,
            ),
            schoolListLink ? <ExploreOnClick
              key="finding-more-schools" style={itemStyle} handleExplore={handleExplore}
              href={schoolListLink} visualElement="more schools">
              {schools.length ?
                t(
                  "Plus d'auto-écoles agréées pour le permis à 1\u00A0€ {{inDepartment}}",
                  {inDepartment}) :
                <Trans parent={null} t={t}>
                  Accédez à la liste des auto-écoles agréées pour le permis à
                  1&nbsp;€ {{inDepartment}}
                </Trans>}
              <span style={{flex: 1}} />
              <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, width: 20}} />
            </ExploreOnClick> : null,
          ]}
        </MethodSuggestionList>
      </div>
    </ExpandableAction>
  }, [city, handleExplore, schoolListLink, schools, t])

  const documentation = useMemo((): React.ReactNode => {
    if (isMinor) {
      const comparatorStyle: React.CSSProperties = {
        color: colors.COOL_GREY,
        fontSize: 13,
        fontStyle: 'italic',
        fontWeight: 'normal',
      }
      const missionLocaleLink = missionLocaleUrl(t, missionLocale, departementName)
      return <ExpandableAction
        key="documents"
        onContentShown={handleExplore('documentation-minor')}
        title={t(
          'Expliquer le permis à 1\u00A0€ à vos parents ou bien contacter votre Mission Locale',
        )}>
        <div>
          <Trans parent={null} t={t}>
            Si ce sont vos parents qui empruntent pour vous, vous pouvez leur expliquer
            que&nbsp;:<br />
            <ul>
              <li>
                Le "permis à un euro par jour" a été mis en place par l'État, en partenariat avec
                des banques et des écoles de conduite.
              </li>
              <li>
                Cela permet d'obtenir un prêt d'une banque d'un montant de 600, 800, 1&nbsp;000 ou
                1&nbsp;200&nbsp;€ pour financer le permis. Les intérêts du prêt seront pris en
                charge par l'État et vous devez rembourser 30&nbsp;€ par mois.
              </li>
            </ul>
          </Trans>
          <Trans t={t}>
            Si vos parents ne peuvent pas vous aider, vous pouvez contacter votre Mission Locale qui
            pourra peut-être vous aider (attention ça n'est pas sur à 100%, même si vous remplissez
            tous les critères)
          </Trans>
          <ToolCard
            imageSrc={missionLocaleImage}
            hasBorder={true}
            href={missionLocaleLink}
            onClick={handleExplore('tool')}
            style={{margin: '35px 0'}}>
            Mission Locale
            <div style={{fontSize: 13, fontWeight: 'normal'}}>
              {t('obtenir une caution publique')}
            </div>
            <div style={comparatorStyle}>{t("Association pour l'insertion des jeunes")}</div>
          </ToolCard>
        </div>
      </ExpandableAction>
    }
    return <ExpandableAction
      key="documents" onContentShown={handleExplore('documentation')}
      contentName={t('les options possibles')}
      title={t('Réunir les documents pour montrer que vous pourrez rembourser votre prêt')}>
      <Trans t={t}>
        3 options pour montrer que vous pouvez rembourser le prêt&nbsp;:<br />
        <ul>
          <li>
            un justificatif de revenus qui montre que vous pourrez rembourser
            les 30&nbsp;€&nbsp;/&nbsp;mois
          </li>
          <li>
            <strong>ou</strong> une personne caution, c'est-à-dire quelqu'un qui s'engage à
            rembourser votre prêt si vous n'y arrivez pas
          </li>
          <li>
            <strong>ou</strong> un co-emprunteur, une autre personne emprunte avec vous pour
            augmenter vos chances d'avoir une réponse positive de la banque.
          </li>
        </ul>
      </Trans>
    </ExpandableAction>
  }, [departementName, handleExplore, isMinor, missionLocale, t])

  const findABank = useMemo((): React.ReactNode => {
    if (!partnerBanks || !partnerBanks.length) {
      return null
    }
    return <ExpandableAction
      key="find-a-bank" onContentShown={handleExplore('banks list')}
      contentName={t('la liste des banques')}
      title={t('Trouver un partenaire financier pour faire votre demande de prêt')}>
      <div style={{marginBottom: 20}}>
        <Trans parent={null} t={t}>
          Nous vous avons réuni une liste de partenaires qui peuvent vous aider à financer votre
          permis à 1&nbsp;€.<br />
          Vous pouvez aussi contacter votre banque pour savoir si elle propose des prêts permis à
          1&nbsp;€.
        </Trans>
        <div style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}>
          {partnerBanks.map(({link, logo, name}): React.ReactNode =>
            <ExternalLink
              href={link} key={`partner-${name}`} onClick={handleExplore('bank')}>
              <img src={logo} alt={name} style={{margin: 10, maxHeight: 60, maxWidth: 160}} />
            </ExternalLink>,
          )}
        </div>
      </div>
    </ExpandableAction>
  }, [partnerBanks, handleExplore, t])

  const emails = (getEmailTemplates(t)[adviceId] || []).
    map((template, index): React.ReactNode =>
      <EmailTemplate
        {...template} key={`email-${index}`}
        onContentShown={handleExplore('email')} />,
    )
  const actions = [
    findingSchool,
    ...emails,
    documentation,
    findABank,
  ]

  const detailsLinkStyle: React.CSSProperties = {
    color: colors.COOL_GREY,
    fontSize: '.9em',
    fontStyle: 'italic',
  }

  if (loading) {
    return loading
  }

  return <div style={{fontSize: 16}}>
    {explanation}
    {actions}
    <div style={{marginTop: 35}}>
      <ExternalLink
        style={detailsLinkStyle}
        href="http://www.securite-routiere.gouv.fr/permis-de-conduire/passer-son-permis/le-permis-a-1-euro-par-jour/informations">
        {t("Plus d'infos sur le permis à 1\u00A0€ par jour")}
      </ExternalLink>
    </div>
  </div>
}
const ExpandedAdviceCardContent = React.memo(DrivingLicenseEuro)


export default {ExpandedAdviceCardContent, Picto}
