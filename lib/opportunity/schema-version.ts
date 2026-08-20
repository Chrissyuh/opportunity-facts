export const V1_SCHEMA_VERSION = "1.0.0" as const;

// Schema 2.0.0 is retained as a read-only import contract. Schema 2.1.0 adds
// explicit educator outcome/recipient/distribution vocabulary and updates the
// deterministic projection rules so educator- and school-scoped benefits
// cannot appear as participant benefits.
export const LEGACY_V2_SCHEMA_VERSION = "2.0.0" as const;
export const SCHEMA_VERSION = "2.1.0" as const;

export const SUPPORTED_IMPORT_SCHEMA_VERSIONS = [
  V1_SCHEMA_VERSION,
  LEGACY_V2_SCHEMA_VERSION,
  SCHEMA_VERSION,
] as const;
