//! Shared HTTP and stream host templates.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::model::{self, HostTemplate, HostTemplateInput, HostTemplateKind};
use crate::repo;
use crate::state::AppState;

fn parse_kind(raw: &str) -> ApiResult<HostTemplateKind> {
    match raw {
        "http" => Ok(HostTemplateKind::Http),
        "stream" => Ok(HostTemplateKind::Stream),
        _ => Err(ApiError::bad_request(
            "invalid_host_template_kind",
            "template kind must be 'http' or 'stream'",
        )),
    }
}

fn conflict(message: impl Into<String>) -> ApiError {
    ApiError::new(
        axum::http::StatusCode::CONFLICT,
        "host_template_conflict",
        message,
    )
}

async fn ensure_unique(
    state: &AppState,
    kind: HostTemplateKind,
    input: &HostTemplateInput,
    exclude: Option<i64>,
) -> ApiResult<()> {
    if repo::list_host_templates(&state.db, kind)
        .await?
        .iter()
        .any(|template| {
            Some(template.id) != exclude && template.name.eq_ignore_ascii_case(&input.name)
        })
    {
        return Err(conflict(format!(
            "a {kind_name} template named '{}' already exists",
            input.name,
            kind_name = kind.as_str()
        )));
    }
    Ok(())
}

pub async fn list(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(raw_kind): Path<String>,
) -> ApiResult<Json<Vec<HostTemplate>>> {
    let kind = parse_kind(&raw_kind)?;
    Ok(Json(repo::list_host_templates(&state.db, kind).await?))
}

pub async fn create(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(raw_kind): Path<String>,
    Json(raw): Json<HostTemplateInput>,
) -> ApiResult<Json<HostTemplate>> {
    let kind = parse_kind(&raw_kind)?;
    let input = model::validate_host_template_input(raw)?;
    ensure_unique(&state, kind, &input, None).await?;
    let id = repo::insert_host_template(&state.db, kind, &input).await?;
    let template = repo::get_host_template(&state.db, id)
        .await?
        .expect("inserted host template");
    Ok(Json(template))
}

pub async fn update(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path((raw_kind, id)): Path<(String, i64)>,
    Json(raw): Json<HostTemplateInput>,
) -> ApiResult<Json<HostTemplate>> {
    let kind = parse_kind(&raw_kind)?;
    if repo::get_host_template(&state.db, id)
        .await?
        .map_or(true, |template| template.kind != kind)
    {
        return Err(ApiError::not_found(format!(
            "no {raw_kind} host template #{id}"
        )));
    }
    let input = model::validate_host_template_input(raw)?;
    ensure_unique(&state, kind, &input, Some(id)).await?;
    repo::update_host_template(&state.db, kind, id, &input).await?;
    let template = repo::get_host_template(&state.db, id)
        .await?
        .expect("updated host template");
    Ok(Json(template))
}

pub async fn delete(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path((raw_kind, id)): Path<(String, i64)>,
) -> ApiResult<Json<serde_json::Value>> {
    let kind = parse_kind(&raw_kind)?;
    if !repo::delete_host_template(&state.db, kind, id).await? {
        return Err(ApiError::not_found(format!(
            "no {raw_kind} host template #{id}"
        )));
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}
