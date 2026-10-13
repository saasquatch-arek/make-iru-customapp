# Iru Make App

Custom Make app for Iru Endpoint Management, formerly Kandji.

The local manifest includes seven modules. Their endpoint and response definitions are based on the [official Iru API documentation](https://api-docs.iru.com/). Checking those definitions against documentation does not replace testing them in a Make scenario.

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
- `List tags`

### Advanced

- `Make an API Call`

## User-related reads

The public Kandji/Iru device list docs expose user-related filters on the device list endpoint, so `List devices` now supports documented filters such as `user_email`, `user_id`, and `user_name`.

`User ID` accepts an Iru UUID, as documented by the current API. The official docs also include `GET /users`, but the older `listusers` module is excluded from the local manifest and still needs its response shape and pagination corrected before it is included.

## Pagination and tag output

- `List devices` fetches up to 300 devices per request and advances the offset until the requested total limit is reached or no more devices are returned. Its optional `Offset` input sets the first matching record to return.
- `List blueprints` and `List tags` follow the API's `next` URL until the requested total limit is reached or the API returns no next page.
- `Limit` is the maximum total number of bundles to return, not the page size, and must be at least 1.
- `List tags` reads the `results` array. It exposes the documented `id` and `name`, a `tag_id` alias for existing mappings, and the full tag under `Body`. The legacy `color` and `device_count` fields remain available if returned by the API, but the current official example does not include them.

The API key is masked when editing a connection, and authorization headers are excluded from request logs. Error messages use the API's `message`, `detail`, or `error` field, with a fallback when none is present.

## OS version searches

The Iru device-list API documents a single `os_version` substring filter. It does not document a less-than comparison or an OR query for several OS versions. `List devices` implements the additional filters using built-in IML expressions in `response.iterate.condition`, without a custom function:

- `OS Version`: the existing API-side substring filter, for one string.
- `OS Version Below`: a strict numeric comparison. For example, `26.7` includes `26.6.1` but excludes `26.7`, `26.7.0`, and `26.10`. Missing components are treated as zero. Apple suffixes such as `26.6 (a)` use their numeric base version; empty or nonnumeric versions such as `24H2` are excluded from this comparison. Each numeric component can have up to nine digits.
- `OS Version Contains Any`: comma-separated literal substrings. `26.6., 26.7` matches either string, including `26.6.1` and `26.7.2`. Dots are literal, and empty entries are ignored. `26.6.` does not match `26.6` without the final dot.

All supplied filters are combined: if both new fields are set, a device must be below the threshold and match at least one substring. The existing API-side `OS Version` filter also applies if set; leave it blank when searching for several version strings.

These additional filters scan API pages of up to 300 devices and apply `Limit` to matching results. Pagination uses the raw API response to continue past pages with no matches. `Offset` skips API records before local filtering, not matching results. Broad searches can require more API calls and are subject to [Make's pagination limits](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination#limits).

Creating custom IML functions requires Make's `apps edit` admin permission. This app has no custom function component, so deployment does not attempt to create one. The OS filters use built-in `replace`, `split`, `join`, and `if` functions. Numeric versions are normalized by removing leading zeros and trailing zero components, then padding each remaining component to nine digits before comparison.

Run the numeric comparison and substring regression tests from the repository root:

```sh
node Iru/tests/os-version-filters.test.cjs
```

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
    listtags/
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
- Only the modules referenced from `makecomapp.json` are included in local deployment. Excluding a folder from the manifest does not mean the remote module has been removed.

## Deployed state checked on 2026-10-07

The configured Make API reports app version `1.0.0` and twelve modules. The seven modules in the local manifest were present, along with five older modules: `listadedevices`, `listadeintegrations`, `listdeviceactivity`, `listdeviceapps`, and `listusers`. These five are grouped under `Other` remotely and are not archived. The deployed `listadedevices` communication also differs from its local file.

The app metadata reports `public: true` and `approved: false`; each module reports `public: false`. Those flags alone do not establish which existing scenarios can use the app. Deployment and scenario execution were not performed as part of this check.

## Next Steps

1. Deploy the reviewed local fixes for the seven manifest modules and the connection.
2. Test device listing with a UUID user filter, a limit above 300, both additional OS version filters (including a page with no matches), and multi-page blueprint and tag listing in Make.
3. Reconcile the five older remote modules separately, preserving any scenario dependencies and the remote ADE changes.
