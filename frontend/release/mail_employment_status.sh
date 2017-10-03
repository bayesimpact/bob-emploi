#!/bin/bash
export FROM_DATE=$(date -d "97 days ago" +%Y-%m-%d)
export TO_DATE=$(date -d "90 days ago" +%Y-%m-%d)

aws ecs run-task \
  --task-definition frontend-flask \
  --overrides '{
    "containerOverrides": [{
      "name": "flask",
      "command": ["python", "bob_emploi/frontend/asynchronous/focus_email.py", '\ '
        "employment-status", "send", "--registered-from", "'$FROM_DATE'", '\ '
        "--registered-to", "'$TO_DATE'"]
    }]
  }'
