"""
Test PDF Export Feature and Invoice CRUD Operations
Tests for Quick Wing Fleet Management Platform
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"
TEST_TENANT_ID = "b47ffc37-e0bf-4fe7-a793-6250b88378de"
TEST_INVOICE_ID = "a7f7b180-0d39-4ad6-bf99-ce7c94aa17ed"


class TestPDFExportFeature:
    """Test PDF Export endpoints for reports and invoices"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ==================== Executive Summary PDF ====================
    
    def test_executive_summary_pdf_endpoint_returns_pdf(self):
        """Test GET /api/platform/reports/executive-summary/pdf returns valid PDF"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/executive-summary/pdf")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Content-Type assertion
        assert "application/pdf" in response.headers.get("Content-Type", ""), \
            f"Expected application/pdf, got {response.headers.get('Content-Type')}"
        
        # PDF magic bytes assertion - PDF files start with %PDF
        assert response.content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        # Content-Disposition header should suggest download
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, f"Expected attachment disposition, got {content_disp}"
        assert "executive_summary" in content_disp, f"Filename should contain 'executive_summary'"
    
    def test_executive_summary_pdf_has_reasonable_size(self):
        """Test that executive summary PDF has reasonable file size"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/executive-summary/pdf")
        
        assert response.status_code == 200
        # PDF should be at least 1KB and less than 10MB
        assert len(response.content) > 1000, "PDF too small, might be empty"
        assert len(response.content) < 10 * 1024 * 1024, "PDF too large"
    
    # ==================== Franchises Report PDF ====================
    
    def test_franchises_report_pdf_endpoint_returns_pdf(self):
        """Test GET /api/platform/reports/franchises/pdf returns valid PDF"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/franchises/pdf")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "application/pdf" in response.headers.get("Content-Type", "")
        assert response.content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert "franchises_report" in content_disp
    
    def test_franchises_report_pdf_with_status_filter(self):
        """Test franchises PDF with status filter"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/franchises/pdf?status=active")
        
        assert response.status_code == 200
        assert response.content[:4] == b'%PDF'
    
    def test_franchises_report_pdf_with_plan_filter(self):
        """Test franchises PDF with plan filter"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/franchises/pdf?plan=starter")
        
        assert response.status_code == 200
        assert response.content[:4] == b'%PDF'
    
    # ==================== Invoices Report PDF ====================
    
    def test_invoices_report_pdf_endpoint_returns_pdf(self):
        """Test GET /api/platform/reports/invoices/pdf returns valid PDF"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/invoices/pdf")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "application/pdf" in response.headers.get("Content-Type", "")
        assert response.content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert "invoices_report" in content_disp
    
    def test_invoices_report_pdf_with_status_filter(self):
        """Test invoices PDF with status filter"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/invoices/pdf?status=draft")
        
        assert response.status_code == 200
        assert response.content[:4] == b'%PDF'
    
    # ==================== Single Invoice PDF ====================
    
    def test_single_invoice_pdf_endpoint_returns_pdf(self):
        """Test GET /api/platform/invoices/{invoice_id}/pdf returns valid PDF"""
        # First get list of invoices to find a valid ID
        list_response = self.session.get(f"{BASE_URL}/api/platform/invoices")
        assert list_response.status_code == 200
        
        invoices = list_response.json().get("invoices", [])
        if not invoices:
            pytest.skip("No invoices available for testing")
        
        invoice_id = invoices[0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/platform/invoices/{invoice_id}/pdf")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "application/pdf" in response.headers.get("Content-Type", "")
        assert response.content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        content_disp = response.headers.get("Content-Disposition", "")
        assert "invoice" in content_disp.lower()
    
    def test_single_invoice_pdf_with_provided_id(self):
        """Test single invoice PDF with the provided test invoice ID"""
        response = self.session.get(f"{BASE_URL}/api/platform/invoices/{TEST_INVOICE_ID}/pdf")
        
        # If invoice exists, should return PDF
        if response.status_code == 200:
            assert "application/pdf" in response.headers.get("Content-Type", "")
            assert response.content[:4] == b'%PDF'
        elif response.status_code == 404:
            # Invoice might not exist, which is acceptable
            pass
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_single_invoice_pdf_not_found(self):
        """Test single invoice PDF returns 404 for non-existent invoice"""
        response = self.session.get(f"{BASE_URL}/api/platform/invoices/non-existent-id/pdf")
        
        assert response.status_code == 404


class TestInvoiceCRUD:
    """Test Invoice CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ==================== List Invoices ====================
    
    def test_list_invoices_endpoint(self):
        """Test GET /api/platform/invoices returns invoice list"""
        response = self.session.get(f"{BASE_URL}/api/platform/invoices")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "invoices" in data, "Response should contain 'invoices' key"
        assert "total" in data, "Response should contain 'total' key"
        assert "summary" in data, "Response should contain 'summary' key"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_amount" in summary
        assert "paid_amount" in summary
        assert "pending_amount" in summary
    
    def test_list_invoices_with_tenant_filter(self):
        """Test list invoices with tenant_id filter"""
        response = self.session.get(f"{BASE_URL}/api/platform/invoices?tenant_id={TEST_TENANT_ID}")
        
        assert response.status_code == 200
        data = response.json()
        assert "invoices" in data
    
    def test_list_invoices_with_status_filter(self):
        """Test list invoices with status filter"""
        response = self.session.get(f"{BASE_URL}/api/platform/invoices?status=draft")
        
        assert response.status_code == 200
        data = response.json()
        assert "invoices" in data
        
        # All returned invoices should have draft status
        for invoice in data["invoices"]:
            assert invoice["status"] == "draft"
    
    # ==================== Create Invoice ====================
    
    def test_create_invoice_success(self):
        """Test POST /api/platform/invoices creates new invoice"""
        # First get a valid tenant ID
        tenants_response = self.session.get(f"{BASE_URL}/api/platform/tenants")
        assert tenants_response.status_code == 200
        tenants = tenants_response.json().get("tenants", [])
        
        if not tenants:
            pytest.skip("No tenants available for testing")
        
        tenant_id = tenants[0]["id"]
        
        # Create invoice
        due_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        invoice_data = {
            "tenant_id": tenant_id,
            "items": [
                {"description": "TEST_Monthly Subscription", "quantity": 1, "unit_price": 99.99},
                {"description": "TEST_Additional Service", "quantity": 2, "unit_price": 25.00}
            ],
            "due_date": due_date,
            "tax_rate": 23.0,
            "notes": "Test invoice created by automated tests"
        }
        
        response = self.session.post(f"{BASE_URL}/api/platform/invoices", json=invoice_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "invoice" in data
        
        invoice = data["invoice"]
        assert "id" in invoice
        assert "invoice_number" in invoice
        assert invoice["tenant_id"] == tenant_id
        assert invoice["status"] == "draft"
        
        # Verify totals are calculated
        assert "subtotal" in invoice
        assert "tax_amount" in invoice
        assert "total" in invoice
        
        # Verify calculations
        expected_subtotal = 99.99 + (2 * 25.00)  # 149.99
        assert abs(invoice["subtotal"] - expected_subtotal) < 0.01
        
        # Store invoice ID for cleanup
        self.created_invoice_id = invoice["id"]
    
    def test_create_invoice_missing_tenant(self):
        """Test create invoice fails with non-existent tenant"""
        invoice_data = {
            "tenant_id": "non-existent-tenant-id",
            "items": [{"description": "Test", "quantity": 1, "unit_price": 100}],
            "due_date": "2026-02-01"
        }
        
        response = self.session.post(f"{BASE_URL}/api/platform/invoices", json=invoice_data)
        
        assert response.status_code == 404
    
    # ==================== Update Invoice Status ====================
    
    def test_update_invoice_status(self):
        """Test PUT /api/platform/invoices/{id} updates invoice status"""
        # First get an existing invoice
        list_response = self.session.get(f"{BASE_URL}/api/platform/invoices")
        assert list_response.status_code == 200
        
        invoices = list_response.json().get("invoices", [])
        draft_invoices = [inv for inv in invoices if inv["status"] == "draft"]
        
        if not draft_invoices:
            pytest.skip("No draft invoices available for testing")
        
        invoice_id = draft_invoices[0]["id"]
        
        # Update status to 'sent'
        response = self.session.put(f"{BASE_URL}/api/platform/invoices/{invoice_id}", json={
            "status": "sent"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "invoice" in data
        assert data["invoice"]["status"] == "sent"
    
    def test_update_invoice_to_paid(self):
        """Test marking invoice as paid sets paid_date"""
        # Get a sent invoice
        list_response = self.session.get(f"{BASE_URL}/api/platform/invoices?status=sent")
        invoices = list_response.json().get("invoices", [])
        
        if not invoices:
            pytest.skip("No sent invoices available for testing")
        
        invoice_id = invoices[0]["id"]
        
        response = self.session.put(f"{BASE_URL}/api/platform/invoices/{invoice_id}", json={
            "status": "paid"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["invoice"]["status"] == "paid"
        assert data["invoice"].get("paid_date") is not None
    
    def test_update_invoice_not_found(self):
        """Test update invoice returns 404 for non-existent invoice"""
        response = self.session.put(f"{BASE_URL}/api/platform/invoices/non-existent-id", json={
            "status": "sent"
        })
        
        assert response.status_code == 404


class TestReportsEndpoints:
    """Test Reports JSON endpoints (non-PDF)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_executive_summary_json(self):
        """Test GET /api/platform/reports/executive-summary returns JSON data"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/executive-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "summary" in data
        assert "recent_tenants" in data
        assert "generated_at" in data
        
        summary = data["summary"]
        assert "tenants" in summary
        assert "users" in summary
        assert "vehicles" in summary
        assert "bookings" in summary
        assert "revenue" in summary
        assert "plan_distribution" in summary
    
    def test_franchises_report_json(self):
        """Test GET /api/platform/reports/franchises returns JSON data"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/franchises")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "franchises" in data
        assert "total" in data
        assert "generated_at" in data
        
        # Verify franchise data structure if any exist
        if data["franchises"]:
            franchise = data["franchises"][0]
            assert "id" in franchise
            assert "name" in franchise
            assert "stats" in franchise
    
    def test_invoices_report_json(self):
        """Test GET /api/platform/reports/invoices returns JSON data"""
        response = self.session.get(f"{BASE_URL}/api/platform/reports/invoices")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "invoices" in data
        assert "total_count" in data
        assert "grand_total" in data
        assert "by_status" in data
        assert "generated_at" in data


class TestUnauthorizedAccess:
    """Test that PDF endpoints require authentication"""
    
    def test_executive_summary_pdf_requires_auth(self):
        """Test executive summary PDF requires authentication"""
        response = requests.get(f"{BASE_URL}/api/platform/reports/executive-summary/pdf")
        assert response.status_code in [401, 403]
    
    def test_franchises_pdf_requires_auth(self):
        """Test franchises PDF requires authentication"""
        response = requests.get(f"{BASE_URL}/api/platform/reports/franchises/pdf")
        assert response.status_code in [401, 403]
    
    def test_invoices_pdf_requires_auth(self):
        """Test invoices PDF requires authentication"""
        response = requests.get(f"{BASE_URL}/api/platform/reports/invoices/pdf")
        assert response.status_code in [401, 403]
    
    def test_single_invoice_pdf_requires_auth(self):
        """Test single invoice PDF requires authentication"""
        response = requests.get(f"{BASE_URL}/api/platform/invoices/some-id/pdf")
        assert response.status_code in [401, 403]
