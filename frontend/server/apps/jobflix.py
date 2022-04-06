"""Endpoints for the UpSkilling tool.

See http://go/jobflix:reco-design
"""

import logging
import os
import random
import string
import typing
from typing import Any, Optional, Sequence, Set, Tuple
from urllib import parse

from bson import objectid
import flask

from bob_emploi.common.python import now
from bob_emploi.common.python import proto as common_proto
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import upskilling_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import proto_flask
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import user
from bob_emploi.frontend.server.mail import all_campaigns

app = flask.Blueprint('upskilling', __name__)

_HIDDEN_SECTOR_IDS = {
    # Seasonal jobs.
    '17035', 'seasonal',
    # Low qualification jobs.
    '17039', 'no-qualif',
}


def _get_bob_deployment() -> str:
    return os.getenv('BOB_DEPLOYMENT', 'fr')


def _create_random_seed() -> str:
    return ''.join(random.choice(string.ascii_lowercase) for i in range(10))


class _InvalidState(ValueError):
    ...


class _ComputedSection(typing.NamedTuple):
    # Jobs for the section.
    jobs: list[upskilling_pb2.Job]
    # Maybe an updated ID.
    new_id: Optional[str] = None
    # Maybe an updated name.
    new_name: Optional[str] = None
    # Maybe a state param to be used at a later time.
    state: Optional[str] = None

    def __bool__(self) -> bool:
        return bool(self.jobs)


def _get_best_jobs_in_area(scoring_project: scoring.ScoringProject) -> job_pb2.BestJobsInArea:
    area_id = scoring_project.details.city.departement_id
    return jobs.get_best_jobs_in_area(scoring_project.database, area_id)


def _get_are_all_jobs_hiring() -> bool:
    # TODO(pascal): Improve this heuristic.
    return _get_bob_deployment() != 'uk'


class _Generator:

    _num_jobs_for_first_batch = 10

    @property
    def name(self) -> str:
        """Get the default name of the sections generated by this object."""

        raise NotImplementedError

    def get_jobs(
            self, *, scoring_project: scoring.ScoringProject, allowed_job_ids: Set[str],
            previous_sections: Set[str]) -> Optional[_ComputedSection]:
        """Generate a section."""

        raise NotImplementedError

    def get_more_jobs(
            self, *, scoring_project: scoring.ScoringProject, section_id: str,
            state: str) -> upskilling_pb2.Section:
        """Generate more jobs for a given section."""

        raise NotImplementedError


class _RandomGenerator(_Generator):

    name = i18n.make_translatable_string('Des métiers au hasard')
    max_jobs: Optional[int] = 30

    def get_jobs(
            self, *, allowed_job_ids: Set[str], **unused_kwargs: Any) -> Optional[_ComputedSection]:
        seed = _create_random_seed()
        randomizer = random.Random(seed)
        num_jobs = min(self._num_jobs_for_first_batch, len(allowed_job_ids))
        return _ComputedSection(
            [
                upskilling_pb2.Job(job_group=job_pb2.JobGroup(rome_id=rome_id))
                for rome_id in randomizer.sample(allowed_job_ids, num_jobs)
            ],
            state=seed)

    def get_more_jobs(
            self, *, scoring_project: scoring.ScoringProject, section_id: str,  # pylint: disable=unused-argument
            state: str) -> upskilling_pb2.Section:
        """Generate more jobs for a given section."""

        randomizer = random.Random(state)
        good_jobs = jobs.get_all_good_job_group_ids(scoring_project.database)
        num_jobs = len(good_jobs) if self.max_jobs is None else min(self.max_jobs, len(good_jobs))
        return upskilling_pb2.Section(jobs=[
            upskilling_pb2.Job(job_group=job_pb2.JobGroup(rome_id=rome_id))
            for rome_id in randomizer.sample(good_jobs, num_jobs)[self._num_jobs_for_first_batch:]
        ])


class _AllJobsGenerator(_RandomGenerator):

    name = i18n.make_translatable_string('Tous les métiers porteurs')
    max_jobs = None


class _LowAutomationRiskGenerator(_Generator):

    name = i18n.make_translatable_string('Des métiers qui ne seront pas remplacés par des robots')

    max_jobs: Optional[int] = 30

    automation_risk_threshold = 25

    def get_jobs(
            self, *, scoring_project: scoring.ScoringProject, **unused_kwargs: Any,
    ) -> Optional[_ComputedSection]:
        seed = _create_random_seed()
        safe_jobs = jobs.get_all_good_job_group_ids(
            scoring_project.database, automation_risk_threshold=self.automation_risk_threshold,
            unknown_risk_value=50)
        randomizer = random.Random(seed)
        num_jobs = min(self._num_jobs_for_first_batch, len(safe_jobs))
        return _ComputedSection(
            [
                upskilling_pb2.Job(job_group=job_pb2.JobGroup(rome_id=rome_id))
                for rome_id in randomizer.sample(safe_jobs, num_jobs)
            ],
            state=seed)

    def get_more_jobs(
            self, *, scoring_project: scoring.ScoringProject, section_id: str,  # pylint: disable=unused-argument
            state: str) -> upskilling_pb2.Section:
        """Generate more jobs for a given section."""

        randomizer = random.Random(state)
        safe_jobs = jobs.get_all_good_job_group_ids(
            scoring_project.database, automation_risk_threshold=self.automation_risk_threshold,
            unknown_risk_value=50)
        num_jobs = len(safe_jobs) if self.max_jobs is None else min(self.max_jobs, len(safe_jobs))
        return upskilling_pb2.Section(jobs=[
            upskilling_pb2.Job(job_group=job_pb2.JobGroup(rome_id=rome_id))
            for rome_id in randomizer.sample(safe_jobs, num_jobs)[self._num_jobs_for_first_batch:]
        ])


def _add_perks_to_job(
    job: upskilling_pb2.Job, good_salary_jobs: set[str], is_hiring: bool,
) -> upskilling_pb2.Job:
    if is_hiring:
        job.perks.append(upskilling_pb2.NOW_HIRING)
    if job.job_group.rome_id in good_salary_jobs:
        job.perks.append(upskilling_pb2.GOOD_SALARY)
    return job


class _BestJobsGenerator(_Generator):

    # This can be overridden in subclasses.
    def _create_job(self, related_job_group: job_pb2.RelatedJobGroup) -> upskilling_pb2.Job:
        return upskilling_pb2.Job(job_group=related_job_group.job_group)

    def _get_all_section_jobs(
            self, *, best_jobs: job_pb2.BestJobsInArea, scoring_project: scoring.ScoringProject) \
            -> Sequence[job_pb2.RelatedJobGroup]:
        raise NotImplementedError

    def get_jobs(
            self, *, scoring_project: scoring.ScoringProject, allowed_job_ids: Set[str],
            previous_sections: Set[str],  # pylint: disable=unused-argument
    ) -> Optional[_ComputedSection]:
        best_jobs = self._get_all_section_jobs(
            best_jobs=_get_best_jobs_in_area(scoring_project),
            scoring_project=scoring_project)
        if not best_jobs:
            return None
        best_allowed_jobs = [
            best_job
            for best_job in best_jobs
            if best_job.job_group.rome_id in allowed_job_ids
        ]
        seed = _create_random_seed()
        randomizer = random.Random(seed)
        randomizer.shuffle(best_allowed_jobs)
        return _ComputedSection(
            [
                self._create_job(best_job)
                for best_job in best_allowed_jobs[:self._num_jobs_for_first_batch]
            ],
            state=seed,
        )

    def get_more_jobs(
            self, *, scoring_project: scoring.ScoringProject, section_id: str,  # pylint: disable=unused-argument
            state: str) -> upskilling_pb2.Section:
        """Generate more jobs for a given section."""

        best_jobs = self._get_all_section_jobs(
            best_jobs=_get_best_jobs_in_area(scoring_project),
            scoring_project=scoring_project)
        allowed_job_ids = jobs.get_all_good_job_group_ids(scoring_project.database)
        best_allowed_jobs = [
            best_job
            for best_job in best_jobs
            if best_job.job_group.rome_id in allowed_job_ids
        ]
        randomizer = random.Random(state)
        randomizer.shuffle(best_allowed_jobs)
        return upskilling_pb2.Section(jobs=[
            self._create_job(best_job)
            for best_job in best_allowed_jobs[self._num_jobs_for_first_batch:]
        ])


class _BestLocalMarketScoreGenerator(_BestJobsGenerator):

    name = i18n.make_translatable_string('Des métiers avec peu de concurrence %inDepartement')

    def _get_all_section_jobs(
            self, *, best_jobs: job_pb2.BestJobsInArea, **unused_kwargs: Any) \
            -> Sequence[job_pb2.RelatedJobGroup]:
        return best_jobs.best_local_market_score_jobs


class _BestRelativeScoreJobsGenerator(_BestJobsGenerator):

    name = i18n.make_translatable_string('Des métiers qui recrutent bien %inDepartement')

    def _get_all_section_jobs(
            self, *, best_jobs: job_pb2.BestJobsInArea, **unused_kwargs: Any) \
            -> Sequence[job_pb2.RelatedJobGroup]:
        return best_jobs.best_relative_score_jobs


class _BestSalariesGenerator(_BestJobsGenerator):

    name = i18n.make_translatable_string('Des métiers avec un bon salaire %inDepartement')

    def _create_job(self, related_job_group: job_pb2.RelatedJobGroup) -> upskilling_pb2.Job:
        shown_metric = related_job_group.local_stats.imt.junior_salary.short_text or \
            related_job_group.local_stats.salary.short_text
        return upskilling_pb2.Job(
            job_group=related_job_group.job_group,
            shown_metric=shown_metric,
        )

    def _get_all_section_jobs(
            self, *, best_jobs: job_pb2.BestJobsInArea, **unused_kwargs: Any) \
            -> Sequence[job_pb2.RelatedJobGroup]:
        return best_jobs.best_salaries_jobs


class _BestSalariesLowQualifGenerator(_BestJobsGenerator):

    name = i18n.make_translatable_string(
        'Des métiers avec un bon salaire accessibles avec un Bac+2 ou moins %inDepartement')

    max_level: 'job_pb2.DegreeLevel.V' = job_pb2.BTS_DUT_DEUG

    def _create_job(self, related_job_group: job_pb2.RelatedJobGroup) -> upskilling_pb2.Job:
        shown_metric = related_job_group.local_stats.imt.junior_salary.short_text or \
            related_job_group.local_stats.salary.short_text
        return upskilling_pb2.Job(
            job_group=related_job_group.job_group,
            shown_metric=shown_metric,
        )

    def _has_low_qualif(
            self, scoring_project: scoring.ScoringProject, job: job_pb2.RelatedJobGroup) -> bool:
        job_group = jobs.get_group_proto(scoring_project.database, job.job_group.rome_id)
        if not job_group or not job_group.requirements.diplomas:
            return False
        percent_required_high_diploma = sum(
            diploma.percent_required for diploma in job_group.requirements.diplomas
            if diploma.diploma.level > self.max_level
        )
        return percent_required_high_diploma < 50

    def _get_all_section_jobs(
            self, *, best_jobs: job_pb2.BestJobsInArea, scoring_project: scoring.ScoringProject) \
            -> Sequence[job_pb2.RelatedJobGroup]:
        return [
            best_job
            for best_job in best_jobs.best_salaries_jobs
            if self._has_low_qualif(scoring_project, best_job)
        ]


class _BestSalariesNoQualifGenerator(_BestSalariesLowQualifGenerator):

    name = i18n.make_translatable_string(
        'Des métiers avec un bon salaire accessibles sans diplôme %inDepartement')

    max_level = job_pb2.NO_DEGREE


class _RandomSectorGenerator(_Generator):

    name = ''

    def _get_jobs_for_sector(
            self, sector: job_pb2.SectorBestJobGroups, random_seed: str,
            allowed_job_ids: Set[str]) -> list[job_pb2.RelatedJobGroup]:
        randomizer = random.Random(random_seed)
        best_local_market_score_jobs = [
            best_job
            for best_job in sector.best_local_market_score_jobs
            if best_job.job_group.rome_id in allowed_job_ids
        ]
        randomizer.shuffle(best_local_market_score_jobs)
        return best_local_market_score_jobs

    def get_jobs(
            self, *, scoring_project: scoring.ScoringProject,
            allowed_job_ids: Set[str], previous_sections: Set[str]) \
            -> Optional[_ComputedSection]:
        previous_sector_ids = {
            section_id[len('sector-'):]
            for section_id in previous_sections
            if section_id.startswith('sector-')
        }

        sectors = _get_best_jobs_in_area(scoring_project).sectors[:]
        random.shuffle(sectors)
        for sector in sectors:
            if sector.sector_id in previous_sector_ids or sector.sector_id in _HIDDEN_SECTOR_IDS:
                continue
            random_seed = _create_random_seed()
            best_local_market_score_jobs = self._get_jobs_for_sector(
                sector, random_seed, allowed_job_ids)
            if not best_local_market_score_jobs:
                continue
            return _ComputedSection(
                [
                    upskilling_pb2.Job(job_group=best_job.job_group)
                    for best_job in best_local_market_score_jobs[:self._num_jobs_for_first_batch]
                ],
                new_id=f'sector-{sector.sector_id}',
                new_name=sector.description,
                state=random_seed)

        # All sectors have already been selected.
        return None

    def get_more_jobs(
            self, *, scoring_project: scoring.ScoringProject, section_id: str,
            state: str) -> upskilling_pb2.Section:
        """Generate more jobs for a given section."""

        sector_id = section_id.replace('sector-', '')

        try:
            sector = next(
                s for s in _get_best_jobs_in_area(scoring_project).sectors
                if s.sector_id == sector_id
            )
        except StopIteration:
            # Cannot find sector data at all.
            return upskilling_pb2.Section()

        good_jobs = jobs.get_all_good_job_group_ids(scoring_project.database)
        sector_jobs = self._get_jobs_for_sector(sector, state, good_jobs)
        return upskilling_pb2.Section(jobs=[
            upskilling_pb2.Job(job_group=job.job_group)
            for job in sector_jobs[self._num_jobs_for_first_batch:]
        ])


_SECTION_GENERATORS: dict[str, '_Generator'] = {
    'best-relative-local-score': _BestRelativeScoreJobsGenerator(),
    'best-local-market-score': _BestLocalMarketScoreGenerator(),
    'best-salaries': _BestSalariesGenerator(),
    'random-sector': _RandomSectorGenerator(),
    'best-salaries-no-qualifications': _BestSalariesNoQualifGenerator(),
    'best-salaries-low-qualifications': _BestSalariesLowQualifGenerator(),
    'serendipity': _RandomGenerator(),
    'all-jobs': _AllJobsGenerator(),
    'low-automation-risk': _LowAutomationRiskGenerator(),
}


_SECTION_SLOTS: proto.MongoCachedCollection[upskilling_pb2.Section] = \
    proto.MongoCachedCollection(upskilling_pb2.Section, 'section_generators', sort_key='_order')


@app.route('/sections', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=upskilling_pb2.Sections)
def get_sections_for_project(user_proto: user_pb2.User) -> upskilling_pb2.Sections:
    """Return all the sections to browse."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à explorer."))
    project = user_proto.projects[0]
    database = mongo.get_connections_from_env().stats_db
    scoring_project = scoring.ScoringProject(project, user_proto, database)

    result = upskilling_pb2.Sections()

    good_jobs = jobs.get_all_good_job_group_ids(scoring_project.database)
    best_salaries = {
        job.job_group.rome_id for job in _get_best_jobs_in_area(scoring_project).best_salaries_jobs}
    slots = list(_SECTION_SLOTS.get_collection(database))
    are_all_jobs_hiring = _get_are_all_jobs_hiring()
    for section in slots:
        if section.is_for_alpha_only and not user_proto.features_enabled.alpha:
            continue
        generator_id = section.generator
        try:
            generator = _SECTION_GENERATORS[generator_id]
        except KeyError:
            logging.error('Unknown upskilling section generator "%s"', generator_id)
            continue
        computed_section = generator.get_jobs(
            scoring_project=scoring_project, allowed_job_ids=good_jobs,
            previous_sections={
                section.id
                for section in result.sections
                if section.state.startswith(f'{generator_id}:')
            })
        if not computed_section or len(computed_section.jobs) < 2:
            continue
        result.sections.add(
            id=computed_section.new_id or generator_id,
            state=f'{generator_id}:{computed_section.state or ""}',
            name=scoring_project.populate_template(scoring_project.translate_key_string(
                f'jobflix_sections:{computed_section.new_id or generator_id}',
                hint=computed_section.new_name or generator.name,
                context=_get_bob_deployment(), is_hint_static=True)),
            jobs=[
                _add_perks_to_job(job, best_salaries, is_hiring=are_all_jobs_hiring)
                for job in computed_section.jobs],
        )

    return result


@app.route('/sections/<section_id>/jobs/<state>', methods=['POST'])
@proto_flask.api(in_type=user_pb2.User, out_type=upskilling_pb2.Section)
def get_more_jobs(
        user_proto: user_pb2.User, *, section_id: str, state: str) -> upskilling_pb2.Section:
    """Return more jobs for a given section."""

    if not user_proto.projects:
        flask.abort(422, i18n.flask_translate("Il n'y a pas de projet à explorer."))

    try:
        generator_id, section_state = state.split(':', 1)
    except ValueError:
        flask.abort(
            422,
            i18n.flask_translate("Le paramètre d'état {state} n'a pas le bon format.")
            .format(state=state))

    project = user_proto.projects[0]
    database = mongo.get_connections_from_env().stats_db
    scoring_project = scoring.ScoringProject(project, user_proto, database)

    try:
        generator = _SECTION_GENERATORS[generator_id]
    except KeyError:
        flask.abort(
            404,
            i18n.flask_translate('Générateur de section inconnu: {generator_id}')
            .format(generator_id=generator_id))

    try:
        section = generator.get_more_jobs(
            scoring_project=scoring_project, section_id=section_id, state=section_state)
    except _InvalidState:
        flask.abort(
            422,
            i18n.flask_translate('Impossible de commencer à {start_from}')
            .format(start_from=section_state))
    best_jobs_in_area = _get_best_jobs_in_area(scoring_project)
    are_all_jobs_hiring = _get_are_all_jobs_hiring()
    best_salaries = {
        job.job_group.rome_id for job in best_jobs_in_area.best_salaries_jobs}
    for job in section.jobs:
        _add_perks_to_job(job, best_salaries, is_hiring=are_all_jobs_hiring)
    return section


@app.route('/areas', methods=['GET'])
@proto_flask.api(out_type=upskilling_pb2.Areas)
def get_available_areas() -> upskilling_pb2.Areas:
    """Return all the areas that have interesting data."""

    database = mongo.get_connections_from_env().stats_db
    area_ids = {
        doc.get('_id')
        for doc in database.best_jobs_in_area.find({}, {'_id': 1})
    } | {
        doc.get('_id')
        for doc in database.departements.find({}, {'_id': 1})
    }
    return upskilling_pb2.Areas(area_ids=sorted(area_ids))


def _make_project_id(project: project_pb2.Project) -> str:
    if project.project_id:
        return project.project_id
    departement_id = project.city.departement_id
    rome_id = project.target_job.job_group.rome_id
    return f'{departement_id}:{rome_id}'


def _save_project(
        project: project_pb2.Project, unused_previous_project: project_pb2.Project,
        user_data: user_pb2.User) -> project_pb2.Project:
    database, users_database, eval_database = mongo.get_connections_from_env()
    users_database = users_database.with_prefix('jobflix_')
    project.project_id = _make_project_id(project)
    if not project.HasField('created_at'):
        common_proto.set_date_now(project.created_at)
    if user_data.profile.email:
        all_campaigns.send_campaign(
            'jobflix-welcome', user_data, action='send',
            database=database, users_database=users_database, eval_database=eval_database,
            now=now.get())
        _give_coaching_feedback(user_data.user_id, user_data.profile.email, project)
    return project


def _give_coaching_feedback(user_id: str, email: str, project: project_pb2.Project) -> None:
    job_url = 'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?' + parse.urlencode({
        'codeMetier': project.target_job.code_ogr,
        'codeZoneGeographique': project.city.departement_id,
        'typeZoneGeographique': 'DEPARTEMENT',
    })
    job_name = project.target_job.name
    header = (
        f'A user has asked for some coaching to become a <{job_url}|{job_name}>!\n'
        f'See their expectations below.\n')
    user.give_project_feedback(
        user_id, '@' in email, project,
        base_feedback=feedback_pb2.Feedback(source=feedback_pb2.UPSKILLING_FEEDBACK),
        header=header, prefix='jobflix_')


@app.route('/user', methods=('POST',))
@proto_flask.api(in_type=user_pb2.User, out_type=user_pb2.User)
def save_user(user_data: user_pb2.User) -> user_pb2.User:
    """Save a user in the database."""

    unused_, users_database, unused_ = mongo.get_connections_from_env()
    users_database = users_database.with_prefix('jobflix_')
    collection = users_database.user

    if user_data.profile.email:
        if db_user := collection.find_one(
                {'hashedEmail': (hashed_email := auth.hash_user_email(user_data.profile.email))},
                {'_id': 1, 'projects': 1}):
            user_data.user_id = str(db_user['_id'])
            new_projects = list(user_data.projects[:])
            user_data.ClearField('projects')
            user_data.projects.extend(
                proto.create_from_mongo(p, project_pb2.Project, always_create=True)
                for p in db_user.get('projects', []))
            old_project_ids = {p.project_id for p in user_data.projects}
            user_data.projects.extend(
                p for p in new_projects if _make_project_id(p) not in old_project_ids)
        elif user_data.user_id:
            collection.update_one({'_id': objectid.ObjectId(user_data.user_id)}, {'$set': {
                'profile.email': user_data.profile.email,
                'hashedEmail': hashed_email,
            }})
    user_data = user.save_user(user_data, not user_data.user_id, users_database.user, _save_project)
    return user_data


@app.route('/user', methods=('DELETE',), defaults={'user_id': ''})
@app.route('/user/<user_id>', methods=('DELETE',))
@app.route('/user/delete/<user_id>', methods=('GET',))
def delete_user(*, user_id: str) -> Tuple[str, int]:
    """Delete a user from their internal ID."""

    user_db = mongo.get_connections_from_env().user_db.with_prefix('jobflix_')
    auth_token = flask.request.headers.get('Authorization', '').replace('Bearer ', '') or \
        flask.request.args.get('token', '')
    user_data = user_pb2.User(user_id=user_id)
    user_data.profile.email = flask.request.args.get('email', '')
    deleted_id = user.delete_user(user_data, auth_token, user_db=user_db)
    if not deleted_id:
        return i18n.flask_translate(
            "Nous n'avons pas trouvé votre email dans notre base de données.\n"
            'Si vous ne vous étiez pas encore désabonné·e, '
            'contactez nous à contact@jobflix.app pour vous assurer de votre désinscription.'), 404
    return i18n.flask_translate(
        'Votre requête a été prise en compte.\n'
        'Votre adresse email sera supprimée de la base Jobflix dans les prochaines 24 heures.'), 202
