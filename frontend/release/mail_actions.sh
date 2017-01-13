#!/bin/bash
aws ecs run-task \
  --task-definition frontend-flask \
  --overrides '{
    "containerOverrides": [{
      "name": "flask",
      "command": ["python", "bob_emploi/frontend/asynchronous/mail_actions.py"],
      "environment": [{
        "name": "NODRY_RUN",
        "value": "1"
      }]
    }]
  }'
