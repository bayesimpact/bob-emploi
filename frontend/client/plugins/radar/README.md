# Radar

This project, externally called MILOrizons, aims to evaluate the change that MILO is bringing to
the young people they are coaching. As of 2021 MILO are evaluated (by their partners and funders)
only on the jobs and vocational trainings they help their beneficiaries to get, however their
coaching is much wider and they also want a more granular view.

Technically the Radar product has several components:
1. A bookmarklet to start from MILO information system and jump to the next step with a
   beneficiary's ID.
2. A Typeform where coaches can evaluate the beneficiary on many criterias.
3. A script to populate an ElasticSearch database on which a Kibana dashboard is displaying the
   aggregated results.
4. A script to send email to MILO coaches and tell them when they need to do a new evaluation.

## Bookmarklet

The bookmarklet is designed as a Bob plugin (historically to speed up development). It is located in
`frontend/client/plugins/radar`.

## Typeform

A regular Typeform with a Pro account to handle many answers.

The definition of the Typeforms (demo and prod) are in `data_analysis/radar/forms`.

To update the Typeform, you can either use the interface or start from the git JSON files.

### Update using Typeform Interface

Go to the Typeform website and update them as you need. When you're done, download the version to
your local folder and create a Pull Request to merge your changes in git.

```sh
docker-compose run --rm data-analysis-prepare radar/typeform_radar.py
```

### Update using JSON

First download the live versions (see command line above) to make sure that the file version is the
latest, then do the modifications. Once you're done, send your changes to review and once they
are accepted and submitted run the following command to update the live version:

```sh
docker-compose run --rm data-analysis-prepare radar/typeform_radar.py upload
```

## Export answers to ElasticSearch

The export script is in Python and is located in `data_analysis/radar`.

### Dashboard in Kibana

The config of the Kibana dashboard is stored in `data_analysis/radar/dashboard.ndjson`.

To reimport it, first compact it:

```
jq -c . data_analysis/radar/dashboard.ndjson > radar-kibana.ndjson
```

To export it and update our stored version, pretty print it:

```
jq . radar-kibana.ndjson > data_analysis/radar/dashboard.ndjson
```


## Email script

TODO(pascal): Implement the script.
