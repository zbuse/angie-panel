//! Global upstream pools shared by proxy hosts.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::model::{self, UpstreamPool, UpstreamPoolInput, UpstreamPolicy};
use crate::repo;
use crate::state::AppState;

fn policy(state: &AppState) -> UpstreamPolicy {
    UpstreamPolicy {
        allow_loopback: state.cfg.allow_loopback_upstreams,
    }
}

fn pool_conflict(message: impl Into<String>) -> ApiError {
    ApiError::new(
        axum::http::StatusCode::CONFLICT,
        "upstream_pool_conflict",
        message,
    )
}

async fn validate_name_unique(
    state: &AppState,
    input: &UpstreamPoolInput,
    exclude: Option<i64>,
) -> ApiResult<()> {
    if repo::list_upstream_pools(&state.db)
        .await?
        .iter()
        .any(|pool| Some(pool.id) != exclude && pool.name.eq_ignore_ascii_case(&input.name))
    {
        return Err(pool_conflict(format!(
            "an upstream pool named '{}' already exists",
            input.name
        )));
    }
    Ok(())
}

pub async fn list(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<Value>> {
    let pools = repo::list_upstream_pools(&state.db).await?;
    Ok(Json(json!({ "upstream_pools": pools })))
}

pub async fn create(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(raw): Json<UpstreamPoolInput>,
) -> ApiResult<Json<UpstreamPool>> {
    let input = model::validate_upstream_pool_input(raw, &policy(&state))?;
    validate_name_unique(&state, &input, None).await?;
    let id = repo::insert_upstream_pool(&state.db, &input).await?;
    let pool = repo::get_upstream_pool(&state.db, id).await?.expect("inserted pool");
    Ok(Json(pool))
}

pub async fn update(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(raw): Json<UpstreamPoolInput>,
) -> ApiResult<Json<UpstreamPool>> {
    if repo::get_upstream_pool(&state.db, id).await?.is_none() {
        return Err(ApiError::not_found(format!("no upstream pool #{id}")));
    }
    let input = model::validate_upstream_pool_input(raw, &policy(&state))?;
    validate_name_unique(&state, &input, Some(id)).await?;
    if !repo::update_upstream_pool(&state.db, id, &input).await? {
        return Err(ApiError::not_found(format!("no upstream pool #{id}")));
    }
    let pool = repo::get_upstream_pool(&state.db, id).await?.expect("updated pool");
    Ok(Json(pool))
}

pub async fn delete(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<Json<serde_json::Value>> {
    if repo::get_upstream_pool(&state.db, id).await?.is_none() {
        return Err(ApiError::not_found(format!("no upstream pool #{id}")));
    }
    let references = repo::upstream_pool_host_count(&state.db, id).await?;
    if references != 0 {
        return Err(pool_conflict(format!(
            "upstream pool #{id} is used by {references} proxy host(s)"
        )));
    }
    repo::delete_upstream_pool(&state.db, id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
