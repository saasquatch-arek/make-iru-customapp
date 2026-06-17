# Iru Make App

Custom Make app for Iru Endpoint Management, formerly Kandji.

This local app keeps the parts that are currently verified in your tenant and extends them only with Kandji/Iru API features that are supported by the official public docs.

## Tenant API URL

The app expects the full tenant-specific Iru API URL exactly as shown in the Iru admin UI after creating an API token.

Examples:

- `https://tenant.api.kandji.io/api/v1`
- `https://tenant.api.eu.kandji.io/api/v1`
- `https://tenant.api.iru.com/api/v1`

## Connection

The app currently ships one basic connection:

- `Iru Read API Key`

Connection parameters:

- `Tenant API URL`: full tenant-specific Iru API base URL ending in `/api/v1`
- `API Key`: tenant-scoped Iru API token

Connection validation uses `GET /devices?limit=1`.

## Active Modules

### Devices

- `List devices`
- `Get device`
- `List device library items`

### Blueprints

- `List blueprints`
- `Get blueprint`

### Advanced

- `Make an API Call`

## User-related reads

The public Kandji/Iru device list docs expose user-related filters on the device list endpoint, so `List devices` now supports documented filters such as `user_email`, `user_id`, and `user_name`.

I did not reintroduce a standalone `List users` module because I could not verify a standalone public user endpoint in the official docs you pointed me to.

## Local Structure

```text
Iru/
  connections/
    connection1/
  general/
    base.iml.json
  modules/
    groups.json
    searchsn/
    getdevice/
    listblueprints/
    getblueprint/
    listdevicelibraryitems/
    makeapicall/
  makecomapp.json
  README.md
```

## Make Origin Mapping

`makecomapp.json` points to:

- app id: `iru-app-fwosfx`
- Make zone: `us1.make.celonis.com`

## Notes

- `.secrets/apikey` is used for the Make app origin, not for the Iru tenant API token used when creating a connection in scenarios.
- Older speculative module folders may still exist locally, but only the modules referenced from `makecomapp.json` are active.

## Next Steps

1. Redeploy the local app so the active manifest matches this expanded verified scope.
2. Test `List blueprints`, `Get blueprint`, and `List device library items` in Make.
3. If you want standalone user modules later, first verify the exact public user endpoint and response shape through the official docs or with `Make an API Call`.
