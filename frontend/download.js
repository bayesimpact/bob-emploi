const Airtable = require('airtable')
const fs = require('fs')
const stringify = require('json-stable-stringify')
const forEach = require('lodash/forEach')
const fromPairs = require('lodash/fromPairs')
const keyBy = require('lodash/keyBy')
const mapValues = require('lodash/mapValues')

const adviceBase = new Airtable().base('appXmyc7yYj0pOcae')
const romeBase = new Airtable().base('appMRMtWV61Kibt37')

// TODO(cyrille): Test this file.
// TODO(cyrille): Make config more declarative.
// This file downloads from airtable static data to be put in the JavaScript application. To use it
// run :
// docker-compose run --rm frontend-dev-webpack npm run download
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

const throwError = err => {
  if (err) {
    throw err
  }
}

const translations = new Airtable().base('appkEc8N0Bw4Uok43').
  table('translations').select({view: 'viwLyQNlJtyD4l45k'}).all().
  then(translations => keyBy(translations.map(record => record.fields), 'string'), throwError)

function checkNotRegexp(regexp, errorMessage, text) {
  if (regexp.test(text)) {
    throw errorMessage
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
  adviceBase.table('advice_modules').select({view: 'Ready to Import'}).all()

const emailTemplatesFromAirtable =
  adviceBase.table('email_templates').select({view: 'Ready to Import'}).all()

const eventsFromAirtable =
  romeBase.table('Event Types').select({view: 'viwUsUaBuIuYmz4ZK'}).all()

// STEP 2 //

const getTranslationOrThrow = (object, lang, sentence) => {
  if (!object) {
    throw `The sentence "${sentence}" was not found in the translation table. Please collect
    sentences to translate first.`
  }
  const translated = object[lang]
  if (translated) {
    return translated
  }
  throw `The sentence "${sentence}" was not translated into "${lang}".`
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
  }, throwError)

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
    title,
    title_1_star: title1Star,
    title_2_stars: title2Stars,
    title_3_stars: title3Stars,
    user_gain_callout: userGainCallout,
    user_gain_details: userGainDetails,
  } = record.fields
  if (title1Star && title1Star === title2Stars && title1Star === title3Stars) {
    throw `The advice module "${adviceId}" has a
    redundant title. Clear the title_x_star properties and only keep the
    title.`
  }
  const newModule = {
    callToAction,
    goal,
    title,
    titleXStars: {
      1: title1Star,
      2: title2Stars,
      3: title3Stars,
    },
    userGainCallout,
    userGainDetails,
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
    throw `Advice ${adviceId} is not in any topic and will not be shown in the explorer.`
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

// Step 5 //

const writeToJson = jsonFile => jsonObject => {
  fs.writeFile(jsonFile, stringify(jsonObject, {space: 2}) + '\n', throwError)
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
    then(translateRecords(langs, translatableFields), throwError).
    then(objectsByLang => mapValues(objectsByLang, mapReducer), throwError)

fromAirtableToObjects(
  adviceModulesFromAirtable,
  adviceModulesTranslatableFields,
  reduceAdviceModules,
).then(jsonObjectsByLang => {
  writeWithTranslations(
    'src/components/advisor/data/advice_modules', ({modules}) => modules)(jsonObjectsByLang)
  writeToJson('src/components/advisor/data/categories.json')(jsonObjectsByLang.original.categories)
}, throwError)

fromAirtableToObjects(
  emailTemplatesFromAirtable,
  emailTemplatesTranslatableFields,
  reduceEmailTemplates,
).then(writeWithTranslations('src/components/advisor/data/email_templates'), throwError)

fromAirtableToObjects(
  eventsFromAirtable,
  eventsTranslatableFields,
  reduceEvents,
).then(writeWithTranslations('src/components/advisor/data/events'), throwError)
