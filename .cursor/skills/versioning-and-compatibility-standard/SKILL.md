---
name: versioning-and-compatibility-standard
description: Apply VCS-001 to enforce SemVer bump rules, deprecation policy, and Temporal-safe blueprint evolution constraints.
---

## Versioning & Compatibility Standard (VCS-001)

Use this skill when changing schemas, behavior, or workflow logic and you need deterministic rules for version bumps and deprecation handling.

### When to Use

- Modifying capability schemas or behavior (OCS artifacts)
- Modifying blueprint descriptors or workflow logic (WCS artifacts)
- Marking fields/IDs as deprecated and defining end-of-life
- Writing audits that classify changes as breaking/non-breaking

### Instructions

1. **Use SemVer** for all artifact `metadata.version`.
2. **Apply schema bump rules**: breaking schema changes require MAJOR.
3. **Apply workflow compatibility rules**: changes must respect Temporal determinism; incompatible changes require WCS rollout mechanisms.
4. **Deprecate formally**: define deprecation + replacement + EOL; audits WARN before EOL and FAIL after.

See `references/versioning-and-compatibility-standard.md` for the normative specification.

