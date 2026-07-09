-- Phase 2 (taste/trend brain): give each home an explicit property value band
-- so the trend brain's price-tier register (trend-intelligence.ts
-- resolveTierRegister) is exact instead of defaulting to the middle SC luxury
-- register. This sets the *level of authorship* the concepts target
-- ($1m-$3m edited luxury vs $6m-$10m fully authored). Additive, nullable:
-- existing homes stay on the safe middle-register fallback until set.

alter table public.homes add column if not exists value_band text;

comment on column public.homes.value_band is
  'Owner-facing property value band (e.g. "$1m-$3m", "$3m-$6m", "$6m-$10m"). Feeds trend-intelligence resolveTierRegister; null falls back to the middle register.';
