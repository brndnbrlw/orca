#!/usr/bin/env python3
import datetime
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from urllib.parse import urlsplit

CREDENTIAL_PATH = Path("/data/runtime-credentials.json")
RUNTIME_ROOT = Path("/opt/orca/agent-runtimes")


def read_credentials():
    try:
        fd = os.open(CREDENTIAL_PATH, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return {}
    with os.fdopen(fd, "r") as stream:
        metadata = os.fstat(stream.fileno())
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & 0o077:
            raise ValueError("Runtime credential file must be a private regular file (0600)")
        return json.load(stream)


def check_expiration(value):
    if isinstance(value, (int, float)):
        expiry = float(value)
    else:
        expiry = datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    if expiry <= datetime.datetime.now(datetime.timezone.utc).timestamp() + 30:
        raise ValueError("Runtime credentials expired; rerun configure-runtimes.ps1")


def validate_record(provider, record):
    if not isinstance(record, dict):
        raise ValueError("Invalid runtime credential record")
    if provider == "codex":
        if not isinstance(record.get("accessToken"), str) or not record["accessToken"].strip():
            raise ValueError("Missing Accela gateway access token")
        check_expiration(record["expires_on"])
        url = urlsplit(record["base_url"])
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("Gateway URL must be HTTPS without embedded credentials or query parameters")
        model = record["model"]
    else:
        credentials = record["credentials"]
        for key in ("AccessKeyId", "SecretAccessKey", "SessionToken"):
            if not isinstance(credentials.get(key), str) or not credentials[key]:
                raise ValueError("Selected Bedrock profile must supply temporary session credentials")
        if credentials.get("Expiration"):
            check_expiration(credentials["Expiration"])
        if not re.fullmatch(r"[a-z0-9-]+", record["region"]):
            raise ValueError("Invalid AWS region")
        model = record["model"]
    if not isinstance(model, str) or not re.fullmatch(r"[A-Za-z0-9._:/-]+", model):
        raise ValueError("Invalid model identifier")


def import_credentials():
    incoming = json.load(sys.stdin)
    if not isinstance(incoming, dict) or not incoming or set(incoming) - {"claude", "codex"}:
        raise ValueError("Expected selected Claude and/or Codex credentials")
    for provider, record in incoming.items():
        validate_record(provider, record)
    if incoming.get("codex", {}).get("model_catalog"):
        catalog = incoming["codex"]["model_catalog"]
        if not isinstance(catalog, dict) or not isinstance(catalog.get("models"), list):
            raise ValueError("Invalid organization model catalog")
        if incoming["codex"]["model"] not in [model.get("slug") for model in catalog["models"]]:
            raise ValueError("Selected model is absent from the organization catalog")
        catalog_path = CREDENTIAL_PATH.parent / "codex-models.json"
        if catalog_path.is_symlink():
            raise ValueError("Model catalog cannot be a symbolic link")
        catalog_fd, catalog_temp = tempfile.mkstemp(prefix=".orca-models-", dir=CREDENTIAL_PATH.parent)
        try:
            with os.fdopen(catalog_fd, "w") as stream:
                os.fchmod(stream.fileno(), 0o600)
                json.dump(catalog, stream)
            os.replace(catalog_temp, catalog_path)
        finally:
            if os.path.exists(catalog_temp):
                os.unlink(catalog_temp)
    records = read_credentials()
    records.update(incoming)
    if CREDENTIAL_PATH.is_symlink():
        raise ValueError("Credential file cannot be a symbolic link")
    fd, temporary = tempfile.mkstemp(prefix=".orca-runtime-", dir=CREDENTIAL_PATH.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(records, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, CREDENTIAL_PATH)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("Configured " + ", ".join(sorted(incoming)) + " in private container storage")


def required_record(provider):
    record = read_credentials().get(provider)
    if record is None:
        raise ValueError("Runtime is not authenticated; run configure-runtimes.ps1")
    validate_record(provider, record)
    return record


def run_claude(arguments):
    record = read_credentials().get("claude", {})
    environment = os.environ.copy()
    for key in list(environment):
        if key.startswith(("ANTHROPIC_", "AWS_", "CLAUDE_CODE_USE_", "OTEL_")):
            environment.pop(key)
    environment.update({
        "CLAUDE_CODE_USE_BEDROCK": "1",
        "AWS_REGION": record.get("region", "us-east-2"),
        "AWS_EC2_METADATA_DISABLED": "true",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
        "DISABLE_TELEMETRY": "1",
        "DISABLE_ERROR_REPORTING": "1",
        "DISABLE_AUTOUPDATER": "1",
        "DO_NOT_TRACK": "1",
    })
    if record.get("model"):
        environment["ANTHROPIC_MODEL"] = record["model"]
    binary = RUNTIME_ROOT / "node_modules/@anthropic-ai/claude-code-linux-x64/claude"
    os.execve(binary, [str(binary), *arguments], environment)


def run_codex(arguments):
    record = read_credentials().get("codex", {})
    settings = {
        "model": record.get("model", "gpt-6.1-sol-global"),
        "model_provider": "accela",
        "model_providers.accela.name": "Accela AI Gateway",
        "model_providers.accela.base_url": record.get("base_url", "https://ai-support-apim-vnet.azure-api.net/openai"),
        "model_providers.accela.wire_api": "responses",
        "model_providers.accela.requires_openai_auth": False,
        "model_providers.accela.auth.command": "/usr/bin/python3",
        "model_providers.accela.auth.args": [str(RUNTIME_ROOT / "runtime-auth.py"), "codex-token"],
        "model_providers.accela.auth.timeout_ms": 5000,
        "model_providers.accela.auth.refresh_interval_ms": 300000,
        "analytics.enabled": False,
        "check_for_update_on_startup": False,
        "otel.exporter": "none",
        "otel.metrics_exporter": "none",
        "otel.trace_exporter": "none",
        "otel.log_user_prompt": False,
    }
    if record.get("model_catalog"):
        settings["model_catalog_json"] = str(CREDENTIAL_PATH.parent / "codex-models.json")
    overrides = []
    for key, value in settings.items():
        overrides.extend(["-c", key + "=" + json.dumps(value)])
    environment = os.environ.copy()
    for key in list(environment):
        if key.startswith(("OPENAI_", "OTEL_")):
            environment.pop(key)
    environment["DO_NOT_TRACK"] = "1"
    executable = RUNTIME_ROOT / "node_modules/@openai/codex/bin/codex.js"
    os.execve("/usr/local/bin/node", ["node", str(executable), *overrides, *arguments], environment)


def main():
    command, *arguments = sys.argv[1:]
    if command == "import":
        import_credentials()
    elif command == "claude-credentials":
        print(json.dumps(required_record("claude")["credentials"]))
    elif command == "codex-token":
        print(required_record("codex")["accessToken"], end="")
    elif command == "claude-run":
        run_claude(arguments)
    elif command == "codex-run":
        run_codex(arguments)
    else:
        raise ValueError("Unknown runtime authentication command")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError):
        print("Runtime credentials are missing, invalid or expired; rerun configure-runtimes.ps1", file=sys.stderr)
        sys.exit(1)
