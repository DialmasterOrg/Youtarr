#!/bin/bash

# Shared helpers for managing Youtarr's .env file and Docker Compose project state.
# Pure functions only; safe to source from any script without triggering side effects.

# Read a key from an env file without sourcing it. This intentionally supports
# the simple KEY=value format used by Youtarr's .env files.
youtarr_get_env_file_value() {
  local env_file="$1"
  local key="$2"
  local default="${3:-}"
  local value=""

  if [[ -f "$env_file" ]]; then
    value=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$env_file" 2>/dev/null \
      | tail -n 1 \
      | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//" \
      | sed -E 's/[[:space:]]+#.*$//' \
      | sed -E 's/[[:space:]]+$//' \
      | sed -E 's/^"(.*)"$/\1/' \
      | sed -E "s/^'(.*)'$/\1/" || true)
  fi

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default"
  fi
}

# Compute the Docker Compose project name for a checkout. Mirrors Compose's own
# normalization (lowercase basename of the project dir, with anything outside
# [a-z0-9_-] stripped). Honors COMPOSE_PROJECT_NAME (env, then .env) when set.
youtarr_get_compose_project_name() {
  local project_dir="$1"
  local project_name="${COMPOSE_PROJECT_NAME:-}"

  if [[ -z "$project_name" ]] && [[ -f "$project_dir/.env" ]]; then
    project_name=$(youtarr_get_env_file_value "$project_dir/.env" "COMPOSE_PROJECT_NAME" "")
  fi

  if [[ -z "$project_name" ]]; then
    project_name=$(basename "$project_dir" | tr '[:upper:]' '[:lower:]' | tr -dc 'a-z0-9_-')
  fi

  printf '%s' "$project_name"
}

# Compute the expected MariaDB named-volume name for a checkout.
youtarr_expected_db_volume_name() {
  local project_dir="$1"
  printf '%s_youtarr-db-data' "$(youtarr_get_compose_project_name "$project_dir")"
}

# Returns 0 if THIS install's named MariaDB volume exists, 1 otherwise.
# Scoped to the current Compose project; does not match volumes from other
# Youtarr checkouts on the same host.
youtarr_named_volume_exists() {
  local project_dir="$1"
  local volume_name
  volume_name=$(youtarr_expected_db_volume_name "$project_dir")
  docker volume inspect "$volume_name" >/dev/null 2>&1
}

youtarr_database_dir_has_content() {
  local project_dir="$1"
  [[ -f "$project_dir/database/ibdata1" || -d "$project_dir/database/mysql" ]]
}

youtarr_is_arm_host() {
  local arch
  arch=$(uname -m)
  [[ "$arch" == "arm64" || "$arch" == "aarch64" ]]
}

youtarr_effective_compose_file_value() {
  local project_dir="$1"
  if [[ -n "${COMPOSE_FILE:-}" ]]; then
    printf '%s' "$COMPOSE_FILE"
  else
    youtarr_get_env_file_value "$project_dir/.env" "COMPOSE_FILE" ""
  fi
}

youtarr_compose_file_has_named_volume_override() {
  local project_dir="$1"
  local value
  value=$(youtarr_effective_compose_file_value "$project_dir")
  [[ "$value" == *"docker-compose.arm.yml"* ]]
}

# Returns one of: named-volume, bind-mount, ambiguous.
# Fresh bundled-DB installs default to named-volume storage.
youtarr_detect_bundled_db_storage_mode() {
  local project_dir="$1"
  local force_named="${2:-}"
  local bind_has_content=false
  local named_exists=false

  if youtarr_database_dir_has_content "$project_dir"; then
    bind_has_content=true
  fi

  if youtarr_named_volume_exists "$project_dir"; then
    named_exists=true
  fi

  if [[ "$bind_has_content" == "true" && "$named_exists" == "true" ]]; then
    printf '%s' "ambiguous"
  elif [[ "$force_named" == "--force-named" ]]; then
    printf '%s' "named-volume"
  elif youtarr_compose_file_has_named_volume_override "$project_dir"; then
    printf '%s' "named-volume"
  elif [[ "$named_exists" == "true" ]]; then
    printf '%s' "named-volume"
  elif [[ "$bind_has_content" == "true" ]]; then
    printf '%s' "bind-mount"
  elif youtarr_is_arm_host; then
    printf '%s' "named-volume"
  else
    printf '%s' "named-volume"
  fi
}

youtarr_compose_args_for_storage_mode() {
  local project_dir="$1"
  local storage_mode="$2"

  case "$storage_mode" in
    named-volume)
      if youtarr_compose_file_has_named_volume_override "$project_dir"; then
        # Let Compose honor the user's full COMPOSE_FILE list from the shell/.env.
        printf ''
      elif [[ -n "$(youtarr_effective_compose_file_value "$project_dir")" ]]; then
        local compose_file_value
        local compose_args=""
        local compose_file
        local -a compose_files
        compose_file_value=$(youtarr_effective_compose_file_value "$project_dir")
        IFS=':' read -r -a compose_files <<< "$compose_file_value"
        for compose_file in "${compose_files[@]}"; do
          [[ -z "$compose_file" ]] && continue
          compose_args="$compose_args -f $compose_file"
        done
        printf '%s' "${compose_args# } -f $project_dir/docker-compose.arm.yml"
      else
        printf '%s' "-f $project_dir/docker-compose.yml -f $project_dir/docker-compose.arm.yml"
      fi
      ;;
    bind-mount)
      printf '%s' "-f $project_dir/docker-compose.yml"
      ;;
    *)
      return 1
      ;;
  esac
}

# Pin the named-volume Compose override in .env so plain `docker compose up -d`
# (without -f flags) picks up docker-compose.arm.yml automatically.
#
# Safe by default: preserves an existing COMPOSE_FILE setting and appends the
# named-volume override if missing.
# Pass --force to strip and replace any existing COMPOSE_FILE / COMPOSE_PATH_SEPARATOR.
# Pass --use-sudo to run the final `mv` under `sudo -n` (for installs where the
# project directory is not directly writable by the current user). The flag may
# be passed in either positional slot.
#
# Return codes:
#   0 - pinned successfully
#   1 - error (env file missing, mktemp failed, or final mv failed; under
#       --use-sudo this includes `sudo -n` being unavailable). The temp file
#       is cleaned up on mv failure on both the sudo and non-sudo paths.
#   2 - skipped because COMPOSE_FILE already includes docker-compose.arm.yml
youtarr_pin_named_volume_in_env() {
  local env_file="$1"
  shift || true

  local force=""
  local use_sudo=""
  local arg
  for arg in "$@"; do
    case "$arg" in
      --force) force="--force" ;;
      --use-sudo) use_sudo="--use-sudo" ;;
    esac
  done

  if [[ ! -f "$env_file" ]]; then
    return 1
  fi

  local existing
  existing=$(grep -E '^[[:space:]]*COMPOSE_FILE[[:space:]]*=' "$env_file" 2>/dev/null | tail -n 1 || true)

  local existing_value=""
  if [[ -n "$existing" ]]; then
    existing_value=$(printf '%s' "$existing" \
      | sed -E 's/^[[:space:]]*COMPOSE_FILE[[:space:]]*=[[:space:]]*//' \
      | sed -E 's/[[:space:]]+#.*$//' \
      | sed -E 's/[[:space:]]+$//' \
      | sed -E 's/^"(.*)"$/\1/' \
      | sed -E "s/^'(.*)'$/\1/")
  fi

  local existing_separator=":"
  local configured_separator
  configured_separator=$(youtarr_get_env_file_value "$env_file" "COMPOSE_PATH_SEPARATOR" "")
  if [[ "$configured_separator" == ";" ]]; then
    existing_separator=";"
  elif [[ "$existing_value" == *";"* && "$existing_value" != *":"* ]]; then
    existing_separator=";"
  fi

  local normalized_existing_value="$existing_value"
  if [[ -n "$normalized_existing_value" && "$existing_separator" == ";" ]]; then
    normalized_existing_value=${normalized_existing_value//;/:}
  fi

  local existing_has_named_volume_override=false
  if [[ -n "$normalized_existing_value" && "$normalized_existing_value" == *"docker-compose.arm.yml"* ]]; then
    existing_has_named_volume_override=true
  fi

  local needs_separator_normalization=false
  if [[ "$configured_separator" == ";" || "$normalized_existing_value" != "$existing_value" ]]; then
    needs_separator_normalization=true
  fi

  if [[ "$force" != "--force" && "$existing_has_named_volume_override" == "true" && "$needs_separator_normalization" != "true" ]]; then
    return 2
  fi

  local tmp_file
  tmp_file=$(mktemp) || return 1

  grep -vE '^[[:space:]]*COMPOSE_FILE[[:space:]]*=' "$env_file" \
    | grep -vE '^[[:space:]]*COMPOSE_PATH_SEPARATOR[[:space:]]*=' \
    > "$tmp_file" || true

  if [[ -s "$tmp_file" ]] && [[ -n "$(tail -c1 "$tmp_file")" ]]; then
    printf '\n' >> "$tmp_file"
  fi

  local compose_file_value="docker-compose.yml:docker-compose.arm.yml"
  if [[ "$force" != "--force" && "$existing_has_named_volume_override" == "true" ]]; then
    compose_file_value="$normalized_existing_value"
  elif [[ -n "$normalized_existing_value" && "$force" != "--force" ]]; then
    compose_file_value="${normalized_existing_value}:docker-compose.arm.yml"
  fi

  {
    printf '# Use named-volume database storage (managed by Youtarr)\n'
    printf 'COMPOSE_PATH_SEPARATOR=:\n'
    printf 'COMPOSE_FILE=%s\n' "$compose_file_value"
  } >> "$tmp_file"

  local mv_rc=0
  if [[ "$use_sudo" == "--use-sudo" ]]; then
    sudo -n mv "$tmp_file" "$env_file" || mv_rc=$?
  else
    mv "$tmp_file" "$env_file" || mv_rc=$?
  fi

  if [[ "$mv_rc" -ne 0 ]]; then
    rm -f "$tmp_file" 2>/dev/null || true
    return 1
  fi
}

# Returns 0 if the COMPOSE_FILE value in .env contains docker-compose.arm.yml,
# 1 otherwise (including when COMPOSE_FILE is unset). Used to detect whether
# plain `docker compose up -d` would include the named-volume override.
youtarr_env_has_named_volume_pin() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 1
  local value
  value=$(grep -E '^[[:space:]]*COMPOSE_FILE[[:space:]]*=' "$env_file" 2>/dev/null | tail -n 1 || true)
  [[ -n "$value" ]] || return 1
  [[ "$value" == *"docker-compose.arm.yml"* ]]
}
