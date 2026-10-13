from datetime import date
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class Mutation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    idempotency_key: str = Field(min_length=8, max_length=128)


class PlanRequest(Mutation):
    plan: Literal["standard", "essential", "professional"]
    effective_date: date
    reason: str = Field(default="", max_length=1000)
    acknowledged: bool


class PlanReview(Mutation):
    decision: Literal["quote", "reject"]
    notes: str = Field(min_length=1, max_length=1200)
    effective_date: Optional[date] = None
    vehicle_quantity: Optional[int] = Field(default=None, ge=1, le=100000)
    tax_treatment: Optional[Literal["inclusive", "exclusive"]] = None
    hardware_terms: str = Field(default="", max_length=1200)


class PlanConsent(Mutation):
    accepted: bool


class PlanApply(Mutation):
    confirmed: bool


class SubscriptionView(BaseModel):
    tenant_id: str
    tenant_name: str
    revision: int
    legacy: bool
    legacy_agreement: Dict[str, Any]
    active_agreement: Optional[Dict[str, Any]] = None
    capabilities: Optional[List[str]] = None
    grandfather_capabilities: List[str] = []
    requests: List[Dict[str, Any]] = []
    audit_events: List[Dict[str, Any]] = []
    vehicle_count: int = 0
    billing_unchanged: bool = True


class SubscriptionIndex(BaseModel):
    items: List[SubscriptionView]