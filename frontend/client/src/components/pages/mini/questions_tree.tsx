import competencesImage from 'images/mini/competences.svg'
import entourageImage from 'images/mini/entourage.svg'
import experienceImage from 'images/mini/exp.svg'
import financesImage from 'images/mini/finance.svg'
import logementImage from 'images/mini/logement.svg'
import loisirsImage from 'images/mini/loisirs.svg'
import mobiliteImage from 'images/mini/mobilite.svg'
import parcoursImage from 'images/mini/parcours.svg'
import santeImage from 'images/mini/sante.svg'


export type TopicId =
  'competences' | 'parcours' | 'experience' | 'mobilite' | 'logement' | 'finances' |
  'entourage' | 'sante' | 'loisirs'


export type QuestionType = 'yes/no/later' | 'yes/no' | 'confidence' | 'levels'


export interface Question {
  nextUrl?: string
  numSteps?: number
  numStepsDone?: number
  readonly question: React.ReactNode
  readonly type: QuestionType
  readonly url: string
}


export type AnswerType = -2 | -1 | 1 | 2 | boolean | 'later'


export interface Topic {
  readonly color: string
  firstQuestionUrl?: string
  readonly image: string
  nextTopic?: string
  readonly questions: Question[]
  readonly talkAboutIt: string
  readonly title: string
  readonly url: TopicId
}


const QUESTIONS_TREE: Topic[] = [
  {
    color: colors.MINI_TOPIC_SKILLS,
    image: competencesImage,
    questions: [
      {
        question: "À travers mes différentes expériences professionnelles ou personnelles, j'ai " +
          'pu identifier certaines de mes compétences',
        type: 'yes/no',
        url: 'identifier',
      },
      {
        question: "Je considère que j'ai toutes les compétences pour réaliser mes projets",
        type: 'confidence',
        url: 'projets',
      },
      {
        question: 'Je sais comment je peux repérer mes compétences et les présenter',
        type: 'levels',
        url: 'presenter',
      },
    ],
    talkAboutIt: "qu'un professionnel de la Mission Locale m'aide à identifier mes compétences " +
      '(à travers un entretien, un atelier, etc.)',
    title: 'Mes compétences',
    url: 'competences',
  },
  {
    color: colors.MINI_TOPIC_TRAINING,
    image: parcoursImage,
    questions: [
      {
        question: "J'ai un diplôme de l'enseignement général ou une qualification " +
          'professionnelle (brevet des collèges, Bac, CAP, etc.)',
        type: 'yes/no',
        url: 'diplome',
      },
      {
        question: "Je pense que j'ai un niveau de formation suffisant pour trouver un emploi " +
          'dans un domaine qui me plait',
        type: 'confidence',
        url: 'suffisant',
      },
      {
        question: "Je connais les formations qui pourraient m'intéresser",
        type: 'levels',
        url: 'connaitre',
      },
    ],
    talkAboutIt: 'aborder la question de la formation',
    title: 'Mon parcours scolaire et ma formation',
    url: 'parcours',
  },
  {
    color: colors.MINI_TOPIC_WORK,
    image: experienceImage,
    questions: [
      {
        question: "J'ai une ou plusieurs expériences du monde du travail (stage, intérim, " +
          'alternance, CDD…)',
        type: 'yes/no',
        url: 'passe',
      },
      {
        question: "Je me sens capable de mener mes démarches d'emploi",
        type: 'confidence',
        url: 'pret',
      },
      {
        question: "Je connais et j'utilise les outils de recherche d'emploi (sites Internet où " +
          'sont diffusés les offres, CV, lettre de motivation, etc.)',
        type: 'levels',
        url: 'outils',
      },
    ],
    talkAboutIt: 'mieux connaitre certains secteurs professionnels (rencontrer des employeurs, ' +
      'des professionnels, tester certains métiers, mieux maitriser les outils pour rechercher ' +
      'du travail, etc.)',
    title: 'Mon expérience professionnelle',
    url: 'experience',
  },
  {
    color: colors.MINI_TOPIC_HEALTH,
    image: santeImage,
    questions: [
      {
        question: "J'ai vu un médecin au cours des 6 derniers mois",
        type: 'yes/no',
        url: 'medecin',
      },
      {
        question: 'Je considère que je suis en bonne santé',
        type: 'confidence',
        url: 'diagnostic',
      },
      {
        question: 'Je connais bien mes droits concernant la protection sociale (carte vitale, ' +
          'CMU, Sécurité sociale, une mutuelle, etc.)',
        type: 'levels',
        url: 'droits',
      },
    ],
    talkAboutIt: 'aborder la question de la santé et/ou de la protection sociale',
    title: 'Ma santé',
    url: 'sante',
  },
  {
    color: colors.MINI_TOPIC_FINANCE,
    image: financesImage,
    questions: [
      {
        question: "J'ai des ressources financières régulières",
        type: 'yes/no',
        url: 'ressources',
      },
      {
        question: 'Je considère que ma situation financière est satisfaisante',
        type: 'confidence',
        url: 'satisfaisant',
      },
      {
        question: 'Je sais gérer mon budget',
        type: 'levels',
        url: 'budget',
      },
    ],
    talkAboutIt: 'aborder cette question financière',
    title: 'Mes finances',
    url: 'finances',
  },
  {
    color: colors.MINI_TOPIC_MOBILITY,
    image: mobiliteImage,
    questions: [
      {
        question: "J'ai accès à des moyens de transports adaptés à mes besoins",
        type: 'yes/no',
        url: 'vehicule',
      },
      {
        question: 'Je me sens autonome dans mes déplacements',
        type: 'confidence',
        url: 'autonome',
      },
      {
        question: 'Je sais où trouver les informations sur les moyens de transports nécessaires ' +
          'pour me déplacer',
        type: 'levels',
        url: 'transports',
      },
    ],
    talkAboutIt: 'aborder cette question de transport',
    title: 'Ma mobilité',
    url: 'mobilite',
  },
  {
    color: colors.MINI_TOPIC_HOUSING,
    image: logementImage,
    questions: [
      {
        question: "J'ai un logement fixe",
        type: 'yes/no',
        url: 'stable',
      },
      {
        question: 'Je suis satisfait·e de mes conditions de logement actuelles',
        type: 'confidence',
        url: 'satisfaisant',
      },
      {
        question: "Je sais à qui je peux m'adresser si j'ai besoin d'infos pour accéder à un " +
          "logement, m'y maintenir",
        type: 'levels',
        url: 'infos',
      },
    ],
    talkAboutIt: 'aborder cette question de logement',
    title: 'Mon logement',
    url: 'logement',
  },
  {
    color: colors.MINI_TOPIC_CIRCLES,
    image: entourageImage,
    questions: [
      {
        question: "J'ai de la famille ou des amis sur qui je peux compter",
        type: 'yes/no',
        url: 'proches',
      },
      {
        question: 'Je me sens bien entouré·e (amis, famille, etc.)',
        type: 'confidence',
        url: 'equilibre',
      },
      {
        question: "Je sais où je peux rencontrer d'autres jeunes et avec qui je peux échanger " +
          "quand j'en ai besoin",
        type: 'levels',
        url: 'rencontrer',
      },
    ],
    talkAboutIt: 'aborder cette question de la vie sociale, des relations aux autres',
    title: 'Mon entourage familial et mes relations sociales',
    url: 'entourage',
  },
  {
    color: colors.MINI_TOPIC_HOBBIES,
    image: loisirsImage,
    questions: [
      {
        question: "Je pratique une activité sportive ou j'ai des loisirs (foot, jeux vidéo, " +
          'musique, bénévolat, etc.)',
        type: 'yes/no',
        url: 'pratiquer',
      },
      {
        question: 'Je suis satisfait·e des loisirs et des activités extra-professionnelles ' +
          'auxquelles je participe',
        type: 'confidence',
        url: 'satisfaisant',
      },
      {
        question: 'Je connais les associations et clubs de sport près de chez moi',
        type: 'levels',
        url: 'connaitre',
      },
    ],
    talkAboutIt: "aborder cette question des loisirs, du sport, de l'engagement",
    title: 'Mes loisirs et mes activités extra-professionnelles',
    url: 'loisirs',
  },
]


// Add a field `firstQuestionUrl` to each topic with the URL of the first question.
function addFirstQuestionUrls(tree: Topic[]): void {
  tree.forEach((topic: Topic): void => {
    const {questions, url} = topic
    if (questions && questions[0] && questions[0].url) {
      topic.firstQuestionUrl = `${url}/${questions[0].url}`
    }
  })
}


// Add a field `nextUrl` to each question with the URL of the next question.
function addNextQuestionUrls(tree: Topic[]): void {
  tree.forEach((topic: Topic): void => {
    if (!topic.questions) {
      return
    }
    topic.questions.forEach((question: Question, index: number): void => {
      if (topic.questions[index + 1]) {
        question.nextUrl = `${topic.url}/${topic.questions[index + 1].url}`
      }
    })
  })
}


// Add two fields numSteps and numStepsDone to each question.
function countSteps(tree: Topic[]): void {
  tree.forEach((topic: Topic): void => {
    if (!topic.questions) {
      return
    }
    topic.questions.forEach((question: Question, index: number): void => {
      question.numSteps = topic.questions.length
      question.numStepsDone = index
    })
  })
}


// Add a field `nextTopic` to each topic.
function addNextTopicUrls(tree: Topic[]): void {
  tree.forEach((topic: Topic, index: number): void => {
    if (tree[index + 1]) {
      topic.nextTopic = tree[index + 1].url
    }
  })
}


addFirstQuestionUrls(QUESTIONS_TREE)
addNextQuestionUrls(QUESTIONS_TREE)
countSteps(QUESTIONS_TREE)
addNextTopicUrls(QUESTIONS_TREE)


export {QUESTIONS_TREE}
