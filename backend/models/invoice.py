"""
Invoice and Company Settings Models
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    amount: float = 0.0  # Calculated: quantity * unit_price
    
    def calculate_amount(self):
        self.amount = self.quantity * self.unit_price
        return self.amount


class InvoiceCreate(BaseModel):
    tenant_id: str
    items: List[InvoiceItem]
    due_date: str  # ISO format date
    notes: Optional[str] = None
    tax_rate: float = 0.0  # Percentage


class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str  # e.g., INV-2026-0001
    tenant_id: str
    tenant_name: Optional[str] = None
    items: List[InvoiceItem]
    subtotal: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    total: float = 0.0
    status: InvoiceStatus = InvoiceStatus.DRAFT
    issue_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    due_date: str
    paid_date: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def calculate_totals(self):
        self.subtotal = sum(item.quantity * item.unit_price for item in self.items)
        self.tax_amount = self.subtotal * (self.tax_rate / 100)
        self.total = self.subtotal + self.tax_amount
        return self


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    paid_date: Optional[str] = None
    notes: Optional[str] = None


class CompanySettings(BaseModel):
    id: str = "company_settings"  # Singleton
    company_name: str = "Quick Wing Fleet Management"
    tagline: Optional[str] = "Multi-Tenant Fleet Management Platform"
    logo_url: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "Ireland"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None  # VAT number etc.
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_bic: Optional[str] = None
    invoice_prefix: str = "INV"
    invoice_footer: Optional[str] = "Thank you for your business!"
    currency: str = "EUR"
    currency_symbol: str = "€"
    default_tax_rate: float = 23.0  # Irish VAT
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_bic: Optional[str] = None
    invoice_prefix: Optional[str] = None
    invoice_footer: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    default_tax_rate: Optional[float] = None
