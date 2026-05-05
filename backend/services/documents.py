"""
Custom Documents service.

Each tenant can define their own document templates (e.g. Fuel Log,
Pre-trip vehicle check, Mileage log) and staff submit them from their
dashboard.

Field types supported:
    - text         single line
    - textarea     multi-line
    - number       numeric
    - date         YYYY-MM-DD string
    - time         HH:MM string
    - select       dropdown with predefined options
    - checkbox     boolean
    - vehicle      tenant-scoped vehicle dropdown (resolved on the FE)
    - image        base64 data-URL string (image/jpeg, image/png)

A submission stores:
    {
      template_id, template_name,
      vehicle_id, vehicle_registration   (when template has a vehicle field),
      data {field_key: value},
      photos [base64 strings]            (collected from image fields),
      submitted_by_user_id, submitted_by_name,
      created_at, updated_at, status
    }

The service is intentionally read-light — it does basic validation,
delegates persistence to the caller, and never serialises Mongo `_id`.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


SUPPORTED_FIELD_TYPES = {
    "text",
    "textarea",
    "number",
    "date",
    "time",
    "select",
    "checkbox",
    "vehicle",
    "image",
}


class TemplateField(BaseModel):
    """A single field definition on a document template."""
    model_config = ConfigDict(extra="ignore")

    key: str = Field(..., description="Slug-style key — letters, digits, underscores.")
    label: str
    type: str
    required: bool = False
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    options: List[str] = Field(default_factory=list)  # only for type=select


class TemplateCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "FileText"          # lucide-react icon name
    fields: List[TemplateField] = Field(default_factory=list)
    is_active: bool = True


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    fields: Optional[List[TemplateField]] = None
    is_active: Optional[bool] = None


class SubmissionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    template_id: str
    data: Dict[str, Any] = Field(default_factory=dict)


class SubmissionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


# ===== Validation helpers =====

KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,40}$")


def slugify_name(name: str) -> str:
    """Generate a URL-friendly slug for a template name."""
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or f"document-{uuid.uuid4().hex[:6]}"


def validate_fields(fields: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalise + validate a list of field dicts. Raises ValueError."""
    cleaned: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()

    for idx, raw in enumerate(fields or []):
        if not isinstance(raw, dict):
            raise ValueError(f"Field #{idx + 1} is not an object")

        key = (raw.get("key") or "").strip().lower()
        label = (raw.get("label") or "").strip()
        ftype = (raw.get("type") or "").strip().lower()

        if not label:
            raise ValueError(f"Field #{idx + 1} is missing a label")
        if ftype not in SUPPORTED_FIELD_TYPES:
            raise ValueError(
                f"Field '{label}' has unsupported type '{ftype}' "
                f"(allowed: {', '.join(sorted(SUPPORTED_FIELD_TYPES))})"
            )

        if not key:
            key = slugify_name(label).replace("-", "_")[:40] or f"field_{idx + 1}"
        if not KEY_RE.match(key):
            raise ValueError(
                f"Field '{label}' has an invalid key '{key}'. "
                "Keys must start with a letter and contain only letters, digits, and underscores."
            )
        if key in seen_keys:
            raise ValueError(f"Duplicate field key '{key}'")
        seen_keys.add(key)

        options = raw.get("options") or []
        if ftype == "select":
            options = [str(o).strip() for o in options if str(o).strip()]
            if not options:
                raise ValueError(f"Field '{label}' is a dropdown but has no options")

        cleaned.append({
            "key": key,
            "label": label,
            "type": ftype,
            "required": bool(raw.get("required")),
            "placeholder": (raw.get("placeholder") or "") or None,
            "help_text": (raw.get("help_text") or "") or None,
            "options": options if ftype == "select" else [],
        })

    return cleaned


def build_template_doc(
    *,
    tenant_id: str,
    payload: TemplateCreate,
    is_builtin: bool = False,
) -> Dict[str, Any]:
    """Construct a new template document ready to insert into Mongo."""
    fields = validate_fields([f.model_dump() if isinstance(f, TemplateField) else f for f in payload.fields])
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "name": payload.name.strip(),
        "slug": slugify_name(payload.name),
        "description": (payload.description or "").strip(),
        "icon": payload.icon or "FileText",
        "fields": fields,
        "is_active": bool(payload.is_active),
        "is_builtin": is_builtin,
        "created_at": now,
        "updated_at": now,
    }


def merge_template_update(existing: Dict[str, Any], patch: TemplateUpdate) -> Dict[str, Any]:
    """Apply a TemplateUpdate to an existing template doc and return the result."""
    out = {**existing}
    data = patch.model_dump(exclude_unset=True)
    if "fields" in data:
        out["fields"] = validate_fields(
            [f.model_dump() if isinstance(f, TemplateField) else f for f in (data["fields"] or [])]
        )
    if "name" in data and data["name"] is not None:
        out["name"] = str(data["name"]).strip()
        out["slug"] = slugify_name(out["name"])
    for field in ("description", "icon"):
        if field in data and data[field] is not None:
            out[field] = str(data[field]).strip()
    if "is_active" in data and data["is_active"] is not None:
        out["is_active"] = bool(data["is_active"])
    out["updated_at"] = datetime.now(timezone.utc).isoformat()
    return out


def build_submission_doc(
    *,
    tenant_id: str,
    template: Dict[str, Any],
    payload: SubmissionCreate,
    submitted_by_user_id: str,
    submitted_by_name: Optional[str],
    submitted_by_email: Optional[str],
) -> Dict[str, Any]:
    """Validate and construct a submission document."""
    fields_by_key = {f["key"]: f for f in template.get("fields", [])}
    cleaned_data: Dict[str, Any] = {}
    photos: List[str] = []
    vehicle_id: Optional[str] = None
    vehicle_reg: Optional[str] = None

    for key, value in (payload.data or {}).items():
        if key not in fields_by_key:
            continue  # ignore unknown fields silently
        field = fields_by_key[key]
        ftype = field["type"]

        if ftype == "checkbox":
            cleaned_data[key] = bool(value)
        elif ftype == "number":
            if value in (None, ""):
                cleaned_data[key] = None
            else:
                try:
                    cleaned_data[key] = float(value)
                except (TypeError, ValueError):
                    raise ValueError(f"'{field['label']}' must be a number")
        elif ftype == "image":
            # Expect a base64 data URL or string. Single value or list.
            values = value if isinstance(value, list) else ([value] if value else [])
            cleaned_imgs: List[str] = []
            for v in values:
                if not v:
                    continue
                if not isinstance(v, str):
                    raise ValueError(f"'{field['label']}' must be a base64 image string")
                cleaned_imgs.append(v)
                photos.append(v)
            cleaned_data[key] = cleaned_imgs
        elif ftype == "vehicle":
            if isinstance(value, dict):
                vehicle_id = value.get("id") or value.get("vehicle_id")
                vehicle_reg = value.get("registration") or value.get("label")
                cleaned_data[key] = {
                    "id": vehicle_id,
                    "registration": vehicle_reg,
                }
            else:
                cleaned_data[key] = value
                if isinstance(value, str):
                    vehicle_id = value
        else:
            cleaned_data[key] = "" if value is None else str(value)

    # Required-field check
    for f in template.get("fields", []):
        if not f.get("required"):
            continue
        v = cleaned_data.get(f["key"])
        is_empty = (
            v is None
            or v == ""
            or (isinstance(v, list) and len(v) == 0)
            or (isinstance(v, dict) and not v.get("id") and not v.get("registration"))
        )
        if is_empty:
            raise ValueError(f"'{f['label']}' is required")

    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "template_id": template["id"],
        "template_name": template.get("name"),
        "template_slug": template.get("slug"),
        "vehicle_id": vehicle_id,
        "vehicle_registration": vehicle_reg,
        "data": cleaned_data,
        "photos": photos,
        "status": "submitted",
        "submitted_by_user_id": submitted_by_user_id,
        "submitted_by_name": submitted_by_name or submitted_by_email,
        "submitted_by_email": submitted_by_email,
        "created_at": now,
        "updated_at": now,
    }


# ===== Built-in templates =====

DEFAULT_FUEL_LOG_TEMPLATE = TemplateCreate(
    name="Fuel Log",
    description="Track fuel purchases per vehicle. Staff log each fill-up; admins see total spend and litres per car.",
    icon="Fuel",
    fields=[
        TemplateField(key="vehicle", label="Vehicle", type="vehicle", required=True),
        TemplateField(key="fuel_date", label="Date", type="date", required=True),
        TemplateField(key="odometer_km", label="Odometer (km)", type="number", required=True, placeholder="e.g. 84210"),
        TemplateField(key="litres", label="Litres", type="number", required=True, placeholder="e.g. 42.50"),
        TemplateField(
            key="fuel_type",
            label="Fuel type",
            type="select",
            required=False,
            options=["Diesel", "Petrol", "Electric (kWh)", "Hybrid"],
        ),
        TemplateField(key="cost_eur", label="Total cost (€)", type="number", required=True, placeholder="e.g. 65.00"),
        TemplateField(key="station", label="Fuel station", type="text", required=False, placeholder="e.g. Circle K Naas"),
        TemplateField(key="receipt", label="Receipt photo", type="image", required=False, help_text="JPG or PNG"),
        TemplateField(key="notes", label="Notes", type="textarea", required=False),
    ],
    is_active=True,
)


BUILTIN_TEMPLATES = [DEFAULT_FUEL_LOG_TEMPLATE]
