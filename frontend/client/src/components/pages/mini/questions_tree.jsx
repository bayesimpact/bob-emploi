import competencesImage from 'images/mini/competences.svg'
import entourageImage from 'images/mini/entourage.svg'
import experienceImage from 'images/mini/exp.svg'
import financesImage from 'images/mini/finance.svg'
import logementImage from 'images/mini/logement.svg'
import loisirsImage from 'images/mini/loisirs.svg'
import mobiliteImage from 'images/mini/mobilite.svg'
import parcoursImage from 'images/mini/parcours.svg'
import santeImage from 'images/mini/sante.svg'


const QUESTIONS_TREE = [
  {
    color: colors.MINI_TOPIC_SKILLS,
    image: competencesImage,
    questions: [
      {
        question: "J'ai déjà fait un travail pour identifier mes compétences",
        type: 'yes/no',
        url: 'identifier',
      },
      {
        question: "Je considère que j'ai les compétences pour réaliser mes projets",
        type: 'confidence',
        url: 'projets',
      },
      {
        question: 'Je sais repérer mes compétences et les présenter',
        type: 'levels',
        url: 'presenter',
      },
    ],
    talkAboutIt: 'aborder la question de mes compétences',
    title: 'Mes compétences',
    url: 'competences',
  },
  {
    color: colors.MINI_TOPIC_TRAINING,
    image: parcoursImage,
    questions: [
      {
        question: "J'ai un diplôme de l'enseignement général ou une qualification " +
          'professionnelle reconnue par un diplôme (brevet des collèges, Bac, CAP, etc.)',
        type: 'yes/no',
        url: 'diplome',
      },
      {
        question: "J'ai déjà réalisé une formation professionnalisante",
        type: 'yes/no',
        url: 'formation',
      },
      {
        // TODO(pascal): Handle non-masculine gender.
        question: 'Je pense être suffisamment formé pour trouver un emploi dans un domaine ' +
          'qui me plait',
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
        question: "Je me considère suffisamment prêt pour mener mes démarches d'emploi",
        type: 'confidence',
        url: 'pret',
      },
      {
        question: "Je connais et j'utilise les outils de recherche d'emploi",
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
        question: "J'ai un médecin traitant",
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
          'CMU, Sécurité sociale, une mutuelle…)',
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
        question: "J'ai un moyen de locomotion ou j'ai accès à des moyens de transports " +
          'adaptés à mes besoins et mes projets personnels et professionnels',
        type: 'yes/no',
        url: 'vehicule',
      },
      {
        question: 'Je me sens autonome dans mes déplacements',
        type: 'confidence',
        url: 'autonome',
      },
      {
        question: 'Je sais trouver les moyens de transports nécessaires pour me déplacer',
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
        question: "J'habite dans un logement stable",
        type: 'yes/no',
        url: 'stable',
      },
      {
        question: 'Je suis satisfait de mes conditions de logement actuelles',
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
        question: "J'ai des amis et/ou des proches sur qui je peux compter",
        type: 'yes/no',
        url: 'proches',
      },
      {
        question: "Je pense avoir des relations familiales et d'amitiés équilibrées",
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
          'musique, bénévolat)',
        type: 'yes/no',
        url: 'pratiquer',
      },
      {
        question: "Je considère que ma vie côté loisirs, pratique d'un sport, bénévolat, est " +
          'satisfaisante',
        type: 'confidence',
        url: 'satisfaisant',
      },
      {
        question: 'Je connais les clubs de sport, les lieux de détente et de loisirs qui sont ' +
          'près de chez moi',
        type: 'levels',
        url: 'connaitre',
      },
    ],
    talkAboutIt: "aborder cette question des loisirs, du sport, de l'engagement",
    title: 'Mes loisirs et mes engagements',
    url: 'loisirs',
  },
]


// Add a field `firstQuestionUrl` to each topic with the URL of the first question.
function addFirstQuestionUrls(tree) {
  tree.forEach(topic => {
    const {questions, url} = topic
    if (questions && questions[0] && questions[0].url) {
      topic.firstQuestionUrl = `${url}/${questions[0].url}`
    }
  })
}


// Add a field `nextUrl` to each question with the URL of the next question.
function addNextQuestionUrls(tree) {
  tree.forEach(topic => {
    if (!topic.questions) {
      return
    }
    topic.questions.forEach((question, index) => {
      if (topic.questions[index + 1]) {
        question.nextUrl = `${topic.url}/${topic.questions[index + 1].url}`
      }
    })
  })
}


// Add two fields numSteps and numStepsDone to each question.
function countSteps(tree) {
  tree.forEach(topic => {
    if (!topic.questions) {
      return
    }
    topic.questions.forEach((question, index) => {
      question.numSteps = topic.questions.length
      question.numStepsDone = index
    })
  })
}


// Add a field `nextTopic` to each topic.
function addNextTopicUrls(tree) {
  tree.forEach((topic, index) => {
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
