# encoding: utf-8
"""Scoring module for chantiers and actions.

See design doc at http://go/pe:scoring-chantiers.
"""
import collections
import datetime
import itertools
import logging
import math
import random
import re

from bob_emploi.frontend import companies
from bob_emploi.frontend import proto
from bob_emploi.frontend import carif
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import event_pb2
from bob_emploi.frontend.api import commute_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import training_pb2
from bob_emploi.frontend.api import user_pb2


# TODO(pascal): Split this file and remove the line below.
# pylint: disable=too-many-lines

# Score for each percent of additional job offers that a chantier enables. We
# want to have a score of 3 for 30% increase.
_SCORE_PER_JOB_OFFERS_PERCENT = .1

# Score per interview ratio. E.g. a value of 1/5 would make us recommend a
# small impact chantier (1 impact point) if a user gets an interview for every
# 5 applications they do; a value of 1/15 would make us recommend a large
# impact chantier (3 impact points) or 3 small ones if auser gets an interview
# for every 15 applications.
_SCORE_PER_INTERVIEW_RATIO = 1 / 5

# Average number of days per month.
_DAYS_PER_MONTH = 365.25 / 12

# Average number of weeks per month.
_WEEKS_PER_MONTH = 52 / 12

# Maximum of the estimation scale for English skills, or office tools.
_ESTIMATION_SCALE_MAX = 3

_JOB_BOARDS = proto.MongoCachedCollection(jobboard_pb2.JobBoard, 'jobboards')

_ASSOCIATIONS = proto.MongoCachedCollection(association_pb2.Association, 'associations')

_APPLICATION_TIPS = proto.MongoCachedCollection(application_pb2.ApplicationTip, 'application_tips')

_EVENTS = proto.MongoCachedCollection(event_pb2.Event, 'events')

_SPECIFIC_TO_JOB_ADVICE = proto.MongoCachedCollection(
    advisor_pb2.DynamicAdvice, 'specific_to_job_advice')

# Distance below which the city is so close that it is obvious.
_MIN_CITY_DISTANCE = 8

# Distance above which the city is so far that it should not be considered.
_MAX_CITY_DISTANCE = 35

# All departements we want to consider in our app.
# TODO(guillaume): Find a better way to get the departements that are compatible
# E.G. (69M) should not be here, but 2A should.
_ALL_DEPARTEMENTS = {
    '1': 'Ain',
    '2': 'Aisne',
    '3': 'Allier',
    '4': 'Alpes-de-Haute-Provence',
    '5': 'Hautes-Alpes',
    '6': 'Alpes-Maritimes',
    '7': 'Ardèche',
    '8': 'Ardennes',
    '9': 'Ariège',
    '10': 'Aube',
    '11': 'Aude',
    '12': 'Aveyron',
    '13': 'Bouches-du-Rhône',
    '14': 'Calvados',
    '15': 'Cantal',
    '16': 'Charente',
    '17': 'Charente-Maritime',
    '18': 'Cher',
    '19': 'Corrèze',
    '21': 'Côte-dOr',
    '22': 'Côtes-dArmor',
    '23': 'Creuse',
    '24': 'Dordogne',
    '25': 'Doubs',
    '26': 'Drôme',
    '27': 'Eure',
    '28': 'Eure-et-Loir',
    '29': 'Finistère',
    '2A': 'Corse-du-Sud',
    '2B': 'Haute-Corse',
    '30': 'Gard',
    '31': 'Haute-Garonne',
    '32': 'Gers',
    '33': 'Gironde',
    '34': 'Hérault',
    '35': 'Ille-et-Vilaine',
    '36': 'Indre',
    '37': 'Indre-et-Loire',
    '38': 'Isère',
    '39': 'Jura',
    '40': 'Landes',
    '41': 'Loir-et-Cher',
    '42': 'Loire',
    '43': 'Haute-Loire',
    '44': 'Loire-Atlantique',
    '45': 'Loiret',
    '46': 'Lot',
    '47': 'Lot-et-Garonne',
    '48': 'Lozère',
    '49': 'Maine-et-Loire',
    '50': 'Manche',
    '51': 'Marne',
    '52': 'Haute-Marne',
    '53': 'Mayenne',
    '54': 'Meurthe-et-Moselle',
    '55': 'Meuse',
    '56': 'Morbihan',
    '57': 'Moselle',
    '58': 'Nièvre',
    '59': 'Nord',
    '60': 'Oise',
    '61': 'Orne',
    '62': 'Pas-de-Calais',
    '63': 'Puy-de-Dôme',
    '64': 'Pyrénées-Atlantiques',
    '65': 'Hautes-Pyrénées',
    '66': 'Pyrénées-Orientales',
    '67': 'Bas-Rhin',
    '68': 'Haut-Rhin',
    '69': 'Rhône',
    '70': 'Haute-Saône',
    '71': 'Saône-et-Loire',
    '72': 'Sarthe',
    '73': 'Savoie',
    '74': 'Haute-Savoie',
    '75': 'Paris',
    '76': 'Seine-Maritime',
    '77': 'Seine-et-Marne',
    '78': 'Yvelines',
    '79': 'Deux-Sèvres',
    '80': 'Somme',
    '81': 'Tarn',
    '82': 'Tarn-et-Garonne',
    '83': 'Var',
    '84': 'Vaucluse',
    '85': 'Vendée',
    '86': 'Vienne',
    '87': 'Haute-Vienne',
    '88': 'Vosges',
    '89': 'Yonne',
    '90': 'Territoire de Belfort',
    '91': 'Essonne',
    '92': 'Hauts-de-Seine',
    '93': 'Seine-Saint-Denis',
    '94': 'Val-de-Marne',
    '95': "Val-d'Oise",
    '971': 'Guadeloupe',
    '972': 'Martinique',
    '973': 'Guyane',
    '974': 'Réunion',
    '976': 'Mayotte',
}


def compute_square_distance(city_a, city_b):
    """Compute the approximative distance between two cities.

        Since we only look at short distances, we can approximate that, for metropolitan france:

        1° latitude = 111km
        1° longitude = 73km
        Caveat: this approximation will be bad for DOM close to the equator, recommending some
        people to commute up to 2x further than in France.
        TODO(guillaume): Improve approximation.
    """
    delta_y = (city_a.latitude - city_b.latitude) * 111
    delta_x = (city_a.longitude - city_b.longitude) * 73
    return delta_x * delta_x + delta_y * delta_y


def is_city_quite_close(city_a, city_b):
    """Return true if the city is not too far for commute, but not too close to be obvious."""
    square_distance = compute_square_distance(city_a, city_b)
    return (square_distance > _MIN_CITY_DISTANCE * _MIN_CITY_DISTANCE and
            square_distance < _MAX_CITY_DISTANCE * _MAX_CITY_DISTANCE)


def is_city_very_close(city_a, city_b):
    """Return true if the city is so close that it is obviously known."""
    square_distance = compute_square_distance(city_a, city_b)
    return square_distance <= _MIN_CITY_DISTANCE * _MIN_CITY_DISTANCE


class ScoringProject(object):
    """The project and its environment for the scoring.

    When deciding whether a chantier is useful or not for a given project we
    need the project itself but also a lot of other factors. This object is
    responsible to make them accessible to the scoring function.
    """

    def __init__(self, project, user_profile, features_enabled, database, now=None):
        self.details = project
        self.user_profile = user_profile
        self.features_enabled = features_enabled
        self._db = database
        self.now = now or datetime.datetime.utcnow()

        # Cache for DB data.
        self._job_group_info = None
        self._local_diagnosis = None
        self._jobboards = None
        self._associations = None
        self._nearby_cities = None
        self._application_tips = None
        self._trainings = None
        self._volunteering_missions = None
        self._best_departements = None
        self._events = None

    # When scoring models need it, add methods to access data from DB:
    # project requirements from job offers, IMT, median unemployment duration
    # from FHS, etc.

    def local_diagnosis(self):
        """Get local stats for the project's job group and département."""
        if self._local_diagnosis is not None:
            return self._local_diagnosis

        self._local_diagnosis = job_pb2.LocalJobStats()
        local_id = '%s:%s' % (
            self.details.mobility.city.departement_id,
            self.details.target_job.job_group.rome_id)
        # TODO(pascal): Handle when return is False (no data).
        proto.parse_from_mongo(
            self._db.local_diagnosis.find_one({'_id': local_id}), self._local_diagnosis)

        return self._local_diagnosis

    def imt_proto(self):
        """Get IMT data for the project's job and département."""
        return self.local_diagnosis().imt

    def market_stress(self):
        """Get the ratio of # applicants / # job offers for the project."""
        imt = self.imt_proto()
        if not imt.yearly_avg_offers_denominator:
            return None
        offers = imt.yearly_avg_offers_per_10_candidates
        if not offers:
            # No job offers at all, ouch!
            return 1000
        return imt.yearly_avg_offers_denominator / offers

    def _rome_id(self):
        return self.details.target_job.job_group.rome_id

    def job_group_info(self):
        """Get the info for job group info."""
        if self._job_group_info is not None:
            return self._job_group_info

        self._job_group_info = job_pb2.JobGroup()
        proto.parse_from_mongo(
            self._db.job_group_info.find_one({'_id': self._rome_id()}),
            self._job_group_info)
        return self._job_group_info

    def requirements(self):
        """Get the project requirements."""
        return self.job_group_info().requirements

    def handcrafted_job_requirements(self):
        """Handcrafted job requirements for the target job."""
        handcrafted_requirements = job_pb2.JobRequirements()
        all_requirements = self.requirements()
        handcrafted_fields = [
            field for field in job_pb2.JobRequirements.DESCRIPTOR.fields_by_name.keys()
            if field.endswith('_short_text')]
        for field in handcrafted_fields:
            setattr(handcrafted_requirements, field, getattr(all_requirements, field))
        return handcrafted_requirements

    def list_jobboards(self):
        """List all job boards for this project."""
        if self._jobboards:
            return self._jobboards

        all_job_boards = _JOB_BOARDS.get_collection(self._db)
        self._jobboards = list(filter_using_score(all_job_boards, lambda j: j.filters, self))
        return self._jobboards

    def list_associations(self):
        """List all associations for this project."""
        if self._associations:
            return self._associations

        all_associations = _ASSOCIATIONS.get_collection(self._db)
        self._associations = list(filter_using_score(all_associations, lambda j: j.filters, self))
        return self._associations

    def find_best_departements(self):
        """Find which are the best departement to relocate for a given job group."""
        if self._best_departements is not None:
            return self._best_departements

        # TODO(pascal): Should we use the cache system described here :
        # https://docs.python.org/3/library/functools.html ?

        job_group = self.details.target_job.job_group.rome_id

        local_stats_ids = {('%s:%s' % (departement_id, job_group)): departement_id
                           for departement_id in _ALL_DEPARTEMENTS}

        local_stats = self._db.local_diagnosis.find({'_id': {'$in': list(local_stats_ids)}})

        departement_to_offers = {}
        for departement_local_stats in local_stats:
            departement_id = local_stats_ids[departement_local_stats['_id']]
            departement_to_offers[departement_id] = \
                departement_local_stats.get('imt', {}).get('yearlyAvgOffersPer10Candidates', 0) or 0

        # If we do not have data about our own departement, we chose not to say anything.
        own_departement = self.details.mobility.city.departement_id

        # We only advice departements that are better than own departement.
        min_offers = departement_to_offers.get(own_departement, 0)

        if not min_offers:
            self._best_departements = []
            return self._best_departements

        # Compute the score for each departement.
        sorted_departements = sorted(
            departement_to_offers.items(), key=lambda x: x[1], reverse=True)

        # Get only departements that are strictly better than own departement.
        top_departements = [
            project_pb2.DepartementScore(name=_ALL_DEPARTEMENTS[dep[0]],
                                         offer_ratio=dep[1] / min_offers)
            for dep in sorted_departements if dep[1] > min_offers]

        # Return at most 10 departements
        self._best_departements = top_departements[0:10]
        return self._best_departements

    def _get_commuting_cities(self, interesting_cities_for_rome, target_city):
        # Get the reference offers per inhabitant.

        ref = next((h.offers / h.city.population
                    for h in interesting_cities_for_rome
                    if h.city.city_id == target_city.city_id and h.city.population), 0)

        for hiring_city in interesting_cities_for_rome:
            distance = math.sqrt(compute_square_distance(hiring_city.city, target_city))

            if distance < _MAX_CITY_DISTANCE:
                try:
                    relative_offers = (hiring_city.offers / hiring_city.city.population) / ref
                except ZeroDivisionError:
                    relative_offers = 0

                yield commute_pb2.CommutingCity(
                    name=hiring_city.city.name,
                    relative_offers_per_inhabitant=relative_offers,
                    distance_km=distance)

    def get_trainings(self):
        """Get the training opportunities from our partner's API."""
        if self._trainings is not None:
            return self._trainings
        self._trainings = carif.get_trainings(
            self.details.target_job.job_group.rome_id, self.details.mobility.city.departement_id)
        return self._trainings

    def get_seasonal_departements(self):
        """Compute departements that propose seasonal jobs."""
        # TODO(guillaume): Implement with real data.

        return ['Savoie', 'Haute Savoie']

    def list_nearby_cities(self):
        """Compute and store all interesting cities that are not too close and not too far.

            Those cities will be used by the Commute advice.
        """
        if self._nearby_cities is not None:
            return self._nearby_cities
        self._nearby_cities = []

        job_group = self.details.target_job.job_group.rome_id

        all_cities = commute_pb2.HiringCities()
        proto.parse_from_mongo(self._db.hiring_cities.find_one({'_id': job_group}), all_cities)
        interesting_cities_for_rome = all_cities.hiring_cities

        if not interesting_cities_for_rome:
            return []

        target_city = geo_pb2.FrenchCity()
        mongo_city = self._db.cities.find_one({'_id': self.details.mobility.city.city_id})
        if not mongo_city:
            return []
        proto.parse_from_mongo(mongo_city, target_city)

        commuting_cities = list(
            self._get_commuting_cities(interesting_cities_for_rome, target_city))

        obvious_cities = [
            city for city in commuting_cities
            if city.distance_km < _MIN_CITY_DISTANCE]

        interesting_cities = [
            city for city in commuting_cities
            if city.distance_km >= _MIN_CITY_DISTANCE]

        # If there is only one city nearby and no obvious city, the nearby city becomes obvious, so
        # we do not recommend it.
        if len(interesting_cities) == 1 and not obvious_cities:
            return []

        self._nearby_cities = interesting_cities
        return self._nearby_cities

    def volunteering_missions(self):
        """Return a list of volunteering mission close to the project."""
        if self._volunteering_missions is not None:
            return self._volunteering_missions

        departement_id = self.details.mobility.city.departement_id

        # Get data from MongoDB.
        volunteering_missions_dict = collections.defaultdict(association_pb2.VolunteeringMissions)
        for record in self._db.volunteering_missions.find({'_id': {'$in': [departement_id, '']}}):
            record_id = record.pop('_id')
            proto.parse_from_mongo(record, volunteering_missions_dict[record_id])

        # TODO(pascal): First get missions from target city if any.

        # Merge data.
        project_missions = association_pb2.VolunteeringMissions()
        for scope in [departement_id, '']:
            for mission in volunteering_missions_dict[scope].missions:
                mission.is_available_everywhere = not scope
                project_missions.missions.add().CopyFrom(mission)

        self._volunteering_missions = project_missions
        return project_missions

    def list_application_tips(self):
        """List all application tips available for this project."""
        if self._application_tips:
            return self._application_tips

        all_application_tips = _APPLICATION_TIPS.get_collection(self._db)
        self._application_tips = list(filter_using_score(
            all_application_tips, lambda j: j.filters, self))
        return self._application_tips

    def list_events(self):
        """List all events close to the project's target."""
        # TODO(pascal): Get real data instead.
        if not self.features_enabled.alpha:
            return []
        if self._events:
            return self._events
        all_events = _EVENTS.get_collection(self._db)
        self._events = list(filter_using_score(all_events, lambda e: e.filters, self))
        return self._events

    def specific_to_job_advice_config(self):
        """Find the first specific to job advice config that matches this project."""
        _configs = _SPECIFIC_TO_JOB_ADVICE.get_collection(self._db)
        return next(filter_using_score(_configs, lambda c: c.filters, self), None)


class _ScoringModelBase(object):
    """A base/default scoring model.

    This class can be used either directly for chantiers that do not specify
    any scoring models, or as a base class for more complex scoring models.

    The sub classes should override the score method.
    """

    # If we do standard computation across models, add it here and use this one
    # as a base class.

    def score(self, unused_project):
        """Compute a score for the given ScoringProject.

        Descendants of this class should overwrite `score` to avoid the fallback to a random value.
        """
        return random.random() * 3


class _AdviceEventScoringModel(_ScoringModelBase):
    """A scoring model for Advice that user needs to go to events."""

    def score(self, project):
        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(fap_modes.modes[0].mode for fap_modes in application_modes)
        first_modes.discard(job_pb2.UNDEFINED_APPLICATION_MODE)
        if first_modes == {job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS}:
            return 2

        return 1

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        all_events = project.list_events()
        if not all_events:
            return None
        return project_pb2.EventsData(event_name=all_events[0].title)


class _ImproveYourNetworkScoringModel(_ScoringModelBase):
    """A scoring model for Advice that user needs to improve their network."""

    def __init__(self, network_level):
        self._network_level = network_level

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.network_estimate != self._network_level:
            return 0

        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(fap_modes.modes[0].mode for fap_modes in application_modes)
        first_modes.discard(job_pb2.UNDEFINED_APPLICATION_MODE)
        if first_modes == {job_pb2.PERSONAL_OR_PROFESSIONAL_CONTACTS}:
            return 3

        return 2


class ConstantScoreModel(_ScoringModelBase):
    """A scoring model that always return the same score."""

    def __init__(self, constant_score):
        self.constant_score = float(constant_score)

    def score(self, unused_project):
        """Compute a score for the given ScoringProject."""
        return self.constant_score


class _AdviceTrainingScoringModel(_ScoringModelBase):
    """A scoring model for the training advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return training_pb2.Trainings(trainings=project.get_trainings())

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        # TODO(guillaume): Get the score for each project from lbf.
        all_trainings = project.get_trainings()

        if not all_trainings:
            return 0

        if len(all_trainings) >= 2:
            if project.details.job_search_length_months >= 3:
                return 3
            if project.details.kind == project_pb2.REORIENTATION >= 3:
                return 3
        if project.details.job_search_length_months >= 2:
            return 2

        return 1


class _AdviceSeasonalRelocate(_ScoringModelBase):
    """A scoring model for the "seasonal relocate" advice module."""

    def score(self, project):
        user_age = datetime.date.today().year - project.user_profile.year_of_birth

        # For now we just match for people willing to move to the whole country.
        # There might be cases where we should be able to recommend to people who want to move to
        # their own region, but it would add complexity to find them.
        is_not_ready_to_move = (
            project.details.mobility.area_type != geo_pb2.COUNTRY and
            project.details.mobility.area_type != geo_pb2.WORLD)

        is_not_single = project.user_profile.family_situation != user_pb2.SINGLE
        has_advanced_degree = project.user_profile.highest_degree >= job_pb2.LICENCE_MAITRISE
        is_not_young = user_age > 30
        looks_only_for_cdi = project.details.employment_types == [job_pb2.CDI]

        if (is_not_ready_to_move or is_not_young or is_not_single or has_advanced_degree or
                looks_only_for_cdi):
            return 0

        if len(project.get_seasonal_departements()) > 1:
            if user_age < 25:
                return 3
            return 2
        return 0


class _AdviceSpecificToJob(_ScoringModelBase):
    """A scoring model for the "Specific to Job" advice module."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.specific_to_job_advice_config():
            return 3
        return 0

    def get_advice_override(self, project, unused_advice):
        """Get override data for an advice."""
        config = project.specific_to_job_advice_config()
        if project.user_profile.gender == user_pb2.FEMININE and config.expanded_card_items_feminine:
            expanded_card_items = config.expanded_card_items_feminine
        else:
            expanded_card_items = config.expanded_card_items

        return project_pb2.Advice(
            title=config.title,
            card_text=config.card_text,
            expanded_card_items=expanded_card_items,
        )


class _SpontaneousApplicationScoringModel(_ScoringModelBase):
    """A scoring model for the "Send spontaneous applications" advice module."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        application_modes = project.job_group_info().application_modes.values()
        first_modes = set(fap_modes.modes[0].mode for fap_modes in application_modes)
        if job_pb2.SPONTANEOUS_APPLICATION in first_modes:
            return 3

        second_modes = set(fap_modes.modes[1].mode for fap_modes in application_modes)
        if job_pb2.SPONTANEOUS_APPLICATION in second_modes:
            return 2

        return 0

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.SpontaneousApplicationData(companies=[
            companies.to_proto(c)
            for c in itertools.islice(companies.get_lbb_companies(project.details), 5)])


class _ActiveExperimentFilter(_ScoringModelBase):
    """A scoring model to filter on a feature enabled."""

    def __init__(self, feature):
        self.feature = feature

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        try:
            if getattr(project.features_enabled, self.feature) == user_pb2.ACTIVE:
                return 3
        except AttributeError:
            logging.warning(
                'A scoring model is referring to a non existant feature flag: "%s"', self.feature)
        return 0


class _UserProfileFilter(_ScoringModelBase):
    """A scoring model to filter on a user's profile property.

    It takes a filter function that takes the user's profile as parameter. If
    this function returns true, the score for any project taken by the user
    would be 3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to users with a computer:
        _UserProfileFilter(lambda user: user.has_access_to_computer)
    """

    def __init__(self, filter_func):
        self.filter_func = filter_func

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self.filter_func(project.user_profile):
            return 3
        return 0


class _ProjectFilter(_ScoringModelBase):
    """A scoring model to filter on a project's property.

    It takes a filter function that takes the project as parameter. If this
    function returns true, the score for any project taken by the user would be
    3, otherwise it's 0.

    Usage:
        Create an actions filter to restrict to projects about job group A1234:
        _ProjectFilter(lambda project: project.target_job.job_group.rome_id == 'A12344)
    """

    def __init__(self, filter_func):
        super(_ProjectFilter, self).__init__()
        self.filter_func = filter_func

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self.filter_func(project.details):
            return 3
        return 0


class JobGroupFilter(_ProjectFilter):
    """A scoring model to filter on a job group."""

    def __init__(self, job_group_start):
        super(JobGroupFilter, self).__init__(self._filter)
        self._job_group_starts = [prefix.strip() for prefix in job_group_start.split(',')]

    def _filter(self, project):
        for job_group_start in self._job_group_starts:
            if project.target_job.job_group.rome_id.startswith(job_group_start):
                return True
        return False


class _JobFilter(_ProjectFilter):
    """A scoring model to filter on specific jobs."""

    def __init__(self, jobs):
        super(_JobFilter, self).__init__(self._filter)
        self._jobs = set(job.strip() for job in jobs.split(','))

    def _filter(self, project):
        return project.target_job.code_ogr in self._jobs


class _JobGroupWithoutJobFilter(_ProjectFilter):
    """A scoring model to filter on a job group but exclude some jobs."""

    def __init__(self, job_groups, exclude_jobs=None):
        super(_JobGroupWithoutJobFilter, self).__init__(self._filter)
        self._job_groups = set(job_groups)
        self._exclude_jobs = set(exclude_jobs) or {}

    def _filter(self, project):
        if project.target_job.code_ogr in self._exclude_jobs:
            return False
        if project.target_job.job_group.rome_id in self._job_groups:
            return True
        return False


class _DepartementFilter(_ProjectFilter):
    """A scoring model to filter on the département."""

    def __init__(self, departements):
        super(_DepartementFilter, self).__init__(self._filter)
        self._departements = set(d.strip() for d in departements.split(','))

    def _filter(self, project):
        return project.mobility.city.departement_id in self._departements


class _OldUserFilter(_UserProfileFilter):
    """A scoring model to filter on the age."""

    def __init__(self, min_age):
        super(_OldUserFilter, self).__init__(self._filter)
        self._min_age = int(min_age)

    def _filter(self, user):
        return datetime.date.today().year - user.year_of_birth > self._min_age


class _YoungUserFilter(_UserProfileFilter):
    """A scoring model to filter on the age."""

    def __init__(self, max_age):
        super(_YoungUserFilter, self).__init__(self._filter)
        self._max_age = int(max_age)

    def _filter(self, user):
        return datetime.date.today().year - user.year_of_birth < self._max_age


class _NegateFilter(_ScoringModelBase):
    """A scoring model to filter the opposite of another filter."""

    def __new__(cls, negated_filter_name):
        self = super(_NegateFilter, cls).__new__(cls)
        self.negated_filter = get_scoring_model(negated_filter_name)
        if self.negated_filter is None:
            return None
        return self

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        return 3 - self.negated_filter.score(project)


class _ApplicationComplexityFilter(_ScoringModelBase):
    """A scoring model to filter on job group application complexity."""

    def __init__(self, application_complexity):
        super(_ApplicationComplexityFilter, self).__init__()
        self._application_complexity = application_complexity

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self._application_complexity == project.job_group_info().application_complexity:
            return 3
        return 0


class _AdviceOtherWorkEnv(_ScoringModelBase):
    """A scoring model to trigger the "Other Work Environment" Advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.OtherWorkEnvAdviceData(
            work_environment_keywords=project.job_group_info().work_environment_keywords)

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        work_env = project.job_group_info().work_environment_keywords
        if len(work_env.structures) > 1 or len(work_env.sectors) > 1:
            return 2
        return 0


class _AdviceLifeBalanceScoringModel(_ScoringModelBase):
    """A scoring model to trigger the "life balance" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.user_profile.has_handicap:
            return 0

        if project.details.job_search_length_months > 3:
            return 1

        return 0


class _AdviceVae(_ScoringModelBase):
    """A scoring model to trigger the "VAE" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        is_frustrated_by_trainings = user_pb2.TRAINING in project.user_profile.frustrations
        has_experience = project.details.seniority in set([project_pb2.SENIOR, project_pb2.EXPERT])
        thinks_xp_covers_diplomas = \
            project.details.training_fulfillment_estimate == project_pb2.ENOUGH_EXPERIENCE

        does_not_have_required_diplomas = \
            project.details.training_fulfillment_estimate in set([
                project_pb2.ENOUGH_EXPERIENCE,
                project_pb2.TRAINING_FULFILLMENT_NOT_SURE,
                project_pb2.CURRENTLY_IN_TRAINING])

        if project.details.training_fulfillment_estimate == project_pb2.ENOUGH_DIPLOMAS:
            return 0

        if thinks_xp_covers_diplomas:
            if is_frustrated_by_trainings or has_experience:
                return 3
            return 2

        if has_experience and (does_not_have_required_diplomas or is_frustrated_by_trainings):
            return 2

        return 0


class _AdviceSenior(_ScoringModelBase):
    """A scoring model to trigger the "Senior" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        user = project.user_profile
        age = datetime.date.today().year - user.year_of_birth
        if (user_pb2.AGE_DISCRIMINATION in user.frustrations and age > 40) or age >= 45:
            return 2
        return 0


class _AdviceLessApplications(_ScoringModelBase):
    """A scoring model to trigger the "Make less applications" Advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.weekly_applications_estimate == project_pb2.DECENT_AMOUNT or \
                project.details.weekly_applications_estimate == project_pb2.A_LOT:
            return 3
        return 0


class _AdviceVolunteer(_ScoringModelBase):
    """A scoring model to trigger the "Try volunteering" Advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        association_names = [m.association_name for m in project.volunteering_missions().missions]

        # Deduplicate association names.
        seen = set()
        association_names = [n for n in association_names if not (n in seen or seen.add(n))]

        return project_pb2.VolunteerData(association_names=association_names[:3])

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        missions = project.volunteering_missions().missions
        if not missions:
            return 0
        if project.details.job_search_length_months < 9:
            return 1
        return 2


class _AdviceImproveInterview(_ScoringModelBase):
    """A scoring model to trigger the "Improve your interview skills" advice."""

    _NUM_INTERVIEWS = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 1,
        project_pb2.DECENT_AMOUNT: 5,
        project_pb2.A_LOT: 10,
    }

    def _max_monthly_interviews(self, project):
        """Maximum number of monthly interviews one should have."""
        if project.job_group_info().application_complexity == job_pb2.COMPLEX_APPLICATION_PROCESS:
            return 5
        return 3

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.ImproveSuccessRateData(
            requirements=project.handcrafted_job_requirements())

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if project.details.total_interview_count < 0:
            num_interviews = 0
        elif project.details.total_interview_count > 0:
            num_interviews = project.details.total_interview_count
        else:
            num_interviews = self._NUM_INTERVIEWS.get(project.details.total_interviews_estimate, 0)
        num_monthly_interviews = num_interviews / (project.details.job_search_length_months or 1)
        if num_monthly_interviews > self._max_monthly_interviews(project):
            return 3
        # Whatever the number of month of search, trigger 3 if the user did more than 5 interviews:
        if num_interviews >= self._NUM_INTERVIEWS[project_pb2.A_LOT] and \
                project.details.job_search_length_months <= 6:
            return 3
        return 0


class _AdviceBetterJobInGroup(_ScoringModelBase):
    """A scoring model to trigger the "Change to better job in your job group" advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        specific_jobs = project.requirements().specific_jobs
        if not specific_jobs or specific_jobs[0].code_ogr == project.details.target_job.code_ogr:
            return 0

        try:
            target_job_percentage = next(
                j.percent_suggested for j in specific_jobs
                if j.code_ogr == project.details.target_job.code_ogr)
        except StopIteration:
            target_job_percentage = 0

        has_way_better_job = target_job_percentage + 30 < specific_jobs[0].percent_suggested
        has_better_job = target_job_percentage + 5 < specific_jobs[0].percent_suggested
        is_looking_for_new_job = project.details.kind == project_pb2.REORIENTATION

        if (project.details.job_search_length_months > 6 and has_better_job) or \
                has_way_better_job or is_looking_for_new_job:
            return 3
        return 2

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        specific_jobs = project.requirements().specific_jobs

        if not specific_jobs:
            return None

        extra_data = project_pb2.BetterJobInGroupData()
        try:
            extra_data.num_better_jobs = next(
                i for i, job in enumerate(specific_jobs)
                if job.code_ogr == project.details.target_job.code_ogr)
        except StopIteration:
            # Target job is not mentionned in the specific jobs, do not mention
            # the number of better jobs.
            pass

        all_jobs = project.job_group_info().jobs
        try:
            best_job = next(
                job for job in all_jobs
                if job.code_ogr == specific_jobs[0].code_ogr)
            extra_data.better_job.CopyFrom(best_job)
        except StopIteration:
            logging.warning(
                'Better job "%s" is not listed in the group "%s"', specific_jobs[0].code_ogr,
                project.job_group_info().rome_id)

        return extra_data


class _AdviceImproveResume(_ScoringModelBase):
    """A scoring model to trigger the "Improve your resume to get more interviews" advice."""

    _APPLICATION_PER_WEEK = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 2,
        project_pb2.DECENT_AMOUNT: 6,
        project_pb2.A_LOT: 15,
    }

    _NUM_INTERVIEWS = {
        project_pb2.LESS_THAN_2: 0,
        project_pb2.SOME: 1,
        project_pb2.DECENT_AMOUNT: 5,
        project_pb2.A_LOT: 10,
    }

    def _num_interviews(self, project):
        if project.details.total_interview_count < 0:
            return 0
        if project.details.total_interview_count:
            return project.details.total_interview_count
        return self._NUM_INTERVIEWS.get(project.details.total_interviews_estimate, 0)

    def _num_interviews_increase(self, project):
        """Compute the increase (in ratio) of # of interviews that one could hope for."""
        if project.details.total_interviews_estimate >= project_pb2.A_LOT or \
                project.details.total_interview_count > 20:
            return 0

        job_search_length_weeks = project.details.job_search_length_months * 52 / 12
        num_applicants_per_offer = project.market_stress() or 2.85
        weekly_applications = self._APPLICATION_PER_WEEK.get(
            project.details.weekly_applications_estimate, 0)
        num_applications = job_search_length_weeks * weekly_applications
        num_potential_interviews = num_applications / num_applicants_per_offer
        return num_potential_interviews / (self._num_interviews(project) or 1)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.ImproveSuccessRateData(
            num_interviews_increase=self._num_interviews_increase(project),
            requirements=project.handcrafted_job_requirements())

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if (self._num_interviews_increase(project) >= 2 and
                project.details.job_search_length_months <= 6):
            return 3
        return 0


class _AdviceFreshResume(_ProjectFilter):
    """A scoring model to trigger the "To start, prepare your resume" advice."""

    def __init__(self):
        super(_AdviceFreshResume, self).__init__(self._should_trigger)

    def _should_trigger(self, project):
        return project.weekly_applications_estimate <= project_pb2.LESS_THAN_2 or \
            project.job_search_length_months < 2

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.ImproveSuccessRateData(
            requirements=project.handcrafted_job_requirements())


class _LowPriorityAdvice(_ScoringModelBase):

    def __init__(self, main_frustration):
        super(_LowPriorityAdvice, self).__init__()
        self._main_frustration = main_frustration

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if self._main_frustration in project.user_profile.frustrations:
            return 2
        return 1


class _AdviceJobBoards(_LowPriorityAdvice):
    """A scoring model to trigger the "Find job boards" advice."""

    def __init__(self):
        super(_AdviceJobBoards, self).__init__(user_pb2.NO_OFFERS)

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        jobboards = [j for j in project.list_jobboards() if not j.is_well_known]
        if not jobboards:
            return None
        sorted_jobboards = sorted(jobboards, key=lambda j: (-len(j.filters), random.random()))
        best_job_board = sorted_jobboards[0]
        return project_pb2.JobBoardsData(
            job_board_title=best_job_board.title,
            is_specific_to_job_group=any(
                f.startswith('for-job') for f in best_job_board.filters),
            is_specific_to_region=any(
                f.startswith('for-departement') for f in best_job_board.filters),
        )


class _AdviceRelocateScoringModel(_ScoringModelBase):
    """A scoring model to trigger the "Relocate" advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module."""
        return project_pb2.RelocateData(departement_scores=project.find_best_departements())

    # TODO(guillaume): Add more tests than just all persona.
    def score(self, project):
        if project.details.mobility.area_type != geo_pb2.COUNTRY and \
                project.details.mobility.area_type != geo_pb2.WORLD:
            return 0

        if project.find_best_departements():
            return 2
        return 0


class _AdviceCommuteScoringModel(_ScoringModelBase):
    """A scoring model to trigger the "Commute" advice."""

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        return project_pb2.CommuteData(cities=[c.name for c in project.list_nearby_cities()])

    def score(self, project):
        nearby_cities = project.list_nearby_cities()
        if not nearby_cities:
            return 0

        if project.details.mobility.area_type > geo_pb2.CITY and \
                any(c.relative_offers_per_inhabitant >= 2 for c in nearby_cities):
            return 3

        return 2


class _AdviceAssociationHelp(_ScoringModelBase):
    """A scoring model to trigger the "Find an association to help you" advice."""

    def score(self, project):
        """Compute a score for the given ScoringProject."""
        if not project.list_associations():
            return 0
        if user_pb2.MOTIVATION in project.user_profile.frustrations:
            return 3
        if len(project.list_associations()) >= 3 and project.details.job_search_length_months >= 6:
            return 3
        if project.details.job_search_length_months >= 12:
            return 3
        return 2

    def compute_extra_data(self, project):
        """Compute extra data for this module to render a card in the client."""
        associations = project.list_associations()
        if not associations:
            return None
        sorted_associations = sorted(associations, key=lambda j: (-len(j.filters), random.random()))
        return project_pb2.AssociationsData(association_name=sorted_associations[0].name)


_ScoringModelRegexp = collections.namedtuple('ScoringModelRegexp', ['regexp', 'constructor'])


_SCORING_MODEL_REGEXPS = (
    # Matches strings like "for-job-group(M16)" or "for-job-group(A12, A13)".
    _ScoringModelRegexp(re.compile(r'^for-job-group\((.*)\)$'), JobGroupFilter),
    # Matches strings like "for-job(12006)" or "for-job(12006,12007)".
    _ScoringModelRegexp(re.compile(r'^for-job\((.*)\)$'), _JobFilter),
    # Matches strings like "for-departement(31)" or "for-departement(31, 75)".
    _ScoringModelRegexp(re.compile(r'^for-departement\((.*)\)$'), _DepartementFilter),
    # Matches strings like "not-for-young" or "not-for-active-experiment".
    _ScoringModelRegexp(re.compile(r'^not-(.*)$'), _NegateFilter),
    # Matches strings like "for-active-experiment(lbb_integration)".
    _ScoringModelRegexp(re.compile(r'^for-active-experiment\((.*)\)$'), _ActiveExperimentFilter),
    # Matches strings that are integers.
    _ScoringModelRegexp(re.compile(r'^constant\((.+)\)$'), ConstantScoreModel),
    # Matches strings like "for-old(50)".
    _ScoringModelRegexp(re.compile(r'^for-old\(([0-9]+)\)$'), _OldUserFilter),
    # Matches strings like "for-young(25)".
    _ScoringModelRegexp(re.compile(r'^for-young\(([0-9]+)\)$'), _YoungUserFilter),
)


def get_scoring_model(scoring_model_name):
    """Get a scoring model by its name, may generate it if needed and possible."""
    if scoring_model_name in SCORING_MODELS:
        return SCORING_MODELS[scoring_model_name]

    for regexp, constructor in _SCORING_MODEL_REGEXPS:
        job_group_match = regexp.match(scoring_model_name)
        if job_group_match:
            scoring_model = constructor(job_group_match.group(1))
            if scoring_model:
                SCORING_MODELS[scoring_model_name] = scoring_model
            return scoring_model

    return None


SCORING_MODELS = {
    '': _ScoringModelBase(),
    'advice-association-help': _AdviceAssociationHelp(),
    'advice-better-job-in-group': _AdviceBetterJobInGroup(),
    'advice-better-network': _ImproveYourNetworkScoringModel(2),
    'advice-event': _AdviceEventScoringModel(),
    'advice-fresh-resume': _AdviceFreshResume(),
    'advice-improve-interview': _AdviceImproveInterview(),
    'advice-improve-network': _ImproveYourNetworkScoringModel(1),
    'advice-improve-resume': _AdviceImproveResume(),
    'advice-life-balance': _AdviceLifeBalanceScoringModel(),
    'advice-commute': _AdviceCommuteScoringModel(),
    'advice-job-boards': _AdviceJobBoards(),
    'advice-more-offer-answers': _LowPriorityAdvice(user_pb2.NO_OFFER_ANSWERS),
    'advice-other-work-env': _AdviceOtherWorkEnv(),
    'advice-relocate': _AdviceRelocateScoringModel(),
    'advice-use-good-network': _ImproveYourNetworkScoringModel(3),
    'advice-volunteer': _AdviceVolunteer(),
    'advice-vae': _AdviceVae(),
    'advice-seasonal-relocate': _AdviceSeasonalRelocate(),
    'advice-senior': _AdviceSenior(),
    'advice-specific-to-job': _AdviceSpecificToJob(),
    'advice-less-applications': _AdviceLessApplications(),
    'advice-wow-baker': _JobGroupWithoutJobFilter(job_groups={'D1102'}, exclude_jobs={'12006'}),
    'advice-training': _AdviceTrainingScoringModel(),
    'advice-spontaneous-application': _SpontaneousApplicationScoringModel(),
    # TODO(guillaume): Remove chantier by september 20th.
    'chantier-spontaneous-application': _SpontaneousApplicationScoringModel(),
    'for-complex-application': _ApplicationComplexityFilter(job_pb2.COMPLEX_APPLICATION_PROCESS),
    'for-experienced(2)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.INTERMEDIARY),
    'for-experienced(6)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.SENIOR),
    'for-experienced(10)': _ProjectFilter(
        lambda project: project.seniority >= project_pb2.EXPERT),
    'for-frustrated-old(50)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth > 50),
    'for-frustrated-young(25)': _UserProfileFilter(
        lambda user: user_pb2.AGE_DISCRIMINATION in user.frustrations and
        datetime.date.today().year - user.year_of_birth < 25),
    'for-handicaped': _UserProfileFilter(
        lambda user: user_pb2.HANDICAPED in user.frustrations or user.has_handicap),
    'for-not-employed-anymore': _UserProfileFilter(
        lambda user: user.situation == user_pb2.LOST_QUIT),
    'for-qualified(bac+3)': _UserProfileFilter(
        lambda user: user.highest_degree >= job_pb2.LICENCE_MAITRISE),
    'for-searching-forever': _ProjectFilter(
        lambda project: project.job_search_length_months >= 19),
    'for-simple-application': _ApplicationComplexityFilter(job_pb2.SIMPLE_APPLICATION_PROCESS),
    'for-single-parent': _UserProfileFilter(
        lambda user: user_pb2.SINGLE_PARENT in user.frustrations or
        user.family_situation == user_pb2.SINGLE_PARENT_SITUATION),
    'for-unemployed': _UserProfileFilter(
        lambda user: user.situation and user.situation != user_pb2.EMPLOYED),
    'for-unqualified(bac)': _UserProfileFilter(
        lambda user: user.highest_degree <= job_pb2.BAC_BACPRO),
    'for-women': _UserProfileFilter(lambda user: user.gender == user_pb2.FEMININE),
}


class _Scorer(object):
    """Helper to compute the scores of multiple models for a given project."""

    def __init__(self, project):
        self._project = project
        # A cache of scores keyed by scoring model names.
        self._scores = {}

    def _get_score(self, scoring_model_name):
        if scoring_model_name in self._scores:
            return self._scores[scoring_model_name]

        scoring_model = get_scoring_model(scoring_model_name)
        if scoring_model is None:
            logging.warning(
                'Scoring model "%s" unknown, falling back to default.', scoring_model_name)
            score = self._get_score('')
            self._scores[scoring_model_name] = score
            return score

        score = scoring_model.score(self._project)
        if scoring_model_name:
            self._scores[scoring_model_name] = score
        return score


class _FilterHelper(_Scorer):
    """A helper object to cache scoring in the filter function."""

    def apply(self, filters):
        """Apply all filters to the project.

        Returns:
            False if any of the filters returned a negative value for the
            project. True if there are no filters.
        """
        return all(self._get_score(f) > 0 for f in filters)


def filter_using_score(iterable, get_scoring_func, project):
    """Filter the elements of an iterable using scores.

    Args:
        iterable: an iterable of objects on which this function will iterate at
            most once.
        get_scoring_func: a function to apply on each object to get a list of
            scoring models.
        project: the project to score.

    Yield:
        an item from iterable if it passes the filters.
    """
    helper = _FilterHelper(project)
    for item in iterable:
        if helper.apply(get_scoring_func(item)):
            yield item
