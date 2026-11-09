//! Per-user HTTP and stream host templates.

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
    user_id: i64,
    kind: HostTemplateKind,
    input: &HostTemplateInput,
    exclude: Option<i64>,
) -> ApiResult<()> {
    if repo::list_host_templates(&state.db, user_id, kind)
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
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(raw_kind): Path<String>,
) -> ApiResult<Json<Vec<HostTemplate>>> {
    let kind = parse_kind(&raw_kind)?;
    let user_id = user.require_user_id()?;
    Ok(Json(
        repo::list_host_templates(&state.db, user_id, kind).await?,
    ))
}

pub async fn create(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(raw_kind): Path<String>,
    Json(raw): Json<HostTemplateInput>,
) -> ApiResult<Json<HostTemplate>> {
    let kind = parse_kind(&raw_kind)?;
    let user_id = user.require_user_id()?;
    let input = model::validate_host_template_input(raw)?;
    ensure_unique(&state, user_id, kind, &input, None).await?;
    let id = repo::insert_host_template(&state.db, user_id, kind, &input).await?;
    let template = repo::get_host_template(&state.db, user_id, id)
        .await?
        .expect("inserted host template");
    Ok(Json(template))
}

pub async fn update(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path((raw_kind, id)): Path<(String, i64)>,
    Json(raw): Json<HostTemplateInput>,
) -> ApiResult<Json<HostTemplate>> {
    let kind = parse_kind(&raw_kind)?;
    let user_id = user.require_user_id()?;
    if repo::get_host_template(&state.db, user_id, id)
        .await?
        .is_none_or(|template| template.kind != kind)
    {
        return Err(ApiError::not_found(format!(
            "no {raw_kind} host template #{id}"
        )));
    }
    let input = model::validate_host_template_input(raw)?;
    ensure_unique(&state, user_id, kind, &input, Some(id)).await?;
    repo::update_host_template(&state.db, user_id, kind, id, &input).await?;
    let template = repo::get_host_template(&state.db, user_id, id)
        .await?
        .expect("updated host template");
    Ok(Json(template))
}

pub async fn delete(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path((raw_kind, id)): Path<(String, i64)>,
) -> ApiResult<Json<serde_json::Value>> {
    let kind = parse_kind(&raw_kind)?;
    let user_id = user.require_user_id()?;
    if !repo::delete_host_template(&state.db, user_id, kind, id).await? {
        return Err(ApiError::not_found(format!(
            "no {raw_kind} host template #{id}"
        )));
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}
