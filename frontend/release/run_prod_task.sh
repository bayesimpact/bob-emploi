#!/bin/bash
# Template to run a frontend-flask task on AWS: update the command line.

# Basic tasks:
# elasticSearch sync example:
#	- modify the the containerOverrides object by the one found in:
#	./scheduled-tasks/sync-user-elasticsearch.json
#	- if environment value is REDACTED replace it by the one found by running:
#		aws events list-targets-by-rule --rule sync-user-elasticsearch

aws ecs run-task \
  --task-definition frontend-flask \
  --region eu-west-3 \
  --overrides '{
    "containerOverrides": [{
      "name": "flask",
      "command": ["python", "bob_emploi/frontend/server/asynchronous/mail/mail_blast.py", "focus-network", "dry-run"]
    }]
  }'
