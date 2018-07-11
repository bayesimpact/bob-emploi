"""Module to advise the user to get their driving license."""

from bob_emploi.frontend.api import driving_license_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring_base


# Keep this in sync with
# frontend/src/components/pages/profile/experience.jsx isDrivingLicenseRequired.
def _license_helps_mobility(mobility):
    # urban_score below 5 means urban areas with less than 100,000 inhabitants.
    return (
        mobility.city.urban_score and mobility.city.urban_score <= 5
    ) or (
        # public_transportation_score below 5 means public transportation system is not appreciated,
        # so a car is relevant.
        mobility.city.public_transportation_score and mobility.city.public_transportation_score <= 5
    )


def _score_and_explain_after_filters(project):
    """A helper function to give a score and an explanation for all advices in the module,
    once some prerequisite filters have been met.
    """

    if project.user_profile.has_car_driving_license != user_pb2.FALSE:
        return scoring_base.NULL_EXPLAINED_SCORE
    reasons = []
    license_required = next((
        license.percent_required
        for license in project.job_group_info().requirements.driving_licenses
        if license.driving_license == job_pb2.CAR), 0)
    if license_required:
        reasons.append(project.translate_string(
            'le permis est important dans votre métier'))
    score_modifier = 0
    if _license_helps_mobility(project.details) or \
            _license_helps_mobility(project.details.mobility):
        reasons.append(project.translate_string(
            'le permis augmenterait votre mobilité'))
        score_modifier = 1
    if not reasons:
        return scoring_base.NULL_EXPLAINED_SCORE
    score = min(3, score_modifier + (
        # Example at 80% is civil engineer F1106.
        3 if license_required > 80 else
        # Example at 67% is translator E1108.
        2 if license_required > 67 else
        # Example at 50% is chiropractor J1408.
        1 if license_required > 50 else 0))
    return scoring_base.ExplainedScore(score, reasons)


class _DrivingLicenseLowIncomeScoringModel(scoring_base.ModelBase):
    """A scoring model for the "Get help for your driving license" advice.

    """

    def score_and_explain(self, project):
        """Compute the score for a given project and explains it.

        Requirements are:
        - not having a driving license (duh)
        - being older than 25 (we have other resources for younger people)
        And for this specific help from PE:
        - being registered as unemployed for more than 6 months
        - be sure that a license would really help to get a job (market tension)
        - not have too much allowances from PE
        """

        # TODO(cyrille): Add tension market.
        age = project.get_user_age()
        # TODO(cyrille): Figure out in a notebook if junior salary from IMT would be more relevant.
        expected_salary = project.salary_estimation()
        if age < 25 or project.get_search_length_now() < 6 or expected_salary > 20000:
            return scoring_base.NULL_EXPLAINED_SCORE
        return _score_and_explain_after_filters(project)

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        # TODO(cyrille): Cache coordinates in ScoringProject.
        return proto.create_from_mongo(
            project.database.cities.find_one({
                '_id': project.details.city.city_id or project.details.mobility.city.city_id}),
            geo_pb2.FrenchCity)


_PARTNER_BANKS = proto.MongoCachedCollection(
    driving_license_pb2.OneEuroProgramPartnerBank, 'banks_one_euro_driving_license')

_PARTNER_SCHOOLS = proto.MongoCachedCollection(
    driving_license_pb2.DrivingSchool, 'schools_one_euro_driving_license')


class _DrivingLicenseOneEuroScoringModel(scoring_base.ModelBase):
    """A scoring model for the "Driving license at 1 euro / day" advice."""

    def score_and_explain(self, project):
        """Compute the score for a given project and explains it."""

        age = project.get_user_age()
        if age < 16 or age >= 25:
            return scoring_base.NULL_EXPLAINED_SCORE
        return _score_and_explain_after_filters(project)

    def get_expanded_card_data(self, project):
        """Retrieve data for the expanded card."""

        banks = _PARTNER_BANKS.get_collection(project.database)
        all_schools = _PARTNER_SCHOOLS.get_collection(project.database)
        relevant_schools = scoring_base.filter_using_score(
            all_schools, lambda s: s.filters, project)
        # TODO(cyrille): Replace this once importer gets schools, and not only lists.
        user_specific_list = next((school.link for school in relevant_schools if school.link), None)
        one_euro_program = driving_license_pb2.OneEuroProgram(partner_banks=banks)
        if project.get_user_age() <= 18:
            one_euro_program.mission_locale.CopyFrom(project.mission_locale_data())
        if user_specific_list:
            one_euro_program.school_list_link = user_specific_list
        return one_euro_program


class _DrivingLicenseWrittenScoringModel(scoring_base.ModelBase):
    """A scoring model for the "Driving license written examination" advice."""

    def score_and_explain(self, project):
        """Compute the score for a given project and explains it."""

        age = project.get_user_age()
        if age < 16:
            return scoring_base.NULL_EXPLAINED_SCORE
        score, reasons = _score_and_explain_after_filters(project)
        if not score:
            return scoring_base.NULL_EXPLAINED_SCORE
        return scoring_base.ExplainedScore(max(1, score - 1), reasons)


scoring_base.register_model(
    'advice-driving-license-low-income', _DrivingLicenseLowIncomeScoringModel())
scoring_base.register_model(
    'advice-driving-license-euro', _DrivingLicenseOneEuroScoringModel())
scoring_base.register_model(
    'advice-driving-license-written', _DrivingLicenseWrittenScoringModel())
