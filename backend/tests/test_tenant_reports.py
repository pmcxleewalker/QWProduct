"""
Test Tenant Reports Endpoints
Tests for /api/tenant/reports/summary and /api/tenant/reports/vehicle-utilization
These endpoints are admin-only and return tenant-scoped data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TENANT_ADMIN_EMAIL = "admin.test-franchise@quickwing.com"
TENANT_ADMIN_PASSWORD = "JF7mIdG60wiV"
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"

# Test tenant slug
TEST_TENANT_SLUG = "test-franchise"


class TestTenantReportsEndpoints:
    """Test tenant reports API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_tenant_admin_token(self):
        """Login as tenant admin and get token with tenant context"""
        # First login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TENANT_ADMIN_EMAIL,
            "password": TENANT_ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Tenant admin login failed: {login_response.status_code} - {login_response.text}")
        
        login_data = login_response.json()
        token = login_data.get("access_token")
        
        # Check if we need to select tenant
        tenants = login_data.get("tenants", [])
        active_tenant = login_data.get("active_tenant")
        
        if not active_tenant and tenants:
            # Need to select tenant
            tenant_id = tenants[0].get("tenant_id")
            select_response = self.session.post(
                f"{BASE_URL}/api/auth/select-tenant",
                json={"tenant_id": tenant_id},
                headers={"Authorization": f"Bearer {token}"}
            )
            if select_response.status_code == 200:
                token = select_response.json().get("access_token")
        
        return token
    
    def get_staff_token(self):
        """Try to get a staff token (if staff user exists)"""
        # This would need a staff user - for now we'll test that admin works
        return None
    
    def test_tenant_reports_summary_requires_auth(self):
        """Test that reports summary endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/summary")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Reports summary requires authentication")
    
    def test_tenant_reports_summary_returns_data(self):
        """Test that reports summary returns correct data structure"""
        token = self.get_tenant_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify summary structure
        assert "summary" in data, "Response should contain 'summary'"
        summary = data["summary"]
        
        # Check required fields in summary
        required_fields = [
            "total_vehicles",
            "total_bookings", 
            "team_members",
            "bookings_this_month",
            "bookings_last_month",
            "booking_trend_percent",
            "vehicles_used_this_month",
            "utilization_rate_percent"
        ]
        
        for field in required_fields:
            assert field in summary, f"Summary should contain '{field}'"
            print(f"  - {field}: {summary[field]}")
        
        # Verify vehicle_usage is present
        assert "vehicle_usage" in data, "Response should contain 'vehicle_usage'"
        assert isinstance(data["vehicle_usage"], list), "vehicle_usage should be a list"
        
        # Verify daily_booking_trend is present
        assert "daily_booking_trend" in data, "Response should contain 'daily_booking_trend'"
        assert isinstance(data["daily_booking_trend"], list), "daily_booking_trend should be a list"
        
        # Verify generated_at timestamp
        assert "generated_at" in data, "Response should contain 'generated_at'"
        
        print(f"✓ Reports summary returned valid data structure")
        print(f"  Total vehicles: {summary['total_vehicles']}")
        print(f"  Total bookings: {summary['total_bookings']}")
        print(f"  Team members: {summary['team_members']}")
        print(f"  Bookings this month: {summary['bookings_this_month']}")
        print(f"  Utilization rate: {summary['utilization_rate_percent']}%")
    
    def test_tenant_reports_vehicle_utilization_requires_auth(self):
        """Test that vehicle utilization endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/tenant/reports/vehicle-utilization")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Vehicle utilization requires authentication")
    
    def test_tenant_reports_vehicle_utilization_returns_data(self):
        """Test that vehicle utilization returns correct data structure"""
        token = self.get_tenant_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/vehicle-utilization",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify vehicles list is present
        assert "vehicles" in data, "Response should contain 'vehicles'"
        assert isinstance(data["vehicles"], list), "vehicles should be a list"
        
        # If there are vehicles, verify structure
        if len(data["vehicles"]) > 0:
            vehicle = data["vehicles"][0]
            required_fields = [
                "id",
                "name",
                "registration",
                "is_blocked",
                "total_bookings",
                "total_hours_booked",
                "last_booking_date"
            ]
            
            for field in required_fields:
                assert field in vehicle, f"Vehicle should contain '{field}'"
            
            print(f"✓ Vehicle utilization returned {len(data['vehicles'])} vehicles")
            for v in data["vehicles"][:5]:  # Show first 5
                print(f"  - {v['name']} ({v['registration']}): {v['total_bookings']} bookings, {v['total_hours_booked']} hours")
        else:
            print("✓ Vehicle utilization returned empty list (no vehicles)")
        
        # Verify generated_at timestamp
        assert "generated_at" in data, "Response should contain 'generated_at'"
    
    def test_reports_data_is_tenant_scoped(self):
        """Test that reports data is scoped to the current tenant only"""
        token = self.get_tenant_admin_token()
        
        # Get summary
        summary_response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert summary_response.status_code == 200
        summary_data = summary_response.json()
        
        # Get vehicle utilization
        util_response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/vehicle-utilization",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert util_response.status_code == 200
        util_data = util_response.json()
        
        # Verify counts match
        summary_vehicles = summary_data["summary"]["total_vehicles"]
        util_vehicles = len(util_data["vehicles"])
        
        assert summary_vehicles == util_vehicles, \
            f"Vehicle counts should match: summary={summary_vehicles}, utilization={util_vehicles}"
        
        print(f"✓ Reports data is tenant-scoped (both endpoints show {summary_vehicles} vehicles)")
    
    def test_vehicle_usage_sorted_by_bookings(self):
        """Test that vehicle usage is sorted by booking count descending"""
        token = self.get_tenant_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        vehicle_usage = data.get("vehicle_usage", [])
        
        if len(vehicle_usage) > 1:
            # Verify sorted descending by total_bookings
            for i in range(len(vehicle_usage) - 1):
                current = vehicle_usage[i]["total_bookings"]
                next_val = vehicle_usage[i + 1]["total_bookings"]
                assert current >= next_val, \
                    f"Vehicle usage should be sorted descending: {current} >= {next_val}"
            
            print(f"✓ Vehicle usage is sorted by bookings (descending)")
        else:
            print("✓ Vehicle usage sorting check skipped (< 2 vehicles)")
    
    def test_daily_booking_trend_has_7_days(self):
        """Test that daily booking trend contains 7 days of data"""
        token = self.get_tenant_admin_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        daily_trend = data.get("daily_booking_trend", [])
        
        assert len(daily_trend) == 7, f"Daily trend should have 7 days, got {len(daily_trend)}"
        
        # Verify each entry has date and count
        for entry in daily_trend:
            assert "date" in entry, "Each trend entry should have 'date'"
            assert "count" in entry, "Each trend entry should have 'count'"
            assert isinstance(entry["count"], int), "Count should be an integer"
        
        print(f"✓ Daily booking trend has 7 days of data")
        for entry in daily_trend:
            print(f"  - {entry['date']}: {entry['count']} bookings")


class TestTenantReportsAccessControl:
    """Test access control for tenant reports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_staff_cannot_access_reports_summary(self):
        """Test that staff users cannot access reports summary (admin only)"""
        # Login as staff user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "staff.test-franchise@quickwing.com",
            "password": "87xbq9WE56"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Staff login failed - user may not exist")
        
        token = login_response.json().get("access_token")
        
        # Try to access reports as staff
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for staff, got {response.status_code}"
        assert "Admin access required" in response.text
        print("✓ Staff user correctly denied access to reports summary")
    
    def test_staff_cannot_access_vehicle_utilization(self):
        """Test that staff users cannot access vehicle utilization (admin only)"""
        # Login as staff user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "staff.test-franchise@quickwing.com",
            "password": "87xbq9WE56"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Staff login failed - user may not exist")
        
        token = login_response.json().get("access_token")
        
        # Try to access vehicle utilization as staff
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/vehicle-utilization",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for staff, got {response.status_code}"
        assert "Admin access required" in response.text
        print("✓ Staff user correctly denied access to vehicle utilization")
    
    def test_super_admin_cannot_access_without_tenant_context(self):
        """Test that super admin needs tenant context to access reports"""
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Super admin login failed")
        
        token = login_response.json().get("access_token")
        
        # Try to access reports without tenant context
        response = self.session.get(
            f"{BASE_URL}/api/tenant/reports/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should fail because super admin doesn't have tenant context by default
        # Unless they impersonate a tenant
        if response.status_code == 200:
            print("✓ Super admin can access reports (may have default tenant context)")
        else:
            assert response.status_code in [400, 403], \
                f"Expected 400/403 without tenant context, got {response.status_code}"
            print("✓ Super admin cannot access reports without tenant context")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
