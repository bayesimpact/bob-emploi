The data in this folder is automatically downloaded from AirTable.

```
docker-compose run \
  --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \
  frontend-dev-webpack \
  npm run download
```
