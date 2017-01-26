"""Class to load unemployment duration model and score job seekers.

Expects an input pickle file as produced by model_duration_train.py
"""
import pickle

import pandas as pd


class UnemploymentDurationModel(object):
    """Model to predict the length of time a jobseeker will be unemployed."""

    def __init__(self, infile):
        """Load model parameters from a file."""
        print("Loading unemployment duration model from %s" % infile)
        with open(infile, 'rb') as f_pickle:
            self.feature_names = pickle.load(f_pickle)
            print("Model using %d features: %s" % (
                len(self.feature_names), self.feature_names))

            self.categories = pickle.load(f_pickle)
            for cat in self.categories:
                self.categories[cat] = self.categories[cat]
            print("%d are categorical: %s" % (
                len(self.categories), self.categories.keys()))

            self.imputations = pickle.load(f_pickle)

            print("Unpickling the model itself...")
            self.model = pickle.load(f_pickle)
            print("Model loaded.")

    def _impute(self, query):
        """Impute missing values for query, if possible."""
        for feature in self.feature_names:
            if feature in query and pd.isnull(query[feature]):
                del query[feature]
            if feature not in query and feature in self.imputations:
                query[feature] = self.imputations[feature]
        # This is a special value. We ignore the 'mobility_minutes'
        # feature if they've specified a willingness to go anywhere in France.
        if query['mobility_all_france']:
            query['mobility_minutes'] = self.imputations['mobility_minutes']

    def _flatten(self, query):
        row = []
        for feature_name in self.feature_names:
            if feature_name in self.categories:
                # Manually binary-encode the categorical feature,
                # and ensure that it is a valid value.
                found = False
                value = str(query[feature_name])
                for category_value in self.categories[feature_name]:
                    if category_value == value:
                        row.append(1)
                        found = True
                    else:
                        row.append(0)
                if not found:
                    raise ValueError(
                        "Unexpected value '%s' for feature '%s'. "
                        "Must be one of %s" % (
                            value, feature_name, self.categories[feature_name]))
            else:
                row.append(query[feature_name])
        return row

    def schema(self):
        """Return a dictionary describing the query schema."""
        schema_dict = {}
        for feature_name in self.feature_names:
            if feature_name in self.categories:
                schema_dict[feature_name] = "categorical"
            else:
                schema_dict[feature_name] = "scalar"
        return schema_dict

    def predict(self, query):
        """Predict unemployment duration for a job seeker.

        Args:
            query: a dictionary of (feature, value) pairs.
        """
        self._impute(query)
        missing = set(self.feature_names) - set(query)
        if missing:
            raise ValueError("Missing required features: %s" % list(missing))
        features = self._flatten(query)
        return self.model.predict([features])[0]
