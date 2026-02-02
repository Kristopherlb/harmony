# OpenAPI / Swagger Spec References (Integrations)

This document centralizes OpenAPI/Swagger references for third-party integrations used by Harmony capabilities and incident workflows.

## Spec URLs

| Service | OpenAPI / Swagger reference |
| --- | --- |
| PagerDuty | **Primary (plan):** user-provided spec (TBD). **Upstream schema repo:** `https://github.com/PagerDuty/api-schema` |
| Statuspage | `https://developer.statuspage.io/` |
| Confluence Cloud | `https://developer.atlassian.com/cloud/confluence/swagger.v3.json` |

## Notes

- PagerDuty’s published OpenAPI sources live in the GitHub schema repository; capabilities should pin to a specific file/commit as part of provider implementation.
- Statuspage documentation is published at the link above; if an official OpenAPI is needed, capture and pin the exact URL/commit at the time the capability is implemented.

