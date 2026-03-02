"""
Tenant Isolation Tests
======================
These tests verify that tenant data is properly isolated.
A user from Tenant A should NEVER be able to access data from Tenant B.
"""
import pytest
import httpx
import asyncio
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001/api"
SUPER_ADMIN_EMAIL = "superadmin@quickwing.com"
SUPER_ADMIN_PASSWORD = "Super123"


class TestTenantIsolation:
    """Test suite for verifying tenant data isolation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create two tenants with users and data"""
        self.tenant_a = None
        self.tenant_b = None
        self.admin_a_token = None
        self.admin_b_token = None
        self.vehicle_a_id = None
        self.vehicle_b_id = None
        self.booking_a_id = None
        self.booking_b_id = None
    
    @pytest.mark.asyncio
    async def test_setup_tenants_and_users(self):
        """Step 1: Setup test tenants and users"""
        async with httpx.AsyncClient() as client:
            # Login as super admin
            response = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
            )
            assert response.status_code == 200, f"Super admin login failed: {response.text}"
            super_token = response.json()["access_token"]
            headers = {"Authorization": f"Bearer {super_token}"}
            
            # Create Tenant A
            timestamp = int(datetime.now().timestamp())
            response = await client.post(
                f"{BASE_URL}/platform/tenants",
                json={
                    "name": f"Test Tenant A {timestamp}",
                    "slug": f"test-tenant-a-{timestamp}",
                    "plan": "starter",
                    "master_admin_email": f"admin-a-{timestamp}@test.com"
                },
                headers=headers
            )
            assert response.status_code == 200, f"Failed to create Tenant A: {response.text}"
            tenant_a_data = response.json()
            self.tenant_a = tenant_a_data["tenant"]
            admin_a_password = tenant_a_data["master_admin"]["password"]
            admin_a_email = tenant_a_data["master_admin"]["email"]
            print(f"Created Tenant A: {self.tenant_a['name']}")
            
            # Create Tenant B
            response = await client.post(
                f"{BASE_URL}/platform/tenants",
                json={
                    "name": f"Test Tenant B {timestamp}",
                    "slug": f"test-tenant-b-{timestamp}",
                    "plan": "starter",
                    "master_admin_email": f"admin-b-{timestamp}@test.com"
                },
                headers=headers
            )
            assert response.status_code == 200, f"Failed to create Tenant B: {response.text}"
            tenant_b_data = response.json()
            self.tenant_b = tenant_b_data["tenant"]
            admin_b_password = tenant_b_data["master_admin"]["password"]
            admin_b_email = tenant_b_data["master_admin"]["email"]
            print(f"Created Tenant B: {self.tenant_b['name']}")
            
            # Login as Admin A
            response = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": admin_a_email, "password": admin_a_password}
            )
            assert response.status_code == 200, f"Admin A login failed: {response.text}"
            self.admin_a_token = response.json()["access_token"]
            
            # Login as Admin B
            response = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": admin_b_email, "password": admin_b_password}
            )
            assert response.status_code == 200, f"Admin B login failed: {response.text}"
            self.admin_b_token = response.json()["access_token"]
            
            # Test passed - store values for next test
            return {
                "tenant_a": self.tenant_a,
                "tenant_b": self.tenant_b,
                "admin_a_token": self.admin_a_token,
                "admin_b_token": self.admin_b_token
            }
    
    @pytest.mark.asyncio
    async def test_vehicle_isolation(self):
        """Test that vehicles are isolated between tenants"""
        # First set up the tenants
        setup_data = await self.test_setup_tenants_and_users()
        
        async with httpx.AsyncClient() as client:
            headers_a = {"Authorization": f"Bearer {setup_data['admin_a_token']}"}
            headers_b = {"Authorization": f"Bearer {setup_data['admin_b_token']}"}
            
            # Create a vehicle in Tenant A
            response = await client.post(
                f"{BASE_URL}/vehicles",
                json={
                    "registration": "TEST-A-001",
                    "make": "Toyota",
                    "model": "Corolla"
                },
                headers=headers_a
            )
            assert response.status_code == 200, f"Failed to create vehicle in Tenant A: {response.text}"
            vehicle_a = response.json()["vehicle"]
            self.vehicle_a_id = vehicle_a["id"]
            print(f"Created Vehicle in Tenant A: {self.vehicle_a_id}")
            
            # Create a vehicle in Tenant B
            response = await client.post(
                f"{BASE_URL}/vehicles",
                json={
                    "registration": "TEST-B-001",
                    "make": "Honda",
                    "model": "Civic"
                },
                headers=headers_b
            )
            assert response.status_code == 200, f"Failed to create vehicle in Tenant B: {response.text}"
            vehicle_b = response.json()["vehicle"]
            self.vehicle_b_id = vehicle_b["id"]
            print(f"Created Vehicle in Tenant B: {self.vehicle_b_id}")
            
            # TEST: Admin A should NOT be able to see Tenant B's vehicles
            response = await client.get(f"{BASE_URL}/vehicles", headers=headers_a)
            assert response.status_code == 200
            vehicles_seen_by_a = response.json()
            vehicle_ids_a = [v["id"] for v in vehicles_seen_by_a]
            
            assert self.vehicle_a_id in vehicle_ids_a, "Admin A should see their own vehicle"
            assert self.vehicle_b_id not in vehicle_ids_a, "ISOLATION FAILURE: Admin A can see Tenant B's vehicle!"
            print("✓ Vehicle listing isolation: PASSED")
            
            # TEST: Admin A should NOT be able to access Tenant B's vehicle directly
            response = await client.get(f"{BASE_URL}/vehicles/{self.vehicle_b_id}", headers=headers_a)
            assert response.status_code == 404, f"ISOLATION FAILURE: Admin A can access Tenant B's vehicle directly! Got {response.status_code}"
            print("✓ Vehicle direct access isolation: PASSED")
            
            # TEST: Admin A should NOT be able to update Tenant B's vehicle
            response = await client.put(
                f"{BASE_URL}/vehicles/{self.vehicle_b_id}",
                json={"make": "Hacked"},
                headers=headers_a
            )
            assert response.status_code == 404, f"ISOLATION FAILURE: Admin A can update Tenant B's vehicle! Got {response.status_code}"
            print("✓ Vehicle update isolation: PASSED")
            
            # TEST: Admin A should NOT be able to delete Tenant B's vehicle
            response = await client.delete(f"{BASE_URL}/vehicles/{self.vehicle_b_id}", headers=headers_a)
            assert response.status_code == 404, f"ISOLATION FAILURE: Admin A can delete Tenant B's vehicle! Got {response.status_code}"
            print("✓ Vehicle delete isolation: PASSED")
            
            # Verify Tenant B's vehicle still exists
            response = await client.get(f"{BASE_URL}/vehicles/{self.vehicle_b_id}", headers=headers_b)
            assert response.status_code == 200, "Tenant B's vehicle should still exist"
            print("✓ Tenant B's vehicle integrity verified: PASSED")
    
    @pytest.mark.asyncio
    async def test_booking_isolation(self):
        """Test that bookings are isolated between tenants"""
        # First set up the tenants with vehicles
        setup_data = await self.test_setup_tenants_and_users()
        
        async with httpx.AsyncClient() as client:
            headers_a = {"Authorization": f"Bearer {setup_data['admin_a_token']}"}
            headers_b = {"Authorization": f"Bearer {setup_data['admin_b_token']}"}
            
            # Create vehicles first
            response = await client.post(
                f"{BASE_URL}/vehicles",
                json={"registration": "BOOK-A-001", "make": "Ford", "model": "Focus"},
                headers=headers_a
            )
            vehicle_a = response.json()["vehicle"]
            
            response = await client.post(
                f"{BASE_URL}/vehicles",
                json={"registration": "BOOK-B-001", "make": "VW", "model": "Golf"},
                headers=headers_b
            )
            vehicle_b = response.json()["vehicle"]
            
            # Create booking in Tenant A
            response = await client.post(
                f"{BASE_URL}/bookings",
                json={
                    "car_id": vehicle_a["id"],
                    "start_time": "2025-01-15T09:00:00",
                    "end_time": "2025-01-15T17:00:00",
                    "purpose": "Client Visit A"
                },
                headers=headers_a
            )
            assert response.status_code == 200, f"Failed to create booking A: {response.text}"
            booking_a = response.json()
            booking_a_id = booking_a["id"]
            print(f"Created Booking in Tenant A: {booking_a_id}")
            
            # Create booking in Tenant B
            response = await client.post(
                f"{BASE_URL}/bookings",
                json={
                    "car_id": vehicle_b["id"],
                    "start_time": "2025-01-15T09:00:00",
                    "end_time": "2025-01-15T17:00:00",
                    "purpose": "Client Visit B"
                },
                headers=headers_b
            )
            assert response.status_code == 200, f"Failed to create booking B: {response.text}"
            booking_b = response.json()
            booking_b_id = booking_b["id"]
            print(f"Created Booking in Tenant B: {booking_b_id}")
            
            # TEST: Admin A should NOT see Tenant B's bookings
            response = await client.get(f"{BASE_URL}/bookings", headers=headers_a)
            assert response.status_code == 200
            bookings_a = response.json()
            booking_ids_a = [b["id"] for b in bookings_a]
            
            assert booking_a_id in booking_ids_a, "Admin A should see their own booking"
            assert booking_b_id not in booking_ids_a, "ISOLATION FAILURE: Admin A can see Tenant B's booking!"
            print("✓ Booking listing isolation: PASSED")
            
            # TEST: Admin A should NOT access Tenant B's booking directly
            response = await client.get(f"{BASE_URL}/bookings/{booking_b_id}", headers=headers_a)
            assert response.status_code == 404, f"ISOLATION FAILURE: Admin A can access Tenant B's booking! Got {response.status_code}"
            print("✓ Booking direct access isolation: PASSED")
            
            # TEST: Admin A should NOT book Tenant B's vehicle
            response = await client.post(
                f"{BASE_URL}/bookings",
                json={
                    "car_id": vehicle_b["id"],
                    "start_time": "2025-01-16T09:00:00",
                    "end_time": "2025-01-16T17:00:00",
                    "purpose": "Attempted Cross-Tenant Booking"
                },
                headers=headers_a
            )
            assert response.status_code == 404, f"ISOLATION FAILURE: Admin A can book Tenant B's vehicle! Got {response.status_code}"
            print("✓ Cross-tenant booking prevention: PASSED")
    
    @pytest.mark.asyncio
    async def test_user_isolation(self):
        """Test that user management is isolated between tenants"""
        setup_data = await self.test_setup_tenants_and_users()
        
        async with httpx.AsyncClient() as client:
            headers_a = {"Authorization": f"Bearer {setup_data['admin_a_token']}"}
            headers_b = {"Authorization": f"Bearer {setup_data['admin_b_token']}"}
            
            # Admin A creates a staff user in their tenant
            timestamp = int(datetime.now().timestamp())
            response = await client.post(
                f"{BASE_URL}/tenant/users",
                json={
                    "email": f"staff-a-{timestamp}@test.com",
                    "password": "StaffPass123",
                    "name": "Staff A"
                },
                params={"role": "staff"},
                headers=headers_a
            )
            assert response.status_code == 200, f"Failed to create staff in Tenant A: {response.text}"
            print("Created staff user in Tenant A")
            
            # TEST: Admin A should NOT see Tenant B's users in their tenant list
            response = await client.get(f"{BASE_URL}/tenant/users", headers=headers_a)
            assert response.status_code == 200
            users_a = response.json()["users"]
            
            response = await client.get(f"{BASE_URL}/tenant/users", headers=headers_b)
            assert response.status_code == 200
            users_b = response.json()["users"]
            
            # Extract emails for comparison
            emails_a = set(u["email"] for u in users_a)
            emails_b = set(u["email"] for u in users_b)
            
            # There should be no overlap except possibly shared platform users
            common_emails = emails_a.intersection(emails_b)
            assert len(common_emails) == 0, f"ISOLATION FAILURE: Tenants share users: {common_emails}"
            print("✓ User listing isolation: PASSED")


def run_tests():
    """Run all tenant isolation tests"""
    import sys
    sys.exit(pytest.main([__file__, "-v", "-s"]))


if __name__ == "__main__":
    run_tests()
