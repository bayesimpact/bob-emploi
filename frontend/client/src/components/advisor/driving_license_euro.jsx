import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {getEmailTemplates, inDepartement} from 'store/french'
import {missionLocaleUrl} from 'store/job'

import {ExternalLink, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-driving-license-euro.png'
import missionLocaleImage from 'images/missions-locales-logo.png'

import {AdviceSuggestionList, connectExpandedCardWithContent,
  EmailTemplate, ExpandableAction, ToolCard} from './base'


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: String.isRequired,
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
    gender: PropTypes.string,
    isMinor: PropTypes.bool,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        departementName: PropTypes.string,
        departementPrefix: PropTypes.string,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderAgeSpecificParagraph = () => {
    const {isMinor, userYou} = this.props
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

  renderExplanation(style) {
    const {userYou} = this.props
    return <div style={style}>
      Le "permis à un euro par jour" a été mis en place par l'État, en partenariat avec des banques
      et des écoles de conduite.<br /><br />

      Concrètement lorsque {userYou(
        "tu t'inscris au permis, tu peux",
        'vous vous inscrivez au permis, vous pouvez',
      )} essayer d'obtenir un prêt d'une banque d'un montant de 600, 800, 1&nbsp;000 ou
      1&nbsp;200&nbsp;€ pour financer {userYou('ton', 'votre')} permis. Les intérêts du
      prêt seront pris en charge par l'État.<br />
      De {userYou('ton côté, tu dois', 'votre côté, vous devez')} rembourser 30&nbsp;€
      par mois.
      <br /><br />
      {this.renderAgeSpecificParagraph()}
    </div>
  }

  renderFindingSchool(key) {
    const {
      adviceData: {schoolListLink, schools = []},
      onExplore,
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
    const inDepartment = inDepartement(city) || `dans ${userYou('ton', 'votre')} département`
    return <ExpandableAction key={key}
      contentName="la liste des auto-écoles"
      title="Trouver une auto-école agréée pour le permis à 1&nbsp;€"
      onContentShown={() => onExplore('schools list')}
      userYou={userYou}>
      <div style={{marginBottom: 20}}>
        Nous avons trouvé {schools.length ?
          <span><GrowingNumber style={{fontWeight: 'bold'}}
            number={schools.length} isSteady={true} /> auto-école{maybeS} agréée{maybeS}</span> :
          <span>la liste des auto-écoles agréées</span>
        } près de chez {userYou('toi', 'vous')}
        <AdviceSuggestionList style={{marginTop: 10}}>
          {[
            ...schools.map(({address, link, name}, index) =>
              <div
                onClick={() => {
                  window.open(link, '_blank')
                  onExplore('school')
                }}
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
                onClick={() => window.open(schoolListLink, '_blank')}>
                {maybeMore} agréées pour le permis à 1&nbsp;€ {inDepartment}
                <div style={{flex: 1}} />
                <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, width: 20}} />
              </div> : null,
          ]}
        </AdviceSuggestionList>
      </div>
    </ExpandableAction>
  }

  renderDocumentation(key) {
    const {
      adviceData: {missionLocale},
      isMinor,
      onExplore,
      project: {city: {departementName = ''} = {}},
      userYou,
    } = this.props
    if (isMinor) {
      const comparatorStyle = {
        color: colors.COOL_GREY,
        fontSize: 13,
        fontStyle: 'italic',
        fontWeight: 'normal',
      }
      const missionLocaleLink = missionLocaleUrl(missionLocale, departementName)
      return <ExpandableAction
        {...{key, userYou}}
        onContentShown={() => onExplore('documentation-minor')}
        title={`Expliquer le permis à 1\xA0€ à ${userYou('tes', 'vos')} parents ou bien
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
            href={missionLocaleLink}
            onClick={() => onExplore('tool')}
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
      {...{key, userYou}} onContentShown={() => onExplore('documentation')}
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

  renderFindABank(key) {
    const {adviceData: {partnerBanks}, onExplore, userYou} = this.props
    if (!partnerBanks || !partnerBanks.length) {
      return null
    }
    return <ExpandableAction
      {...{key, userYou}} onContentShown={() => onExplore('banks list')}
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
          {partnerBanks.map(({link, logo, name}) =>
            <ExternalLink
              href={link} key={`partner-${name}`} onClick={() => onExplore('bank')}>
              <img src={logo} alt={name} style={{margin: 10, maxHeight: 60, maxWidth: 160}} />
            </ExternalLink>
          )}
        </div>
      </div>
    </ExpandableAction>
  }

  render() {
    const {advice: {adviceId}, onExplore, userYou} = this.props

    const emails = (getEmailTemplates(userYou)[adviceId] || []).map((template, index) =>
      <EmailTemplate
        {...template} key={`email-${index}`} userYou={userYou}
        onContentShown={() => onExplore('email')} />
    )
    const actions = [
      this.renderFindingSchool('finding-school'),
      ...emails,
      this.renderDocumentation('documents'),
      this.renderFindABank('find-a-bank'),
    ]

    return <div style={{fontSize: 16}}>
      {this.renderExplanation({marginBottom: 35})}
      {actions}
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent(({user}) => ({
  gender: user.profile && user.profile.gender,
  isMinor: (user.profile &&
    user.profile.yearOfBirth &&
    (new Date().getFullYear() - user.profile.yearOfBirth) < 18) || null,
}))(ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
