r"""Train unemployment duration model (Random Forest).

Expects an input csv as produced by model_duration_extract.py

Performs imputation, creates additional necessary columns,
trains the model, and saves it (via pickle) to the outfile.

Also saves the name of the imputation function used (e.g. 'median')
to the file as a pickled object after the model.

See Makefile for example command.

Advice from scikit-learn on saving models:
    (http://scikit-learn.org/stable/modules/model_persistence.html)

    pickle (and joblib by extension), has some issues regarding
    maintainability and security. Because of this,
    - Never unpickle untrusted data
    - Models saved in one version of scikit-learn might not
      load in another version.

    In order to rebuild a similar model with future versions of scikit-learn,
    additional metadata should be saved along the pickled model:
    - The training data, e.g. a reference to a immutable snapshot
    - The python source code used to generate the model
    - The versions of scikit-learn and its dependencies
    - The cross validation score obtained on the training data
"""
# TODO: Actually follow the advice given in the docstring.

import datetime
import pickle
import random
import sys
import time

import dateutil
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

# The number of days at which an unemployment duration will be clipped.
MAX_DURATION = 365


def impute_median(features_df):
    """Impute missing values (in-place) with the column's median."""
    counts = features_df.count()
    counts = counts[counts < len(features_df)]
    imputations = {}
    for col in counts.index:
        med = features_df[col].median()
        print('Imputing %d missing values for %s with %.2f' % (
            len(features_df) - counts[col], col, med))
        imputations[col] = med
        features_df.loc[pd.isnull(features_df[col]), col] = med
    return imputations


def train(features_df, targets):
    """Train the random forest model."""
    random_forrest = RandomForestRegressor(
        n_estimators=100, min_samples_leaf=25, max_features=.45)
    start = time.time()
    print('Fitting RF model...')
    random_forrest.fit(features_df, targets)
    elapsed = time.time() - start
    print('Finished in %dm%ds' % (int(elapsed / 60), int(elapsed) % 60))
    return random_forrest


def prepare(features_df):
    """Take the features dataframe and prepare the X and y matrices.

    X is the matrix of features and y are the target values for training.
    """
    # Set a reasonable limit on unemployment duration, and filter
    # to avoid erroneous right-censoring
    max_date = features_df.begin_date.max()
    cutoff_date = str((dateutil.parser.parse(max_date) -
                       datetime.timedelta(days=MAX_DURATION)).date())
    print('Last date of enrollment is', max_date)
    print('Setting max unemployment duration to %d days' % MAX_DURATION)
    print('Dropping %d unemployment periods that begin after' %
          sum(features_df.begin_date > cutoff_date), cutoff_date)
    features_df = features_df[features_df.begin_date <= cutoff_date].copy()
    features_df['duration_days'] = features_df.duration_days.clip(
        0, MAX_DURATION)

    # Extract job sector
    features_df['job_desired_sector'] = features_df.job_desired_rome.map(
        lambda rome: rome[0])

    # Expected columns at query time
    features_scalar = [
        'age', 'sex_male', 'num_children', 'salary_annual_desired',
        'mobility_minutes', 'mobility_all_france']
    features_categorical = ['job_desired_sector', 'location_region_id']

    # Dummify the appropriate columns
    categories = {}
    to_concat = [features_df[features_scalar]]
    for cat in features_categorical:
        dummies = pd.get_dummies(features_df[cat], cat)
        to_concat.append(dummies)
        categories[cat] = [x.split(cat + '_')[1] for x in dummies.columns]

    # Produce matrices for training
    features_full = pd.concat(to_concat, axis=1)
    for col in features_full.columns:
        features_full[col] = features_full[col].astype(float)
    targets_full = features_df['duration_days']

    # Impute missing values
    imputations = impute_median(features_full)

    return (features_full, targets_full, features_scalar + features_categorical,
            categories, imputations)


def main(infile, outfile, sample=None):
    """Read features from infile, save trained model to outfile."""
    unemployment_periods = pd.read_csv(infile)
    print('Loaded %d rows with %d columns' % unemployment_periods.shape)

    features_df, targets, features, categories, imputations = prepare(
        unemployment_periods)

    if sample:
        sample = int(sample)
        print('Downsampling to %d rows (from %d)' % (sample, len(features_df)))
        rows = random.sample(list(features_df.index), sample)
        features_df = features_df.ix[rows]
        targets = targets.ix[rows]
    else:
        print('Training on full dataset of %d rows' % len(features_df))

    model = train(features_df, targets)

    # TODO: Pickle to one object so that the unpickling does not depend on
    #       the order anymore.
    with open(outfile, 'wb') as pickle_file:
        pickle.dump(features, pickle_file)
        pickle.dump(categories, pickle_file)
        pickle.dump(imputations, pickle_file)
        pickle.dump(model, pickle_file)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover
