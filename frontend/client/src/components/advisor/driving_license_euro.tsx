import _memoize from 'lodash/memoize'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {getEmailTemplates, inDepartement} from 'store/french'
import {missionLocaleUrl} from 'store/job'

import {ExternalLink, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-driving-license.svg'
import missionLocaleImage from 'images/missions-locales-logo.png'

import {AdviceSuggestionList, CardProps, CardWithContentProps, connectExpandedCardWithContent,
  EmailTemplate, ExpandableAction, ToolCard} from './base'


type ExpandedCardProps = CardWithContentProps<bayes.bob.OneEuroProgram>


interface CardState {
  schools?: readonly bayes.bob.DrivingSchool[]
}


class ExpandedAdviceCardContentBase extends React.PureComponent<ExpandedCardProps, CardState> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    adviceData: PropTypes.shape({
      missionLocale: PropTypes.shape({
        agenciesListLink: PropTypes.string,
      }),
      partnerBanks: PropTypes.arrayOf(PropTypes.shape({
        link: PropTypes.string.isRequired,
        logo: PropTypes.string,
        name: PropTypes.string.isRequired,
      }).isRequired),
      schoolListLink: PropTypes.string,
      schools: PropTypes.arrayOf(PropTypes.shape({
        address: PropTypes.string.isRequired,
        link: PropTypes.string,
        name: PropTypes.string.isRequired,
      }).isRequired),
    }),
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      yearOfBirth: PropTypes.number,
    }).isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        departementName: PropTypes.string,
        departementPrefix: PropTypes.string,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {}

  public static getDerivedStateFromProps(
    {adviceData: {schools = []} = {}}: ExpandedCardProps, {schools: prevSchools}): CardState|null {
    if (prevSchools === schools) {
      return null
    }
    return {schools}
  }

  private handleExploreSchool = _memoize((link: string): (() => void) => (): void => {
    window.open(link, '_blank')
    this.props.handleExplore('school')()
  })

  private handleExploreSchoolList = (): void => {
    const {adviceData: {schoolListLink = ''} = {}, handleExplore} = this.props
    handleExplore('more schools')()
    window.open(schoolListLink, 'blank')
  }

  private renderAgeSpecificParagraph = (isMinor: boolean): React.ReactNode => {
    const {userYou} = this.props
    if (isMinor) {
      return <span>
        Comme {userYou('tu es', 'vous êtes')} mineur,
        <ul>
          <li>Soit ce sont {userYou('tes', 'vos')} parents qui empruntent
            pour {userYou('toi', 'vous')}.
          </li>
          <li>Soit {userYou('tes', 'vos')} parents ne peuvent
            pas {userYou("t'", 'vous ')}aider. Dans ce cas, des structures comme les
            missions locales peuvent {userYou("t'", 'vous ')}accompagner. Ils
            pourront {userYou("t'", 'vous ')}aider à obtenir une caution publique.
          </li>
        </ul>
      </span>
    }
    return <span>
      Comme {userYou('tu es majeur, tu peux', 'vous êtes majeur, vous pouvez')} contacter
      directement une des banques partenaires pour faire {userYou('ta', 'votre')} demande
      de prêt. {userYou('Tu auras', 'Vous aurez')} ensuite besoin de prouver
      que {userYou('tu pourras', 'vous pourrez')} rembourser le prêt.
    </span>
  }

  private renderExplanation(style: React.CSSProperties, isMinor: boolean): React.ReactNode {
    const {userYou} = this.props
    return <div style={style}>
      Grâce au dispositif "permis à 1€ par jour" mis en place par
      l'État, {userYou('tu peux', 'vous pouvez')} demander un prêt d'une banque d'un montant de
      600, 800, 1&nbsp;000 ou 1&nbsp;200&nbsp;€ pour financer {userYou('ton', 'votre')} permis de
      conduire (en fonction des tarifs de l'auto-école). Les intérêts du prêt sont pris en charge
      par l'État.<br /><br />

      De {userYou('ton côté, tu dois', 'votre côté, vous devez')} rembourser 30&nbsp;€
      par mois.
      <br /><br />
      {this.renderAgeSpecificParagraph(isMinor)}
    </div>
  }

  private renderFindingSchool(key): React.ReactNode {
    const {
      adviceData: {schoolListLink, schools = []},
      handleExplore,
      project: {city},
      userYou,
    } = this.props

    if (!schoolListLink && !schools.length) {
      return null
    }
    const maybeS = schools.length > 1 ? 's' : ''
    const itemStyle = {
      alignItems: 'center',
      display: 'flex',
    }
    const maybeMore = schools.length ? "Plus d'auto-écoles" :
      'Accédez à la liste des auto-écoles'
    const inDepartment =
      city && inDepartement(city) || `dans ${userYou('ton', 'votre')} département`
    return <ExpandableAction key={key}
      contentName="la liste des auto-écoles"
      title="Trouver une auto-école agréée pour le permis à 1&nbsp;€"
      onContentShown={handleExplore('schools')}
      userYou={userYou}>
      <div style={{marginBottom: 20}}>
        Nous avons trouvé {schools.length ?
          <span><GrowingNumber style={{fontWeight: 'bold'}}
            number={schools.length} isSteady={true} /> auto-école{maybeS} agréée{maybeS}</span> :
          <span>la liste des auto-écoles agréées</span>
        } près de chez {userYou('toi', 'vous')}
        <AdviceSuggestionList style={{marginTop: 10}}>
          {[
            ...schools.map(({address, link, name}, index): ReactStylableElement =>
              <div
                onClick={link && this.handleExploreSchool(link) || undefined}
                style={itemStyle} key={`school-${index}`}>
                <div style={{marginRight: 10, width: 200}}>
                  {name}
                </div>
                <div>{address}</div>
              </div>
            ),
            schoolListLink ?
              <div
                key={key} style={itemStyle}
                onClick={this.handleExploreSchoolList}>
                {maybeMore} agréées pour le permis à 1&nbsp;€ {inDepartment}
                <div style={{flex: 1}} />
                <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, width: 20}} />
              </div> : null,
          ]}
        </AdviceSuggestionList>
      </div>
    </ExpandableAction>
  }

  private renderDocumentation(key, isMinor): React.ReactNode {
    const {
      adviceData: {missionLocale},
      handleExplore,
      project: {city: {departementName = ''} = {}},
      userYou,
    } = this.props
    if (isMinor) {
      const comparatorStyle: React.CSSProperties = {
        color: colors.COOL_GREY,
        fontSize: 13,
        fontStyle: 'italic',
        fontWeight: 'normal',
      }
      const missionLocaleLink = missionLocaleUrl(missionLocale, departementName)
      return <ExpandableAction
        {...{key, userYou}}
        onContentShown={handleExplore('documentation-minor')}
        title={`Expliquer le permis à 1\u00A0€ à ${userYou('tes', 'vos')} parents ou bien
          contacter ${userYou('ta', 'votre')} Mission Locale`}>
        <div>
          Si ce sont {userYou('tes', 'vos')} parents qui empruntent
          pour {userYou('toi', 'vous')}, vous pouvez leur expliquer que :<br />
          <ul>
            <li>Le "permis à un euro par jour" a été mis en place par l'État, en partenariat avec
              des banques et des écoles de conduite.
            </li>
            <li>Cela permet d'obtenir un prêt d'une banque d'un montant de 600, 800, 1&nbsp;000 ou
              1&nbsp;200&nbsp;€ pour financer le permis. Les intérêts du prêt seront pris en charge
              par l'État et vous devez rembourser 30&nbsp;€ par mois.
            </li>
          </ul>
          <div>
            Si {userYou('tes', 'vos')} parents ne peuvent
            pas {userYou("t'", 'vous ')}aider,
            {userYou(' tu peux', ' vous pouvez')} contacter
            {userYou(' ta', ' votre')} Mission Locale qui pourra
            peut-être {userYou("t'", 'vous ')}aider (attention ça n'est pas sur à 100%,
            même si {userYou('tu remplis', 'vous remplissez')} tous les critères)
          </div>
          <ToolCard
            imageSrc={missionLocaleImage}
            hasBorder={true}
            href={missionLocaleLink}
            onClick={handleExplore('tool')}
            style={{margin: '35px 0'}}>
            Mission Locale
            <div style={{fontSize: 13, fontWeight: 'normal'}}>
              obtenir une caution publique
            </div>
            <div style={comparatorStyle}>Association pour l'insertion des jeunes</div>
          </ToolCard>
        </div>
      </ExpandableAction>
    }
    const youCanRefundYour =
      userYou('tu pourras rembourser ton', 'vous pourrez rembourser votre')

    return <ExpandableAction
      {...{key, userYou}} onContentShown={handleExplore('documentation')}
      contentName="les options possibles"
      title={`Réunir les documents pour montrer que ${youCanRefundYour} prêt`}>
      <div>
        3 options pour montrer que {userYou('tu peux', 'vous pouvez')} rembourser le
        prêt&nbsp;:<br />
        <ul>
          <li>
            un justificatif de revenus qui montre
            que {userYou('tu pourras', 'vous pourrez')} rembourser les
            30&nbsp;€&nbsp;/&nbsp;mois
          </li>
          <li>
            <strong>ou</strong> une personne caution, c'est-à-dire quelqu'un qui s'engage à
            rembourser {userYou("ton prêt si tu n'y arrives ", "votre prêt si vous n'y arrivez ")}
            pas
          </li>
          <li>
            <strong>ou</strong> un co-emprunteur, une autre personne emprunte
            avec {userYou('toi pour augmenter tes', 'vous pour augmenter vos')} chances
            d'avoir une réponse positive de la banque.
          </li>
        </ul>
      </div>
    </ExpandableAction>
  }

  private renderFindABank(key): React.ReactNode {
    const {adviceData: {partnerBanks}, handleExplore, userYou} = this.props
    if (!partnerBanks || !partnerBanks.length) {
      return null
    }
    return <ExpandableAction
      {...{key, userYou}} onContentShown={handleExplore('banks list')}
      contentName="la liste des banques"
      title={`Trouver un partenaire financier pour
        faire ${userYou('ta', 'votre')} demande de prêt`}>
      <div style={{marginBottom: 20}}>
        Nous {userYou("t'", 'vous ')}avons réuni une liste de partenaires qui
        peuvent {userYou("t'", 'vous ')}aider à
        financer {userYou('ton', 'votre')} permis à 1&nbsp;€.<br />
        {userYou('Tu peux aussi contacter ta ', 'Vous pouvez aussi contacter votre ')}
        banque pour savoir si elle propose des prêts permis à 1&nbsp;€.
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
            </ExternalLink>
          )}
        </div>
      </div>
    </ExpandableAction>
  }

  public render(): React.ReactNode {
    const {advice: {adviceId}, handleExplore, profile: {yearOfBirth}, userYou} = this.props

    const isMinor = (yearOfBirth && (new Date().getFullYear() - yearOfBirth) < 18) || false

    const emails = (getEmailTemplates(userYou)[adviceId] || []).
      map((template, index): React.ReactNode =>
        <EmailTemplate
          {...template} key={`email-${index}`} userYou={userYou}
          onContentShown={handleExplore('email')} />
      )
    const actions = [
      this.renderFindingSchool('finding-school'),
      ...emails,
      this.renderDocumentation('documents', isMinor),
      this.renderFindABank('find-a-bank'),
    ]

    const detailsLinkStyle: React.CSSProperties = {
      color: colors.COOL_GREY,
      fontSize: '.9em',
      fontStyle: 'italic',
    }

    return <div style={{fontSize: 16}}>
      {this.renderExplanation({marginBottom: 35}, isMinor)}
      {actions}
      <div style={{marginTop: 35}}>
        <ExternalLink
          style={detailsLinkStyle}
          href="http://www.securite-routiere.gouv.fr/permis-de-conduire/passer-son-permis/le-permis-a-1-euro-par-jour/informations">
          Plus d'infos sur le permis à 1&nbsp;€ par jour
        </ExternalLink>
      </div>
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.OneEuroProgram, CardProps>(
    ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
