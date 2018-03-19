#!/bin/bash
# Template to run a frontend-flask task on AWS: update the command line.

aws ecs run-task \
  --task-definition frontend-flask \
  --region eu-west-3 \
  --overrides '{
    "containerOverrides": [{
      "name": "flask",
      "command": ["python", "bob_emploi/frontend/server/asynchronous/mail/mail_blast.py", "focus-network", "dry-run"]
    }]
  }'
