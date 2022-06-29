# Importers

A folder to hold scripts that helped us import data from different formats into
our database.

Data should *never* be imported without a trace (and a review) of the tool that
was used to import it.

## How to use importers?
Data come from multiple sources:
- [external](https://github.com/bayesimpact/bob-emploi-internal/tree/main/data_analysis/data),
- manually collected, that can be found in [Airtable](https://airtable.com/invite/l?inviteId=invAoCsDNsHDDc3gH&inviteToken=51a83931d93870de080dd2d8a5ad7d9ae99127f1f264d817c51a9714f994f515&utm_medium=email&utm_source=product_team&utm_content=transactional-alerts).

Here are a couple of examples of the importer usage for both cases:

### External data

Let's say that when suggesting jobs, you want to keep only highly recruiting careers. Then, you'd need to
have an up-to-date version of the [job offer counts dataset](https://github.com/bayesimpact/bob-emploi-internal/blob/def22464e36df286b81e4080978f268ad4c6d119/data_analysis/Makefile.public#L170).

To import a new version of the recent job offer counts, you'd have to…

1. Get the new data from Pôle emploi with

```
docker-compose run --rm data-analysis-prepare make data/job_offers/recent_job_offers.csv
```

*Note that you'll need to have emploi store credentials. To get them, create a
`client_id` and a `client_secret` for an [Emploi Store app](https://www.emploi-store-dev.fr).
Then, use them to set the environment variables EMPLOI_STORE_CLIENT_ID and EMPLOI_STORE_CLIENT_SECRET.*

2. Import the new dataset to the database

```
docker compose run -e MONGO_URL=="$MONGO_URL" --rm data-analysis-prepare importer/import_status.py --run recent_job_offers
```

<!--TODO(sil): Specifiy where the $MONGO_URL comes from and which rights it should have.-->
*You'll have to review the changes between the old and the new version.*

3. You're done! Now, start filter jobs!

### Collected data

Imagine that you have to add a new email template to help jobseekers in their networking effort.

1. You'd need to add your new piece of content with the others networking email templates in [Airtable](https://airtable.com/appXmyc7yYj0pOcae/tblwOQiMBuQQ25SZ2/viwWwJx4mbrru0zQe?blocks=hide).

*Make sure that you respect formatting rules: no trailing spaces, punctuation rules…*


2. Then you can import it by running this script

```
docker compose run -e MONGO_URL=="$MONGO_URL" --rm data-analysis-prepare importer/import_status.py --run contact_lead
```

3. You're done!

### Real-life example

Importers are used quite frequently when improving or fixing the product content. Here you can find a real-life [example](https://www.notion.so/bayesimpact/Content-management-from-Joanna-122d9449214b45a7af8db9727ac0b9e6#0ec5b23e30d242fc8f80f197b2f2fd18) of their usage in this context.

## How to create an importer?

New deployments often goes with new content, so we have had to build deployment specific importers.
As an example, for the `fr` deployment, the importer for job requirement can be found [here](./job_offers_requirements.py).
While we had to create a [custom one](./deployments/uk/occupations_requirements.py) for the `uk`.


If you need to create a `uk` deployment specific importer for seasonal jobbing you'd have to follow these steps.

1. Find you dataset. Duh!

2. Find out which format is requested for seasonal jobbings in our database. In the script [importers.py](./importers.py), you have the relevant info you need about the `fr` importer:

- The name of the importer script.
- The name of the dataset file.
- The data structure that the script should return (proto_type). An overview of the protobuffers can be found [here](https://developers.google.com/protocol-buffers/docs/overview). A great example of protobuffers in use can be found [here](https://docs.google.com/document/d/1taI4WHhZ6qGphwROslXUAtVhAyhGh1UxbXTERwR5-tM/edit). You'll find the seasonal jobbings protobuffer in the corresponding file [seasonal_jobbing.proto](https://github.com/bayesimpact/bob-emploi-internal/blob/main/frontend/api/seasonal_jobbing.proto).

3. Implement your importer.

- The script should be localized in the relevant `data_analysis\importer\deployments` repository.

- Make sure that you update the `__init__.py` file of the deployment repository.

- Don't forget to add some tests, you'll find plenty of examples in the codebase.

4. You're good to go! You can start importing. Be careful when setting the MONGO_URL so that it's the one related to the deployment you are working with.

