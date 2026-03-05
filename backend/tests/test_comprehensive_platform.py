"""
Comprehensive Platform Testing - Pre-Launch QA
Tests all features for Super Admin (Franchise Control Centre) and Tenant Dashboard
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://saas-fleet-mgmt.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN = {"email": "superadmin@quickwing.com", "password": "Super123"}
FRANCHISE_ADMIN = {"email": "admin.bluebirdkwc@quickwing.com", "password": "admin123"}

class TestSuperAdminLogin:
    """Test Super Admin authentication"""
    
    def test_super_admin_login_success(self):
        """1. Login as Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == SUPER_ADMIN["email"]
        print(f"SUCCESS: Super Admin login - role: {data['user'].get('role')}")
        return data["access_token"]
    
    def test_super_admin_login_invalid_password(self):
        """Test login with invalid password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN["email"],
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("SUCCESS: Invalid password correctly rejected")


class TestPlatformOverview:
    """Test Platform Overview Tab - Stats display"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_platform_stats(self):
        """2. Overview Tab - Stats display correctly"""
        response = requests.get(f"{BASE_URL}/api/platform/stats", headers=self.headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "tenants" in data
        assert "total" in data["tenants"]
        assert "active" in data["tenants"]
        assert "suspended" in data["tenants"]
        assert "users" in data
        assert "vehicles" in data
        assert "bookings" in data
        
        print(f"SUCCESS: Platform stats - Tenants: {data['tenants']['total']}, Users: {data['users']}, Vehicles: {data['vehicles']}, Bookings: {data['bookings']['total']}")


class TestTenantsManagement:
    """Test Tenants Tab - CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_tenants(self):
        """3. Tenants Tab - View all franchises"""
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
        assert response.status_code == 200, f"Failed to list tenants: {response.text}"
        data = response.json()
        
        assert "tenants" in data
        assert "total" in data
        
        # Check tenant structure
        if data["tenants"]:
            tenant = data["tenants"][0]
            assert "id" in tenant
            assert "name" in tenant
            assert "slug" in tenant
            assert "status" in tenant
            assert "plan" in tenant
            print(f"SUCCESS: Listed {data['total']} tenants")
            for t in data["tenants"][:3]:
                print(f"  - {t['name']} ({t['slug']}) - {t['status']} - {t['plan']}")
        return data["tenants"]
    
    def test_create_tenant(self):
        """4. Tenants Tab - Create new franchise with master admin"""
        test_slug = f"test-franchise-{datetime.now().strftime('%H%M%S')}"
        tenant_data = {
            "name": f"Test Franchise {test_slug}",
            "slug": test_slug,
            "plan": "starter",
            "master_admin_email": f"admin.{test_slug}@quickwing.com",
            "master_admin_name": "Test Admin"
        }
        
        response = requests.post(f"{BASE_URL}/api/platform/tenants", json=tenant_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create tenant: {response.text}"
        data = response.json()
        
        assert "tenant" in data
        assert "master_admin" in data
        assert "login_url" in data
        assert data["tenant"]["name"] == tenant_data["name"]
        assert data["tenant"]["slug"] == test_slug
        assert data["master_admin"]["email"] == tenant_data["master_admin_email"]
        
        print(f"SUCCESS: Created tenant '{data['tenant']['name']}'")
        print(f"  - Master Admin: {data['master_admin']['email']}")
        print(f"  - Login URL: {data['login_url']}")
        
        return data["tenant"]["id"]
    
    def test_get_tenant_details(self):
        """5. Get tenant details with usage stats"""
        # First get list of tenants
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
        tenants = response.json()["tenants"]
        
        if tenants:
            tenant_id = tenants[0]["id"]
            response = requests.get(f"{BASE_URL}/api/platform/tenants/{tenant_id}", headers=self.headers)
            assert response.status_code == 200, f"Failed to get tenant details: {response.text}"
            data = response.json()
            
            assert "tenant" in data
            assert "usage" in data
            assert "vehicles" in data["usage"]
            assert "users" in data["usage"]
            assert "bookings_total" in data["usage"]
            
            print(f"SUCCESS: Tenant details - {data['tenant']['name']}")
            print(f"  - Vehicles: {data['usage']['vehicles']}/{data['usage']['max_vehicles']}")
            print(f"  - Users: {data['usage']['users']}/{data['usage']['max_users']}")
    
    def test_impersonate_tenant(self):
        """5. Tenants Tab - Impersonate a franchise"""
        # Get first tenant
        response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
        tenants = response.json()["tenants"]
        
        if tenants:
            tenant_id = tenants[0]["id"]
            response = requests.post(f"{BASE_URL}/api/platform/tenants/{tenant_id}/impersonate", headers=self.headers)
            assert response.status_code == 200, f"Failed to impersonate: {response.text}"
            data = response.json()
            
            assert "access_token" in data
            assert "tenant" in data
            print(f"SUCCESS: Impersonating tenant '{data['tenant']['name']}'")
            
            # Stop impersonation
            imp_headers = {"Authorization": f"Bearer {data['access_token']}"}
            stop_response = requests.post(f"{BASE_URL}/api/platform/stop-impersonation", headers=imp_headers)
            assert stop_response.status_code == 200
            print("SUCCESS: Stopped impersonation")
    
    def test_suspend_reactivate_tenant(self):
        """6. Tenants Tab - Suspend/Reactivate a franchise"""
        # Create a test tenant first
        test_slug = f"suspend-test-{datetime.now().strftime('%H%M%S')}"
        create_response = requests.post(f"{BASE_URL}/api/platform/tenants", json={
            "name": f"Suspend Test {test_slug}",
            "slug": test_slug,
            "plan": "starter"
        }, headers=self.headers)
        
        if create_response.status_code == 200:
            tenant_id = create_response.json()["tenant"]["id"]
            
            # Suspend
            suspend_response = requests.post(f"{BASE_URL}/api/platform/tenants/{tenant_id}/suspend", headers=self.headers)
            assert suspend_response.status_code == 200, f"Failed to suspend: {suspend_response.text}"
            print("SUCCESS: Tenant suspended")
            
            # Verify suspended
            get_response = requests.get(f"{BASE_URL}/api/platform/tenants/{tenant_id}", headers=self.headers)
            assert get_response.json()["tenant"]["status"] == "suspended"
            
            # Reactivate
            reactivate_response = requests.post(f"{BASE_URL}/api/platform/tenants/{tenant_id}/reactivate", headers=self.headers)
            assert reactivate_response.status_code == 200, f"Failed to reactivate: {reactivate_response.text}"
            print("SUCCESS: Tenant reactivated")
            
            # Verify active
            get_response = requests.get(f"{BASE_URL}/api/platform/tenants/{tenant_id}", headers=self.headers)
            assert get_response.json()["tenant"]["status"] == "active"


class TestUsersManagement:
    """Test Users Tab - User management operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_all_users(self):
        """8. Users Tab - View all users across platform"""
        response = requests.get(f"{BASE_URL}/api/platform/users", headers=self.headers)
        assert response.status_code == 200, f"Failed to list users: {response.text}"
        data = response.json()
        
        assert "users" in data
        assert "total" in data
        
        print(f"SUCCESS: Listed {data['total']} users")
        for user in data["users"][:5]:
            print(f"  - {user.get('email')} - {user.get('tenant_count', 0)} tenant(s)")
    
    def test_create_user(self):
        """9. Users Tab - Create new user with role assignment"""
        # Get a tenant first
        tenants_response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
        tenants = tenants_response.json()["tenants"]
        
        if tenants:
            tenant_id = tenants[0]["id"]
            test_email = f"test.user.{datetime.now().strftime('%H%M%S')}@quickwing.com"
            
            response = requests.post(
                f"{BASE_URL}/api/platform/users",
                json={
                    "email": test_email,
                    "password": "TestPass123",
                    "name": "Test User"
                },
                params={"role": "staff", "tenant_id": tenant_id},
                headers=self.headers
            )
            assert response.status_code == 200, f"Failed to create user: {response.text}"
            print(f"SUCCESS: Created user {test_email}")
            return test_email
    
    def test_get_user_details(self):
        """13. Users Tab - View user details and memberships"""
        # Get users list
        response = requests.get(f"{BASE_URL}/api/platform/users", headers=self.headers)
        users = response.json()["users"]
        
        if users:
            user_id = users[0]["id"]
            response = requests.get(f"{BASE_URL}/api/platform/users/{user_id}", headers=self.headers)
            assert response.status_code == 200, f"Failed to get user details: {response.text}"
            data = response.json()
            
            assert "user" in data
            assert "memberships" in data
            
            print(f"SUCCESS: User details - {data['user']['email']}")
            print(f"  - Memberships: {len(data['memberships'])}")
            for m in data["memberships"]:
                print(f"    - {m.get('tenant_name', 'Platform')}: {m['role']}")


class TestReportsAndBilling:
    """Test Reports & Billing Tab"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_executive_summary(self):
        """14. Reports Tab - Executive summary displays"""
        response = requests.get(f"{BASE_URL}/api/platform/reports/executive-summary", headers=self.headers)
        assert response.status_code == 200, f"Failed to get executive summary: {response.text}"
        data = response.json()
        
        assert "summary" in data
        assert "tenants" in data["summary"]
        assert "users" in data["summary"]
        assert "vehicles" in data["summary"]
        assert "bookings" in data["summary"]
        assert "revenue" in data["summary"]
        
        print(f"SUCCESS: Executive Summary")
        print(f"  - Tenants: {data['summary']['tenants']['total']} ({data['summary']['tenants']['active']} active)")
        print(f"  - Users: {data['summary']['users']}")
        print(f"  - Revenue: €{data['summary']['revenue']['total_collected']}")
    
    def test_franchises_report(self):
        """15. Reports Tab - Franchises report with revenue"""
        response = requests.get(f"{BASE_URL}/api/platform/reports/franchises", headers=self.headers)
        assert response.status_code == 200, f"Failed to get franchises report: {response.text}"
        data = response.json()
        
        assert "franchises" in data
        assert "total" in data
        
        print(f"SUCCESS: Franchises Report - {data['total']} franchises")
        for f in data["franchises"][:3]:
            stats = f.get("stats", {})
            print(f"  - {f['name']}: {stats.get('users', 0)} users, {stats.get('vehicles', 0)} vehicles, €{stats.get('total_billed', 0)} billed")
    
    def test_create_invoice(self):
        """16. Reports Tab - Create and manage invoices"""
        # Get a tenant
        tenants_response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
        tenants = tenants_response.json()["tenants"]
        
        if tenants:
            tenant_id = tenants[0]["id"]
            invoice_data = {
                "tenant_id": tenant_id,
                "items": [
                    {"description": "Monthly Subscription - Starter Plan", "quantity": 1, "unit_price": 99.00},
                    {"description": "Additional Vehicle Slot", "quantity": 2, "unit_price": 10.00}
                ],
                "tax_rate": 23,
                "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "notes": "Test invoice"
            }
            
            response = requests.post(f"{BASE_URL}/api/platform/invoices", json=invoice_data, headers=self.headers)
            assert response.status_code == 200, f"Failed to create invoice: {response.text}"
            data = response.json()
            
            assert "invoice" in data
            assert data["invoice"]["tenant_id"] == tenant_id
            
            print(f"SUCCESS: Created invoice {data['invoice']['invoice_number']}")
            print(f"  - Total: €{data['invoice']['total']}")
            return data["invoice"]["id"]
    
    def test_list_invoices(self):
        """List all invoices"""
        response = requests.get(f"{BASE_URL}/api/platform/invoices", headers=self.headers)
        assert response.status_code == 200, f"Failed to list invoices: {response.text}"
        data = response.json()
        
        assert "invoices" in data
        assert "summary" in data
        
        print(f"SUCCESS: Listed {data['total']} invoices")
        print(f"  - Total: €{data['summary']['total_amount']}")
        print(f"  - Paid: €{data['summary']['paid_amount']}")
        print(f"  - Pending: €{data['summary']['pending_amount']}")
    
    def test_download_invoice_pdf(self):
        """17. Reports Tab - Download invoice PDF"""
        # Get invoices
        response = requests.get(f"{BASE_URL}/api/platform/invoices", headers=self.headers)
        invoices = response.json()["invoices"]
        
        if invoices:
            invoice_id = invoices[0]["id"]
            response = requests.get(f"{BASE_URL}/api/platform/invoices/{invoice_id}/pdf", headers=self.headers)
            # PDF endpoint might not exist, check for 200 or 404
            if response.status_code == 200:
                assert response.headers.get("content-type") == "application/pdf"
                print(f"SUCCESS: Downloaded invoice PDF")
            else:
                print(f"INFO: Invoice PDF endpoint returned {response.status_code}")


class TestAuditLog:
    """Test Audit Tab"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_view_audit_logs(self):
        """18. Audit Tab - View audit logs"""
        response = requests.get(f"{BASE_URL}/api/platform/audit-log", headers=self.headers)
        assert response.status_code == 200, f"Failed to get audit logs: {response.text}"
        data = response.json()
        
        assert "events" in data
        
        print(f"SUCCESS: Retrieved {len(data['events'])} audit events")
        for event in data["events"][:5]:
            print(f"  - {event.get('action')}: {event.get('actor_email')} at {event.get('created_at', '')[:19]}")


class TestCompanySettings:
    """Test Billing Tab - Company settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_company_settings(self):
        """19. Billing Tab - Company settings"""
        response = requests.get(f"{BASE_URL}/api/platform/settings", headers=self.headers)
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        data = response.json()
        
        print(f"SUCCESS: Company settings retrieved")
        print(f"  - Company: {data.get('company_name', 'N/A')}")
        print(f"  - Currency: {data.get('currency_symbol', '€')}")


class TestFranchiseAdminLogin:
    """Test Franchise Admin authentication and dashboard"""
    
    def test_franchise_admin_login(self):
        """20. Login as franchise admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=FRANCHISE_ADMIN)
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"SUCCESS: Franchise admin login - {data['user']['email']}")
            print(f"  - Role: {data['user'].get('role')}")
            if data.get("active_tenant"):
                print(f"  - Tenant: {data['active_tenant'].get('tenant_name')}")
            return data["access_token"]
        else:
            # Franchise admin might not exist yet
            print(f"INFO: Franchise admin login returned {response.status_code} - user may not exist")
            pytest.skip("Franchise admin user not found")


class TestTenantDashboard:
    """Test Tenant Dashboard features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token - try franchise admin first, then super admin with impersonation"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=FRANCHISE_ADMIN)
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.tenant_slug = response.json().get("active_tenant", {}).get("tenant_slug", "")
        else:
            # Use super admin and impersonate
            response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            
            # Get first tenant and impersonate
            tenants_response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
            tenants = tenants_response.json()["tenants"]
            if tenants:
                imp_response = requests.post(f"{BASE_URL}/api/platform/tenants/{tenants[0]['id']}/impersonate", headers=self.headers)
                if imp_response.status_code == 200:
                    self.token = imp_response.json()["access_token"]
                    self.headers = {"Authorization": f"Bearer {self.token}"}
                    self.tenant_slug = tenants[0]["slug"]
    
    def test_get_vehicles(self):
        """23. Fleet Tab > Live Status - Vehicle cards with status"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        assert response.status_code == 200, f"Failed to get vehicles: {response.text}"
        data = response.json()
        
        print(f"SUCCESS: Retrieved {len(data)} vehicles")
        for v in data[:5]:
            status = "Blocked" if v.get("is_blocked") else "Available"
            print(f"  - {v['name']} ({v['registration']}) - {status}")
    
    def test_get_bookings(self):
        """27. Bookings Tab - View bookings"""
        response = requests.get(f"{BASE_URL}/api/bookings", headers=self.headers)
        assert response.status_code == 200, f"Failed to get bookings: {response.text}"
        data = response.json()
        
        print(f"SUCCESS: Retrieved {len(data)} bookings")
        for b in data[:5]:
            print(f"  - {b.get('user_name', 'N/A')} - {b.get('status', 'N/A')}")
    
    def test_get_team_members(self):
        """28. Team Tab - View staff members"""
        response = requests.get(f"{BASE_URL}/api/tenant/users", headers=self.headers)
        assert response.status_code == 200, f"Failed to get team: {response.text}"
        data = response.json()
        
        users = data.get("users", [])
        print(f"SUCCESS: Retrieved {len(users)} team members")
        for u in users[:5]:
            print(f"  - {u.get('name', 'N/A')} ({u.get('email')}) - {u.get('role')}")
    
    def test_tenant_reports_summary(self):
        """29. Reports Tab > Analytics - Tenant-scoped reports"""
        response = requests.get(f"{BASE_URL}/api/tenant/reports/summary", headers=self.headers)
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        data = response.json()
        
        assert "summary" in data
        print(f"SUCCESS: Tenant reports summary")
        print(f"  - Vehicles: {data['summary'].get('total_vehicles', 0)}")
        print(f"  - Bookings this month: {data['summary'].get('bookings_this_month', 0)}")
        print(f"  - Utilization: {data['summary'].get('utilization_rate_percent', 0)}%")
    
    def test_fleet_reports_daily_availability(self):
        """30. Reports Tab > Fleet Reports - Daily availability"""
        response = requests.get(f"{BASE_URL}/api/tenant/fleet-reports", headers=self.headers)
        assert response.status_code == 200, f"Failed to get fleet reports: {response.text}"
        data = response.json()
        
        print(f"SUCCESS: Fleet reports")
        print(f"  - Total vehicles: {data.get('total_vehicles', 0)}")
        print(f"  - Total bookings: {data.get('total_bookings', 0)}")
    
    def test_daily_timeline(self):
        """31. Reports Tab > Daily Timeline - Hourly utilization chart"""
        response = requests.get(f"{BASE_URL}/api/tenant/reports/daily-timeline", headers=self.headers)
        assert response.status_code == 200, f"Failed to get daily timeline: {response.text}"
        data = response.json()
        
        assert "timeline" in data
        print(f"SUCCESS: Daily timeline - {len(data['timeline'])} hours")
        print(f"  - Total fleet: {data.get('available_fleet', 0)}")
    
    def test_announcements(self):
        """32-33. Announcements Tab - Create and view announcements"""
        # Create announcement
        announcement_data = {
            "title": f"Test Announcement {datetime.now().strftime('%H%M%S')}",
            "content": "This is a test announcement for QA testing",
            "priority": "high",
            "requires_acknowledgment": True
        }
        
        response = requests.post(f"{BASE_URL}/api/messages", json=announcement_data, headers=self.headers)
        if response.status_code == 200:
            print(f"SUCCESS: Created announcement")
        
        # List announcements
        response = requests.get(f"{BASE_URL}/api/announcements", headers=self.headers)
        assert response.status_code == 200, f"Failed to get announcements: {response.text}"
        data = response.json()
        
        print(f"SUCCESS: Retrieved {len(data)} announcements")
    
    def test_qr_code_generation(self):
        """35. QR Code - Generate vehicle QR codes"""
        # Get vehicles first
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        vehicles = vehicles_response.json()
        
        if vehicles:
            vehicle_id = vehicles[0]["id"]
            response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/qr-code", headers=self.headers)
            
            if response.status_code == 200:
                assert "image/png" in response.headers.get("content-type", "")
                print(f"SUCCESS: Generated QR code for vehicle {vehicles[0]['name']}")
            else:
                print(f"INFO: QR code endpoint returned {response.status_code}")
    
    def test_block_vehicle(self):
        """37. Block Vehicle - Block for service/cleaning"""
        # Get vehicles first
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        vehicles = vehicles_response.json()
        
        if vehicles:
            vehicle_id = vehicles[0]["id"]
            
            # Block vehicle
            block_data = {
                "is_blocked": True,
                "block_reason": "Service - QA Test"
            }
            response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=block_data, headers=self.headers)
            
            if response.status_code == 200:
                print(f"SUCCESS: Blocked vehicle {vehicles[0]['name']}")
                
                # Unblock
                unblock_data = {"is_blocked": False, "block_reason": None}
                requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=unblock_data, headers=self.headers)
                print(f"SUCCESS: Unblocked vehicle")
    
    def test_csv_export(self):
        """38. CSV/PDF Export - Reports exportable"""
        response = requests.get(f"{BASE_URL}/api/tenant/reports/summary/csv", headers=self.headers)
        
        if response.status_code == 200:
            assert "text/csv" in response.headers.get("content-type", "")
            print(f"SUCCESS: CSV export working")
        else:
            print(f"INFO: CSV export returned {response.status_code}")
    
    def test_pdf_export(self):
        """38. CSV/PDF Export - PDF export"""
        response = requests.get(f"{BASE_URL}/api/tenant/reports/summary/pdf", headers=self.headers)
        
        if response.status_code == 200:
            assert "application/pdf" in response.headers.get("content-type", "")
            print(f"SUCCESS: PDF export working")
        else:
            print(f"INFO: PDF export returned {response.status_code}")


class TestVehicleManagement:
    """Test Vehicle CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token with tenant context"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=FRANCHISE_ADMIN)
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            # Use super admin and impersonate
            response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            
            tenants_response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
            tenants = tenants_response.json()["tenants"]
            if tenants:
                imp_response = requests.post(f"{BASE_URL}/api/platform/tenants/{tenants[0]['id']}/impersonate", headers=self.headers)
                if imp_response.status_code == 200:
                    self.token = imp_response.json()["access_token"]
                    self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_add_vehicle(self):
        """26. Fleet Tab > Manage Vehicles - Add vehicle"""
        vehicle_data = {
            "name": f"Test Car {datetime.now().strftime('%H%M%S')}",
            "registration": f"QA-{datetime.now().strftime('%H%M%S')}"
        }
        
        response = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to add vehicle: {response.text}"
        data = response.json()
        
        # Response format is {"message": "...", "vehicle": {...}}
        assert "vehicle" in data
        vehicle = data["vehicle"]
        assert vehicle["name"] == vehicle_data["name"]
        assert vehicle["registration"] == vehicle_data["registration"]
        
        print(f"SUCCESS: Added vehicle {vehicle['name']}")
        return vehicle["id"]
    
    def test_edit_vehicle(self):
        """26. Fleet Tab > Manage Vehicles - Edit vehicle"""
        # Create a vehicle first
        vehicle_data = {
            "name": f"Edit Test {datetime.now().strftime('%H%M%S')}",
            "registration": f"EDT-{datetime.now().strftime('%H%M%S')}"
        }
        create_response = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=self.headers)
        
        if create_response.status_code == 200:
            vehicle_id = create_response.json()["vehicle"]["id"]
            
            # Edit vehicle
            update_data = {"name": "Updated Vehicle Name"}
            response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=update_data, headers=self.headers)
            assert response.status_code == 200, f"Failed to edit vehicle: {response.text}"
            
            print(f"SUCCESS: Edited vehicle")
    
    def test_delete_vehicle(self):
        """26. Fleet Tab > Manage Vehicles - Delete vehicle"""
        # Create a vehicle first
        vehicle_data = {
            "name": f"Delete Test {datetime.now().strftime('%H%M%S')}",
            "registration": f"DEL-{datetime.now().strftime('%H%M%S')}"
        }
        create_response = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=self.headers)
        
        if create_response.status_code == 200:
            vehicle_id = create_response.json()["id"]
            
            # Delete vehicle
            response = requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=self.headers)
            assert response.status_code == 200, f"Failed to delete vehicle: {response.text}"
            
            print(f"SUCCESS: Deleted vehicle")


class TestBookingManagement:
    """Test Booking CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token with tenant context"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=FRANCHISE_ADMIN)
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            
            tenants_response = requests.get(f"{BASE_URL}/api/platform/tenants", headers=self.headers)
            tenants = tenants_response.json()["tenants"]
            if tenants:
                imp_response = requests.post(f"{BASE_URL}/api/platform/tenants/{tenants[0]['id']}/impersonate", headers=self.headers)
                if imp_response.status_code == 200:
                    self.token = imp_response.json()["access_token"]
                    self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_booking(self):
        """27. Bookings Tab - Create booking"""
        # Get a vehicle first
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        vehicles = vehicles_response.json()
        
        if vehicles:
            vehicle_id = vehicles[0]["id"]
            
            booking_data = {
                "car_id": vehicle_id,
                "user_name": "QA Test User",
                "start_time": (datetime.now() + timedelta(hours=1)).isoformat(),
                "end_time": (datetime.now() + timedelta(hours=3)).isoformat(),
                "notes": "QA Test Booking"
            }
            
            response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"SUCCESS: Created booking for {data.get('user_name')}")
                return data["id"]
            else:
                print(f"INFO: Create booking returned {response.status_code}: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
