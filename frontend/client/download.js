// TODO(cyrille): Migrate to typescript, see https://github.com/TypeStrong/ts-node#usage.
const Airtable = require('airtable')
const fs = require('fs')
const stringify = require('json-stable-stringify')
const fromPairs = require('lodash/fromPairs')
const keyBy = require('lodash/keyBy')
require('json5/lib/register')

const airtableFields = require('./airtable_fields.json5')

const forEach = (object, action) =>
  Object.entries(object).forEach(([key, value]) => action(value, key))
const romeBase = new Airtable().base('appMRMtWV61Kibt37')

/* eslint-disable no-console */

// TODO(cyrille): Make config more declarative.
// This file downloads from airtable static data to be put in the JavaScript application. To use it
// run :
// docker-compose run --rm frontend-dev npm run download
//
// Or pick a specific table to download:
//
// docker-compose run --rm frontend-dev npm run download categories
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
  adviceModules: shouldDownloadAll,
  categories: shouldDownloadAll,
  emailTemplates: shouldDownloadAll,
  strategyGoals: shouldDownloadAll,
  vae: shouldDownloadAll,
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
const checkNotRegexpHighlight = (regexp, field, errorMessage, text) => checkNotRegexp(
  regexp, `${field} ${errorMessage}: "${text.replace(regexp, '**$&**')}".`, text)
const checkNoCurlyQuotes = (text, context) =>
  checkNotRegexp(
    /’/,
    // eslint-disable-next-line unicorn/string-content
    `Curly quotes ’ are not allowed in ${context}: "${text}"`,
    text,
  )

// STEP 1 //

const vaeFromAirtable =
  shouldDownload.vae &&
  romeBase.table('VAE Stats').select({view: 'Ready to Import'}).all()

// STEP 2 //

const getTranslationOrThrow = (object, lang, sentence, field) => {
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
  if (lang === 'fr') {
    return object.string
  }
  throwError(`The sentence "${sentence}" for field "${field}" was not translated into "${lang}".`)
  return sentence
}

// Gather strings to translate and their tranlations in multiple locales.
// The output is a tuple with the original records, then a map of translation dicts.
const gatherTranslations = (getLangsForField, contexts = ['']) => airTableRecords =>
  translations.then(translationDict => {
    // Make one records list for each lang.
    const translatedStringsByLang = {}
    airTableRecords.forEach(({fields}) => {
      forEach(fields, (value, field) => {
        // Translate each translatable field (or throw error).
        const fieldByLang = translationDict[value]
        getLangsForField(field).forEach(lang => {
          getTranslationOrThrow(fieldByLang, lang, value, field)
          contexts.forEach((context) => {
            const key = value + context
            const translatedValue = translationDict[key] && translationDict[key][lang]
            if (translatedValue && translatedValue !== value) {
              if (!translatedStringsByLang[lang]) {
                translatedStringsByLang[lang] = {}
              }
              translatedStringsByLang[lang][key] = translatedValue
            }
          })
        })
      })
    })
    return [airTableRecords, translatedStringsByLang]
  }, maybeThrowError)


// Step 3 //

const mapAdviceModules = record => {
  forEach(
    record.fields,
    (text, key) => checkNoCurlyQuotes(text, `${key} field of advice_modules`),
  )
  const {
    advice_id: adviceId,
    call_to_action: callToAction,
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
  return {adviceId, newModule}
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

const mapStrategyGoals = ({fields}) => {
  forEach(fields, (text, key) => checkNoCurlyQuotes(text, `${key} field of strategy_goals`))
  const {
    content,
    goal_id: goalId,
    step_title: stepTitle,
    strategy_ids: strategyIds,
  } = fields
  return {content, goalId, stepTitle, strategyIds}
}

const mapCategory = ({id, fields}) => {
  ['metric_title', 'metric_details'].forEach(fieldname => {
    const value = fields[fieldname]
    if (!value) {
      return
    }
    checkNoCurlyQuotes(value, `${fieldname} of ${id} of diagnostic_categories`)
    checkNotRegexpHighlight(
      /(^ | $)/g,
      `${fieldname} of ${id}`, 'should not have extra spaces at the beginning or end',
      value,
    )
    checkNotRegexpHighlight(
      / [!:;?]/g,
      `${fieldname} of ${id}`,
      'should have unbreakable space before a French double punctuation mark',
      value,
    )
    checkNotRegexpHighlight(
      /^[a-z]/g,
      `${fieldname} of ${id}`, 'should start with an uppercase letter',
      value,
    )
    if (fieldname.startsWith('metric_details')) {
      checkNotRegexpHighlight(
        /[^!.?]$/g,
        `${fieldname} of ${id}`, 'should end with a punctuation mark',
        value,
      )
    }
  })
  const {
    category_id: categoryId,
    metric_title: metricTitle,
    metric_details: metricDetails,
  } = fields
  return {categoryId, metricDetails, metricTitle}
}

const mapVae = ({fields}) => {
  const {
    name,
    vae_ratio_in_diploma: vaeRatioInDiploma,
    rome_ids: romeIds,
  } = fields
  return {name, romeIds, vaeRatioInDiploma}
}

// Step 4 //

const reduceRecords = (recordToResult, reduceResults, reduceZero) => records => records.
  map(recordToResult).reduce((acc, result) => reduceResults(acc, result), reduceZero || {})

const reduceAdviceModules = reduceRecords(
  mapAdviceModules,
  (modules, {adviceId, newModule}) => {
    return {
      ...modules,
      [adviceId]: newModule,
    }
  },
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

const reduceStrategyGoals = reduceRecords(mapStrategyGoals,
  (strategies, {strategyIds, ...goalProps}) => {
    // TODO(cyrille): Restrict the number of goals per strategy.
    const updatedStrategies = fromPairs(strategyIds.map(strategyId => {
      if (strategies[strategyId] && strategies[strategyId].length > 5) {
        throw new Error(`Strategy ${strategyId} has too many goals, please reduce to at most 6.`)
      }
      return [strategyId, [
        ...strategies[strategyId] || [],
        goalProps,
      ]]
    }))
    return {
      ...strategies,
      ...updatedStrategies,
    }
  },
)

const reduceCategories = reduceRecords(mapCategory,
  (categories, {categoryId, ...otherFields}) => {
    return {
      ...categories,
      [categoryId]: otherFields,
    }
  },
)

const reduceVae = records => records.slice(0, 10).map(mapVae)

// Step 5 //

const writeToJson = jsonFile => jsonObject => {
  if (isDryRun) {
    return
  }
  fs.writeFile(jsonFile, stringify(jsonObject, {space: 2}) + '\n', maybeThrowError)
}

const writeWithTranslations = (jsonFile, namespace) => ([records, translations]) => {
  writeToJson(`${jsonFile}.json`)(records)
  forEach(translations, (translated, lang) => {
    writeToJson(`src/translations/${lang}/${namespace}.json`)(translated)
  })
}

const fromAirtableToObjects = (collection, mapReducer, contexts = ['']) => {
  const {base, table, view, translatableFields} = airtableFields[collection]
  return new Airtable().base(base).table(table).select({view}).all().
    then(gatherTranslations((field) => {
      if (!translatableFields.includes(field)) {
        return []
      }
      return ['en', 'fr', 'fr@tu']
    }, contexts), maybeThrowError).
    then(([records, translations]) => [mapReducer(records), translations], maybeThrowError)
}

const noOp = Promise.resolve()

const importAdvices = shouldDownload.adviceModules ? fromAirtableToObjects(
  'adviceModules',
  reduceAdviceModules,
).then(([modules, translations]) => {
  writeWithTranslations(
    'src/components/advisor/data/advice_modules', 'adviceModules',
  )([modules, translations])
}, maybeThrowError) : noOp

const importCategories = shouldDownload.categories ? fromAirtableToObjects(
  'categories',
  reduceCategories,
  ['', '_FEMININE', '_MASCULINE'],
).then(
  writeWithTranslations('src/components/strategist/data/categories', 'categories'),
  maybeThrowError,
) : noOp

const importEmailTemplates = shouldDownload.emailTemplates ?
  fromAirtableToObjects(
    'emailTemplates',
    reduceEmailTemplates,
  ).then(
    writeWithTranslations('src/components/advisor/data/email_templates', 'emailTemplates'),
    maybeThrowError,
  ) : noOp

const importStrategyGoals = shouldDownload.strategyGoals ? fromAirtableToObjects(
  'strategyGoals',
  reduceStrategyGoals,
).then(
  writeWithTranslations('src/components/strategist/data/goals', 'goals'),
  maybeThrowError,
) : noOp

const importVae = shouldDownload.vae ?
  vaeFromAirtable.then(reduceVae).then(writeToJson('src/components/advisor/data/vae.json')) : noOp

module.exports = Promise.all([
  importAdvices,
  importCategories,
  importEmailTemplates,
  importStrategyGoals,
  importVae,
])
