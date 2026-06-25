# Observe Make App

Custom Make app for sending structured Make.com scenario outcome events to Observe.

The first module is designed for the final step of success and error-handler branches. It posts JSON to Observe's HTTP ingestion endpoint.

## Connection

The app uses one basic connection:

- `Observe Datastream Token`

Connection parameters:

- `Customer ID`: the 12-digit Observe customer ID from `https://<customer_id>.observeinc.com`
- `Datastream Token`: an Observe Datastream token with write access to the target Datastream
- `Make API Base URL`: optional, required only to load and fetch Make custom scenario properties. Use the API base URL for the user's Make zone, ending in `/api/v2`, without a trailing slash. Do not use the organization page URL.
- `Make Organization ID`: optional, used only when `Make Custom Property Structure ID` is empty. This is the numeric organization ID from the user's Make organization URL.
- `Make Custom Property Structure ID`: optional but recommended when using Make custom properties. This is the ID used in `/custom-property-structures/{id}/custom-property-structure-items`.
- `Make API Token`: optional, used to load and fetch Make custom scenario properties. Required token scopes: `custom-property-structures:read` and `scenarios:read`. Paste only the token value, without the word `Token`.

Connection validation sends a small `connection_test` event to:

```text
https://<customer_id>.collect.observeinc.com/v1/http/make/connection-test
```

## Module

The app has two event-sending modules:

- `Send scenario event`: use directly inside a scenario branch, usually as the last module in a success path, warning path, or error handler. This is for explicit, branch-level outcome reporting.
- `Send scenario log event`: use in a monitoring scenario after fetching Make scenario logs. This is for automatically forwarding execution-history events from Make's scenario log endpoint.

### Send scenario event

Dedicated to explicit scenario outcome reporting from inside a running Make scenario. Use this when the scenario itself decides what should be reported to Observe, such as a successful business process, a handled warning, or an error-handler branch.

Posts to:

```text
https://<customer_id>.collect.observeinc.com/v1/http/make/scenario-outcome
```

Default body:

```json
{
  "timestamp": "{{now}}",
  "source": "make.com",
  "event_type": "scenario_outcome",
  "outcome_type": "Error",
  "severity": "high",
  "scenario_name": "",
  "scenario_id": "{{scenario.id}}",
  "scenario_url": "",
  "execution_id": "",
  "execution_url": "",
  "related_itsm_task_id": "",
  "related_itsm_task_url": "",
  "credits_consumed": null,
  "data_consumed": null,
  "operations_consumed": null,
  "execution_time": "",
  "execution_time_seconds": null,
  "system_message": "{{error.message}}",
  "module_name": "{{error.module}}",
  "custom_attributes": {
    "environment": "production"
  },
  "details": {}
}
```

`outcome_type` is a dropdown with:

- `Success`
- `Warning`
- `Error`
- `Critical`

Mapped outcome type values are accepted even when they do not match dropdown casing. Values are normalized to title case before sending, so `error` is sent as `Error`.

`Impact` is a dropdown sent as the `severity` payload field:

- `info`
- `low`
- `medium`
- `high`

Mapped impact values are accepted even when they do not match dropdown casing. Values are normalized to lowercase before sending, so `Info` is sent as `info`. Impact describes business or operational effect, while `outcome_type` describes the event result.

Additional optional execution fields can be mapped in the module when Make exposes the values in the scenario:

- `Execution URL`
- `Execution Time` in `HH:MM:SS` format

`execution_time_seconds` is calculated automatically from `Execution Time` and sent as a numeric value for charting, filtering, and alerting.

The module's advanced section contains less common optional fields:

- `System Message`
- `Credits Consumed`
- `Data Consumed`
- `Operations Consumed`

Related ITSM fields are also optional, platform-neutral, and shown in the advanced section:

- `Related ITSM Task ID`
- `Related ITSM Task URL`

The app does not call the ITSM platform directly. Users can map these values from previous Make modules, data stores, or formulas.

`custom_attributes` is fetched automatically:

- If `Make API Token` is empty, `custom_attributes` is sent as an empty object.
- If `Make API Token` and `Make Custom Property Structure ID` are configured, the module loads a multi-select list from that custom property structure.
- If `Make Custom Property Structure ID` is empty, the module can try to auto-discover the first structure from `Make Organization ID`, but using the explicit structure ID is more reliable.
- If `Make API Base URL` is empty, no Make custom properties are loaded or sent.
- Selected custom properties are fetched from `GET /scenarios/{scenarioId}/custom-properties` during execution and sent to Observe.
- If a selected custom property exists with an empty value, it is still sent as an empty value.

### Send scenario log event

Dedicated to scenario execution history gathered from Make's scenario log endpoint. Use this when a separate monitoring scenario reads Make execution logs and forwards each log bundle to Observe as a normalized execution event.

Posts to:

```text
https://<customer_id>.collect.observeinc.com/v1/http/make/scenario-execution
```

This module is intended for events returned by Make's scenario log endpoint. Map one scenario log bundle into the module. The module sends a normalized execution event to Observe.

Default normalized body shape:

```json
{
  "timestamp": "2026-06-25T16:02:35.006Z",
  "source": "make.com",
  "event_type": "scenario_execution",
  "make_event_type": "EXECUTION_END",
  "outcome_type": "Success",
  "severity": "info",
  "status": 1,
  "status_label": "Success",
  "scenario_name": "Monitor Make events",
  "process_label": "scenario_monitoring",
  "scenario_id": 123456,
  "execution_id": "2d722ed24feb44d6a080ebe8b642fd12",
  "execution_type": "manual",
  "instant": false,
  "duration_ms": 459,
  "execution_time_seconds": 0.459,
  "centicredits": 100,
  "credits_consumed": 1,
  "operations_consumed": 1,
  "data_consumed_bytes": 1791,
  "is_replayable": true,
  "organization_id": 12345,
  "team_id": 123,
  "author_id": 123456,
  "author_name": "Automation User",
  "replay_of_execution_id": null,
  "replay_of_execution_name": null,
  "replay_of_execution_timestamp": null,
  "make_log_event_id": "1782403355006_2d722ed24feb44d6a080ebe8b642fd12",
  "custom_attributes": {
    "environment": "production"
  },
  "details": {}
}
```

Derived fields:

- `outcome_type`: derived from Make `statusLabel`.
- `severity`: `info` for `Success`, `medium` for `Warning`, and `high` for other status labels.
- `execution_time_seconds`: calculated from Make `duration` milliseconds.
- `credits_consumed`: calculated from Make `centicredits / 100`.
- `data_consumed_bytes`: mapped from Make `transfer`.

Status fields:

- `status_label`: used to derive `outcome_type` and `severity`.
- `status`: raw Make numeric status code, kept for filtering or troubleshooting when needed.

`process_label` is optional and can be mapped or entered manually to group related execution events, for example `invoice_sync`, `device_inventory`, or `scenario_monitoring`.

`custom_attributes` works the same way as in the `Send scenario event` module. If Make API settings are configured in the connection and custom properties are selected in the module, the app fetches scenario custom-property values using the mapped scenario log `scenarioId`.

Do not map Make iterator metadata fields like `__IMTLENGTH__` and `__IMTINDEX__`; they describe the current Make bundle position, not the scenario execution event.

## Local Structure

```text
Observe/
  connections/
    connection1/
  general/
  modules/
    groups.json
    sendexecutionlogevent/
    sendevent/
  rpcs/
    listmakecustompropertycheckboxes/
  makecomapp.json
  README.md
```
