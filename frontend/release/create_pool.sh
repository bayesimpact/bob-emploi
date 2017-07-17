#!/bin/bash
aws ecs run-task \
  --task-definition frontend-flask \
  --overrides '{
    "containerOverrides": [{
      "name": "flask",
      "command": ["python", "bob_emploi/frontend/asynchronous/create_pool.py"]
    }]
  }'

