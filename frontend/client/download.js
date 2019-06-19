const Airtable = require('airtable')
const fs = require('fs')
const stringify = require('json-stable-stringify')
const forEach = require('lodash/forEach')
const fromPairs = require('lodash/fromPairs')
const keyBy = require('lodash/keyBy')
const mapValues = require('lodash/mapValues')

const adviceBase = new Airtable().base('appXmyc7yYj0pOcae')
const romeBase = new Airtable().base('appMRMtWV61Kibt37')

/* eslint-disable no-console */

// TODO(cyrille): Make config more declarative.
// This file downloads from airtable static data to be put in the JavaScript application. To use it
// run :
// docker-compose run --rm frontend-dev npm run download
//
// Or pick a specific table to download:
//
// docker-compose run --rm frontend-dev npm run download events
//
// For each data file, the gathering of information is in five steps:
// - download the data from airtable as a list of records (easy step).
//      This is done using airtable API, which is asynchronous, so we get a promise of a list of
//      records, which are (for our purposes) objects with an `id` field and a `fields` field which
//      contains all the fields from the table. This steps only need the necessary info to fetch
//      from airtable (base, table and view)
// - translate that list in all specified languages, using the `translateRecords` function
//      This function returns an object of the form {original: [...], fr_FR: [...], ...} with the
//      original and translated lists. Since getting the translation information is asynchronous,
//      the function rather returns a promise of this object. This steps only need the languages to
//      translate into and the fields to translate.
// - apply a function on each record, to extract what is actually needed from it (easy step).
//      This step will contain the logic of what we actually want to get from the table, so it is
//      heavily dependant on the downloaded data.
// - reduce the data gathered from each record into one object.
//      The two last steps are done using the `reduceRecord` function, which takes as parameters
//      the mapping function (from the previous step) and the reducing function (from this step) to
//      build a state-free reducer. By state-free, I mean that it should have no side-effect,
//      because it will be run several times (for each translated version). The reducing function
//      also depends on the specific data (more precisely on the schema in which we put the data).
// - write the result to JSON files.
//      This is done by the `writeToJson` function if no translation is needed or the
//      `writeWithTranslations` function. This last one takes as input an object with keys as given
//      from `translateRecords`, so the steps in between can be applied uniforamlly using
//      lodash/mapValues. This step is mainly implemented inside the helper functions, but some
//      preparation might be needed in some cases, depending on the data (see `writeWithTranslation`
//      doc for preparation handling).

const shouldDownloadAll = process.argv.length === 2
const isDryRun = !!process.env.DRY_RUN

const shouldDownload = {
  'advice_modules': shouldDownloadAll,
  'email_templates': shouldDownloadAll,
  'events': shouldDownloadAll,
  'strategy_goals': shouldDownloadAll,
  'strategy_testimonials': shouldDownloadAll,
}

if (!shouldDownloadAll) {
  const tables = Object.keys(shouldDownload)
  process.argv.slice(2).forEach(arg => {
    if (!tables.includes(arg)) {
      throw new Error(`"${arg}" is not valid table name, it should be one of: ${tables}`)
    }
    shouldDownload[arg] = true
  })
}

const throwError = err => {
  console.log(err)
  if (!isDryRun) {
    throw new Error(err)
  }
}


const maybeThrowError = err => {
  if (err) {
    throwError(err.message || JSON.stringify(err))
  }
}

const translations = new Airtable().base('appkEc8N0Bw4Uok43').
  table('translations').select({view: 'viwLyQNlJtyD4l45k'}).all().
  then(translations => keyBy(translations.map(record => record.fields), 'string'), maybeThrowError)

// TODO(cyrille): Throw on trailing spaces.
function checkNotRegexp(regexp, errorMessage, text) {
  if (regexp.test(text)) {
    throwError(errorMessage)
  }
  return text
}
const checkNoCurlyQuotes = (text, context) =>
  checkNotRegexp(
    /’/,
    `Curly quotes ’ are not allowed in ${context}: "${text}"`,
    text
  )

// STEP 1 //

const adviceModulesFromAirtable =
  shouldDownload['advice_modules'] &&
  adviceBase.table('advice_modules').select({view: 'Ready to Import'}).all()

const emailTemplatesFromAirtable =
  shouldDownload['email_templates'] &&
  adviceBase.table('email_templates').select({view: 'Ready to Import'}).all()

const eventsFromAirtable =
  shouldDownload['events'] &&
  romeBase.table('Event Types').select({view: 'viwUsUaBuIuYmz4ZK'}).all()

const strategyGoalsFromAirtable =
  shouldDownload['strategy_goals'] &&
  adviceBase.table('strategy_goals').select({view: 'Ready to Import'}).all()

const strategyTestimonialsFromAirtable =
  shouldDownload['strategy_testimonials'] &&
  adviceBase.table('strategy_testimonials').select({view: 'Ready to Import'}).all()

// STEP 2 //

const getTranslationOrThrow = (object, lang, sentence) => {
  if (!object) {
    console.log('To collect the sentences to translate:')
    console.log('    docker-compose run --rm data-analysis-prepare i18n/collect_strings.py')
    console.log('To translate sentences:')
    console.log('    https://airtable.com/tblQL7A5EgRJWhQFo/viwBe1ySNM4IvXCsN')
    throwError(`The sentence "${sentence}" was not found in the translation table.`)
  }
  const translated = object[lang]
  if (translated) {
    return translated
  }
  throwError(`The sentence "${sentence}" was not translated into "${lang}".`)
  return sentence
}

// Translates a list of records as output from airtable, using a list of locales to match the
// translation table, and a list of translatable fields (other fields won't be translated). Any
// missing translation key or locale specific translation will throw an error.
// Outputs an object whose keys are the locale and the reserved word `original`, and whose values
// are the translated list of records.
const translateRecords = (langs, translatableFields) => airTableRecords =>
  translations.then(translationDict => {
    // Make one records list for each lang.
    const recordsByLang = fromPairs(langs.map(lang => [lang, []]))
    airTableRecords.forEach(({fields, id}) => {
      // Make one record.fields object for each lang.
      const recordFieldsByLang = fromPairs(langs.map(lang => [lang, {}]))
      forEach(fields, (value, field) => {
        // Translate each translatable field (or throw error).
        if (translatableFields.includes(field)) {
          const fieldByLang = translationDict[value]
          langs.forEach(lang =>
            recordFieldsByLang[lang][field] = getTranslationOrThrow(fieldByLang, lang, value))
        } else {
          // Copy all other fields.
          langs.forEach(lang => recordFieldsByLang[lang][field] = value)
        }
      })
      // Push all translated records into their respective list.
      forEach(recordFieldsByLang, (fields, lang) => recordsByLang[lang].push({fields, id}))
    })
    return {...recordsByLang, original: airTableRecords}
  }, maybeThrowError)

// Please, keep in sync with
// data_analysis/i18n/collect_strings.py StringCollector.collect_for_client
const adviceModulesTranslatableFields = [
  'explanations (for client)',
  'goal',
  'title',
  'title_3_stars',
  'title_2_stars',
  'title_1_star',
  'user_gain_details',
]

const emailTemplatesTranslatableFields = ['reason', 'title']

const eventsTranslatableFields = ['event_location_prefix', 'event_location']

const strategyGoalsTranslatableFields = ['content']

const strategyTestimonialsTranslatableFields = ['content', 'job']

// Step 3 //

const mapAdviceModules = record => {
  forEach(
    record.fields,
    (text, key) => checkNoCurlyQuotes(text, `${key} field of advice_modules`),
  )
  const {
    advice_id: adviceId,
    call_to_action: callToAction,
    diagnostic_topics: diagnosticTopics,
    'explanations (for client)': explanations,
    goal,
    short_title: shortTitle,
    title,
    title_1_star: title1Star,
    title_2_stars: title2Stars,
    title_3_stars: title3Stars,
    user_gain_callout: userGainCallout,
    user_gain_details: userGainDetails,
  } = record.fields
  if (title1Star && title1Star === title2Stars && title1Star === title3Stars) {
    throwError(`The advice module "${adviceId}" has a
    redundant title. Clear the title_x_star properties and only keep the
    title.`)
  }
  const newModule = {
    callToAction,
    goal,
    shortTitle,
    title,
    titleXStars: {
      1: title1Star,
      2: title2Stars,
      3: title3Stars,
    },
    userGainCallout,
    userGainDetails,
  }
  if (!goal) {
    throwError(`Advice ${adviceId} does not have a goal set.`)
  }
  if (explanations) {
    newModule.explanations = explanations.split('\n').
      map(text => checkNotRegexp(
        /(^\s+|\s+$)/,
        `Explanations should not have extra spaces before or after: "${text}".`,
        text,
      )).
      map(text => checkNotRegexp(
        /^[A-Z]/,
        `Explanations should not start with an uppercase letter: "${text}".`,
        text,
      ))
  }
  if (!diagnosticTopics || !diagnosticTopics.length) {
    throwError(`Advice ${adviceId} is not in any topic and will not be shown in the explorer.`)
  }
  return {adviceId, newModule, topics: diagnosticTopics}
}

const mapEmailTemplates = record => {
  forEach(
    record.fields,
    (text, key) => checkNoCurlyQuotes(text, `${key} field of email_templates`),
  )
  const {
    advice_id: adviceId,
    content,
    filters,
    personalizations,
    reason,
    title,
    type,
  } = record.fields
  return {adviceId, newTemplate: {content, filters, personalizations, reason, title, type}}
}

const mapEvents = record => {
  forEach(record.fields, (text, key) => checkNoCurlyQuotes(text, `${key} field of Event Types`))
  const {
    'event_location_prefix': atNext,
    'event_location': eventLocation,
    'rome_prefix': romePrefix,
  } = record.fields
  if (atNext && eventLocation && romePrefix) {
    return {[romePrefix]: {atNext, eventLocation}}
  }
}

const mapStrategyGoals = ({fields}) => {
  forEach(fields, (text, key) => checkNoCurlyQuotes(text, `${key} field of strategy_goals`))
  const {
    content,
    'goal_id': goalId,
    'strategy_ids': strategyIds,
  } = fields
  return {content, goalId, strategyIds}
}

const mapStrategyTestimonials = ({id, fields}) => {
  forEach(fields, (text, key) => checkNoCurlyQuotes(text, `${key} field of strategy_testimonials`))
  const {
    content,
    'created_at': createdAt,
    'is_male': isMale,
    job,
    name,
    rating,
    'strategy_ids': strategyIds,
  } = fields
  if (!content || !createdAt || !job || !name || !rating || !strategyIds || !strategyIds.length) {
    throwError(new Error(`Testimonial with record ID "${id}" has an empty field.`))
  }
  checkNotRegexp(
    / (\n|$)/,
    `Content of ${id} should not have extra spaces at the end of the line:
      "${content.replace(/ (\n|$)/g, '**$&**')}".`,
    content,
  )
  checkNotRegexp(
    / [?;:!]/,
    `Content of ${id} should have unbreakable space before a French double punctuation mark:
      "${content.replace(/ [?;:!]/g, '**$&**')}".`,
    content,
  )
  return {content, createdAt, isMale, job, name, rating, strategyIds}
}

// Step 4 //

const reduceRecords = (recordToResult, reduceResults, reduceZero) => records => records.
  map(recordToResult).reduce((acc, result) => reduceResults(acc, result), reduceZero || {})

const reduceAdviceModules = reduceRecords(
  mapAdviceModules,
  ({categories, modules}, {adviceId, newModule, topics}) => {
    const updatedTopics = fromPairs(topics.map(topic =>
      [topic, [...categories[topic] || [], adviceId]]))
    return {
      categories: {
        ...categories,
        ...updatedTopics,
      },
      modules: {
        ...modules,
        [adviceId]: newModule,
      },
    }
  },
  {categories: {}, modules: {}},
)

const reduceEmailTemplates = reduceRecords(
  mapEmailTemplates,
  (emailTemplates, {adviceId, newTemplate}) => {
    return {
      ...emailTemplates,
      [adviceId]: [
        ...emailTemplates[adviceId] || [],
        newTemplate,
      ],
    }
  },
)

const reduceEvents = reduceRecords(mapEvents, (accumulator, added) => ({...accumulator, ...added}))

const reduceStrategyGoals = reduceRecords(mapStrategyGoals,
  (strategies, {content, goalId, strategyIds}) => {
    // TODO(cyrille): Restrict the number of goals per strategy.
    const updatedStrategies = fromPairs(strategyIds.map(strategyId => {
      if (strategies[strategyId] && strategies[strategyId].length > 5) {
        throw new Error(`Strategy ${strategyId} has too many goals, please reduce to at most 6.`)
      }
      return [strategyId, [
        ...strategies[strategyId] || [],
        {content, goalId},
      ]]
    }))
    return {
      ...strategies,
      ...updatedStrategies,
    }
  }
)

const reduceStrategyTestimonials = reduceRecords(mapStrategyTestimonials,
  (strategies, {content, createdAt, isMale, job, name, rating, strategyIds}) => {
    const updatedStrategies = fromPairs(strategyIds.map(strategyId => [strategyId, [
      ...strategies[strategyId] || [],
      {content, createdAt, isMale, job, name, rating},
    ]]))
    return {
      ...strategies,
      ...updatedStrategies,
    }
  }
)

// Step 5 //

const writeToJson = jsonFile => jsonObject => {
  if (isDryRun) {
    return
  }
  fs.writeFile(jsonFile, stringify(jsonObject, {space: 2}) + '\n', maybeThrowError)
}

// Writes all the different version of a JSON object into multiple files, depending on locale.
// - `jsonFile` is the file where the original object should be put (without the .json extension)
// - `jsonObjectsByLang` is an object containing all the translated versions of the object to save,
//      the original one being under the key `original` and others under their locale
// - `prepare` is an optional function to apply on each translation of the object before it should
//      be saved
const writeWithTranslations = (jsonFile, prepare) => jsonObjectsByLang => {
  const {original, ...others} = prepare ? mapValues(jsonObjectsByLang, prepare) : jsonObjectsByLang
  writeToJson(jsonFile + '.json')(original)
  forEach(others, (translated, lang) => {
    writeToJson(`${jsonFile}_${lang}.json`)(translated)
  })
}

const langs = ['fr_FR@tu']

const fromAirtableToObjects = (airtablePromise, translatableFields, mapReducer) =>
  airtablePromise.
    then(translateRecords(langs, translatableFields), maybeThrowError).
    then(objectsByLang => mapValues(objectsByLang, mapReducer), maybeThrowError)

const noOp = Promise.resolve()

const importAdvices = shouldDownload['advice_modules'] ? fromAirtableToObjects(
  adviceModulesFromAirtable,
  adviceModulesTranslatableFields,
  reduceAdviceModules,
).then(jsonObjectsByLang => {
  writeWithTranslations(
    'src/components/advisor/data/advice_modules', ({modules}) => modules)(jsonObjectsByLang)
  writeToJson('src/components/advisor/data/categories.json')(jsonObjectsByLang.original.categories)
}, maybeThrowError) : noOp

const importEmailTemplates = shouldDownload['email_templates'] ? fromAirtableToObjects(
  emailTemplatesFromAirtable,
  emailTemplatesTranslatableFields,
  reduceEmailTemplates,
).then(writeWithTranslations('src/components/advisor/data/email_templates'), maybeThrowError) : noOp

const importEvents = shouldDownload['events'] ? fromAirtableToObjects(
  eventsFromAirtable,
  eventsTranslatableFields,
  reduceEvents,
).then(writeWithTranslations('src/components/advisor/data/events'), maybeThrowError) : noOp

const importStrategyGoals = shouldDownload['strategy_goals'] ? fromAirtableToObjects(
  strategyGoalsFromAirtable,
  strategyGoalsTranslatableFields,
  reduceStrategyGoals,
).then(writeWithTranslations('src/components/strategist/data/goals'), maybeThrowError) : noOp

// TODO(cyrille): Merge this with the previous one (goals) in a single file.
const importStrategyTestimonials = shouldDownload['strategy_testimonials'] ? fromAirtableToObjects(
  strategyTestimonialsFromAirtable,
  strategyTestimonialsTranslatableFields,
  reduceStrategyTestimonials,
).then(writeWithTranslations('src/components/strategist/data/testimonials'), maybeThrowError) : noOp

module.exports = Promise.all([
  importAdvices,
  importEmailTemplates,
  importEvents,
  importStrategyGoals,
  importStrategyTestimonials,
])
