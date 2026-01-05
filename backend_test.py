import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class FleetManagementAPITester:
    def __init__(self, base_url="https://cartrack-19.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_car_id = None
        self.test_booking_id = None
        self.test_provider_id = None
        self.admin_token = None
        self.staff_token = None
        self.test_lift_request_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add authorization header if token provided
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def authenticate_admin(self):
        """Authenticate as admin user"""
        print("\n=== Authenticating as Admin ===")
        
        login_data = {
            "email": "admin@quickwing.com",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin authenticated successfully")
            return True
        else:
            print("❌ Failed to authenticate admin")
            return False

    def authenticate_staff(self):
        """Authenticate as staff user"""
        print("\n=== Authenticating as Staff ===")
        
        login_data = {
            "email": "staff@quickwing.com",
            "password": "staff123"
        }
        
        success, response = self.run_test(
            "Staff Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.staff_token = response['access_token']
            print(f"   Staff authenticated successfully")
            return True
        else:
            print("❌ Failed to authenticate staff")
            return False

    def test_compliance_alerts(self):
        """Test compliance alerts API"""
        print("\n=== Testing Compliance Alerts ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False

        # Get compliance alerts
        success, response = self.run_test(
            "Get Compliance Alerts",
            "GET",
            "admin/compliance-alerts",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Found {len(response)} compliance alerts")
            # Check if Hyundai i30 (M) is in alerts
            hyundai_found = False
            for alert in response:
                if "Hyundai i30" in alert.get('car_name', ''):
                    hyundai_found = True
                    print(f"   ✅ Found Hyundai i30 with {len(alert.get('alerts', []))} alerts")
                    for car_alert in alert.get('alerts', []):
                        print(f"      - {car_alert['type']}: {car_alert['days_until']} days")
            
            if not hyundai_found:
                print("   ⚠️  Hyundai i30 not found in alerts (may not have compliance dates set)")
        
        return success

    def test_car_blocking(self):
        """Test car blocking functionality"""
        print("\n=== Testing Car Blocking ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False

        if not self.test_car_id:
            print("❌ No test car available for blocking")
            return False

        # Block the car
        block_data = {
            "reason": "Service"
        }
        
        success, response = self.run_test(
            "Block Car for Service",
            "POST",
            f"cars/{self.test_car_id}/block",
            200,
            data=block_data,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Verify car is blocked by getting car details
        success, car_response = self.run_test(
            "Verify Car is Blocked",
            "GET",
            f"cars/{self.test_car_id}",
            200
        )
        
        if success:
            if car_response.get('is_blocked') == True and car_response.get('block_reason') == 'Service':
                print("   ✅ Car successfully blocked with correct reason")
            else:
                print(f"   ❌ Car blocking verification failed: is_blocked={car_response.get('is_blocked')}, reason={car_response.get('block_reason')}")
                return False
        else:
            return False

        # Test booking prevention on blocked car
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)
        
        booking_data = {
            "car_id": self.test_car_id,
            "user_name": "Test User",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "destination_notes": "Should fail - car is blocked"
        }
        
        success, response = self.run_test(
            "Test Booking Prevention on Blocked Car",
            "POST",
            "bookings",
            400,  # Should fail with 400
            data=booking_data,
            token=self.admin_token
        )
        
        if success:
            print("   ✅ Booking correctly prevented for blocked car")
        else:
            print("   ❌ Booking prevention failed - blocked car should not be bookable")
            return False

        return True

    def test_car_unblocking(self):
        """Test car unblocking functionality"""
        print("\n=== Testing Car Unblocking ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False

        if not self.test_car_id:
            print("❌ No test car available for unblocking")
            return False

        # Unblock the car
        unblock_data = {
            "sign_off_notes": "Service completed successfully"
        }
        
        success, response = self.run_test(
            "Unblock Car with Sign-off",
            "POST",
            f"cars/{self.test_car_id}/unblock",
            200,
            data=unblock_data,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Verify car is unblocked
        success, car_response = self.run_test(
            "Verify Car is Unblocked",
            "GET",
            f"cars/{self.test_car_id}",
            200
        )
        
        if success:
            if car_response.get('is_blocked') == False and car_response.get('block_reason') is None:
                print("   ✅ Car successfully unblocked")
            else:
                print(f"   ❌ Car unblocking verification failed: is_blocked={car_response.get('is_blocked')}, reason={car_response.get('block_reason')}")
                return False
        else:
            return False

        return True

    def test_blocked_car_booking_prevention(self):
        """Test booking prevention specifically for Toyota Aygo (M) which should be blocked"""
        print("\n=== Testing Blocked Car Booking Prevention ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False

        # Get all cars to find Toyota Aygo
        success, cars_response = self.run_test(
            "Get All Cars to Find Toyota Aygo",
            "GET",
            "cars",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False

        toyota_aygo_id = None
        for car in cars_response:
            if "Toyota Aygo" in car.get('name', ''):
                toyota_aygo_id = car['id']
                print(f"   Found Toyota Aygo with ID: {toyota_aygo_id}")
                print(f"   Blocked status: {car.get('is_blocked')}, Reason: {car.get('block_reason')}")
                break
        
        if not toyota_aygo_id:
            print("   ⚠️  Toyota Aygo (M) not found in database")
            return True  # Not a failure, just not present

        # Try to book the Toyota Aygo
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)
        
        booking_data = {
            "car_id": toyota_aygo_id,
            "user_name": "Test User",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "destination_notes": "Should fail if car is blocked"
        }
        
        success, response = self.run_test(
            "Test Booking Toyota Aygo (Should Fail if Blocked)",
            "POST",
            "bookings",
            400,  # Should fail with 400 if blocked
            data=booking_data,
            token=self.admin_token
        )
        
        if success:
            print("   ✅ Toyota Aygo booking correctly prevented (car is blocked)")
        else:
            print("   ⚠️  Toyota Aygo booking was allowed (car may not be blocked)")

        return True
    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_car_crud(self):
        """Test Car CRUD operations with compliance dates"""
        print("\n=== Testing Car CRUD Operations ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        # Create a car with compliance dates
        future_date = (datetime.now() + timedelta(days=15)).isoformat()
        car_data = {
            "name": f"Test Car {datetime.now().strftime('%H%M%S')}",
            "registration": f"TEST-{datetime.now().strftime('%H%M%S')}",
            "current_status": "Free",
            "tax_due_date": future_date,
            "nct_due_date": future_date,
            "service_due_date": future_date
        }
        
        success, response = self.run_test(
            "Create Car with Compliance Dates",
            "POST",
            "cars",
            200,
            data=car_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.test_car_id = response['id']
            print(f"   Created car with ID: {self.test_car_id}")
            print(f"   Compliance dates set for: {future_date}")
        else:
            return False

        # Get all cars
        success, response = self.run_test(
            "Get All Cars",
            "GET",
            "cars",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Get specific car
        success, response = self.run_test(
            "Get Car by ID",
            "GET",
            f"cars/{self.test_car_id}",
            200
        )
        
        if not success:
            return False

        # Update car
        update_data = {
            "name": car_data["name"] + " Updated",
            "registration": car_data["registration"],
            "current_status": "In Use",
            "tax_due_date": car_data["tax_due_date"],
            "nct_due_date": car_data["nct_due_date"],
            "service_due_date": car_data["service_due_date"]
        }
        
        success, response = self.run_test(
            "Update Car",
            "PUT",
            f"cars/{self.test_car_id}",
            200,
            data=update_data,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Test QR code generation
        success, response = self.run_test(
            "Get Car QR Code",
            "GET",
            f"cars/{self.test_car_id}/qr",
            200
        )
        
        return success

    def test_status_operations(self):
        """Test Status Update operations"""
        print("\n=== Testing Status Update Operations ===")
        
        if not self.test_car_id:
            print("❌ No test car available for status testing")
            return False

        # Create status update
        status_data = {
            "car_id": self.test_car_id,
            "status": "Needs Cleaning",
            "notes": "Test status update",
            "user_name": "Test User"
        }
        
        success, response = self.run_test(
            "Create Status Update",
            "POST",
            "status",
            200,
            data=status_data
        )
        
        if not success:
            return False

        # Get live status
        success, response = self.run_test(
            "Get Live Status",
            "GET",
            "status/live",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Get status history
        success, response = self.run_test(
            "Get Status History",
            "GET",
            f"status/history/{self.test_car_id}",
            200,
            token=self.admin_token
        )
        
        return success

    def test_booking_operations(self):
        """Test Booking operations with conflict detection"""
        print("\n=== Testing Booking Operations ===")
        
        if not self.test_car_id:
            print("❌ No test car available for booking testing")
            return False

        # Create a booking
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=2)
        
        booking_data = {
            "car_id": self.test_car_id,
            "user_name": "Test User",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "destination_notes": "Test destination"
        }
        
        success, response = self.run_test(
            "Create Booking",
            "POST",
            "bookings",
            200,
            data=booking_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.test_booking_id = response['id']
            print(f"   Created booking with ID: {self.test_booking_id}")
        else:
            return False

        # Test conflict detection - try to create overlapping booking
        conflict_booking = {
            "car_id": self.test_car_id,
            "user_name": "Conflict User",
            "start_time": (start_time + timedelta(minutes=30)).isoformat(),
            "end_time": (end_time + timedelta(minutes=30)).isoformat(),
            "destination_notes": "Conflicting booking"
        }
        
        success, response = self.run_test(
            "Test Booking Conflict Detection",
            "POST",
            "bookings",
            409,  # Expecting conflict error
            data=conflict_booking,
            token=self.admin_token
        )
        
        if not success:
            print("❌ Conflict detection failed - should have returned 409")
            return False

        # Get all bookings
        success, response = self.run_test(
            "Get All Bookings",
            "GET",
            "bookings",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Get bookings for specific car
        success, response = self.run_test(
            "Get Car Bookings",
            "GET",
            f"bookings/car/{self.test_car_id}",
            200,
            token=self.admin_token
        )
        
        return success

    def test_assistance_operations(self):
        """Test Assistance Provider operations"""
        print("\n=== Testing Assistance Provider Operations ===")
        
        # Create assistance provider
        provider_data = {
            "region": "Kerry",
            "name": f"Test Provider {datetime.now().strftime('%H%M%S')}",
            "phone": "+353-87-1234567",
            "service_type": "Breakdown"
        }
        
        success, response = self.run_test(
            "Create Assistance Provider",
            "POST",
            "assistance",
            200,
            data=provider_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.test_provider_id = response['id']
            print(f"   Created provider with ID: {self.test_provider_id}")
        else:
            return False

        # Get all providers
        success, response = self.run_test(
            "Get All Providers",
            "GET",
            "assistance",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Get providers by region
        success, response = self.run_test(
            "Get Providers by Region",
            "GET",
            "assistance/Kerry",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False

        # Update provider
        update_data = {
            "region": "West Cork",
            "name": provider_data["name"] + " Updated",
            "phone": provider_data["phone"],
            "service_type": "Towing"
        }
        
        success, response = self.run_test(
            "Update Provider",
            "PUT",
            f"assistance/{self.test_provider_id}",
            200,
            data=update_data,
            token=self.admin_token
        )
        
        return success

    def test_lift_request_operations(self):
        """Test Lift Request CRUD operations"""
        print("\n=== Testing Lift Request Operations ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False

        if not self.staff_token:
            print("❌ No staff token available")
            return False

        # Test 1: Create a lift request as staff
        lift_request_data = {
            "requester_name": "John Doe",
            "from_location": "Dublin",
            "to_location": "Cork",
            "lift_date": "2025-12-25",
            "lift_time": "10:00",
            "notes": "Need lift for business meeting"
        }
        
        success, response = self.run_test(
            "Create Lift Request (Staff)",
            "POST",
            "lift-requests",
            200,
            data=lift_request_data,
            token=self.staff_token
        )
        
        if success and 'id' in response:
            self.test_lift_request_id = response['id']
            print(f"   Created lift request with ID: {self.test_lift_request_id}")
            print(f"   Requester email set to: {response.get('requester_email')}")
            if response.get('requester_email') != 'staff@quickwing.com':
                print("   ❌ Requester email not set correctly from token")
                return False
        else:
            return False

        # Test 2: Get active lift requests
        success, response = self.run_test(
            "Get Active Lift Requests",
            "GET",
            "lift-requests",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Found {len(response)} active lift requests")
            # Verify our request is in the list
            found_request = False
            for req in response:
                if req.get('id') == self.test_lift_request_id:
                    found_request = True
                    print(f"   ✅ Found our test request: {req.get('requester_name')} from {req.get('from_location')} to {req.get('to_location')}")
                    break
            if not found_request:
                print("   ❌ Our test request not found in active requests")
                return False
        else:
            return False

        # Test 3: Get lift request count
        success, response = self.run_test(
            "Get Lift Request Count",
            "GET",
            "lift-requests/count",
            200,
            token=self.admin_token
        )
        
        if success:
            count = response.get('count', 0)
            print(f"   Active lift requests count: {count}")
            if count < 1:
                print("   ❌ Count should be at least 1 (our test request)")
                return False
        else:
            return False

        # Test 4: Try to accept own request (should fail)
        success, response = self.run_test(
            "Try to Accept Own Request (Should Fail)",
            "POST",
            f"lift-requests/{self.test_lift_request_id}/accept",
            400,  # Should fail
            token=self.staff_token
        )
        
        if success:
            print("   ✅ Correctly prevented accepting own request")
        else:
            print("   ❌ Should not allow accepting own request")
            return False

        # Test 5: Accept request as admin (different user)
        success, response = self.run_test(
            "Accept Lift Request (Admin)",
            "POST",
            f"lift-requests/{self.test_lift_request_id}/accept",
            200,
            token=self.admin_token
        )
        
        if success:
            print("   ✅ Admin successfully accepted the lift request")
        else:
            return False

        # Test 6: Verify request is no longer active
        success, response = self.run_test(
            "Verify Request No Longer Active",
            "GET",
            "lift-requests",
            200,
            token=self.admin_token
        )
        
        if success:
            # Our request should not be in active list anymore
            found_request = False
            for req in response:
                if req.get('id') == self.test_lift_request_id:
                    found_request = True
                    break
            if found_request:
                print("   ❌ Accepted request still appears in active list")
                return False
            else:
                print("   ✅ Accepted request correctly removed from active list")
        else:
            return False

        # Test 7: Create another request to test cancellation
        cancel_request_data = {
            "requester_name": "Jane Smith",
            "from_location": "Galway",
            "to_location": "Limerick",
            "lift_date": "2025-12-26",
            "lift_time": "14:00",
            "notes": "Christmas shopping trip"
        }
        
        success, response = self.run_test(
            "Create Second Lift Request for Cancellation Test",
            "POST",
            "lift-requests",
            200,
            data=cancel_request_data,
            token=self.staff_token
        )
        
        if success and 'id' in response:
            cancel_request_id = response['id']
            print(f"   Created second lift request with ID: {cancel_request_id}")
        else:
            return False

        # Test 8: Cancel the request as creator
        success, response = self.run_test(
            "Cancel Lift Request (Creator)",
            "DELETE",
            f"lift-requests/{cancel_request_id}",
            200,
            token=self.staff_token
        )
        
        if success:
            print("   ✅ Creator successfully cancelled their lift request")
        else:
            return False

        # Test 9: Try to cancel non-existent request
        success, response = self.run_test(
            "Try to Cancel Non-existent Request",
            "DELETE",
            f"lift-requests/{cancel_request_id}",
            404,  # Should fail - already deleted
            token=self.staff_token
        )
        
        if success:
            print("   ✅ Correctly returned 404 for non-existent request")
        else:
            print("   ❌ Should return 404 for non-existent request")
            return False

        # Test 10: Create request as admin and cancel as admin
        admin_request_data = {
            "requester_name": "Admin User",
            "from_location": "Waterford",
            "to_location": "Kilkenny",
            "lift_date": "2025-12-27",
            "lift_time": "09:00",
            "notes": "Admin test request"
        }
        
        success, response = self.run_test(
            "Create Lift Request as Admin",
            "POST",
            "lift-requests",
            200,
            data=admin_request_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            admin_request_id = response['id']
            print(f"   Created admin lift request with ID: {admin_request_id}")
        else:
            return False

        # Test 11: Admin can cancel any request
        success, response = self.run_test(
            "Admin Cancel Any Request",
            "DELETE",
            f"lift-requests/{admin_request_id}",
            200,
            token=self.admin_token
        )
        
        if success:
            print("   ✅ Admin successfully cancelled lift request")
        else:
            return False

        return True

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n=== Cleaning Up Test Data ===")
        
        # Delete test booking
        if self.test_booking_id:
            self.run_test(
                "Delete Test Booking",
                "DELETE",
                f"bookings/{self.test_booking_id}",
                200,
                token=self.admin_token
            )

        # Delete test provider
        if self.test_provider_id:
            self.run_test(
                "Delete Test Provider",
                "DELETE",
                f"assistance/{self.test_provider_id}",
                200,
                token=self.admin_token
            )

        # Delete test car
        if self.test_car_id:
            self.run_test(
                "Delete Test Car",
                "DELETE",
                f"cars/{self.test_car_id}",
                200,
                token=self.admin_token
            )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Fleet Management API Tests")
        print(f"Testing against: {self.base_url}")
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed, stopping tests")
            return False

        # Authenticate as admin
        if not self.authenticate_admin():
            print("❌ Admin authentication failed, stopping tests")
            return False

        # Authenticate as staff
        if not self.authenticate_staff():
            print("❌ Staff authentication failed, stopping tests")
            return False

        # Test all CRUD operations
        tests = [
            self.test_car_crud,
            self.test_compliance_alerts,
            self.test_car_blocking,
            self.test_car_unblocking,
            self.test_blocked_car_booking_prevention,
            self.test_status_operations,
            self.test_booking_operations,
            self.test_assistance_operations,
            self.test_lift_request_operations
        ]
        
        for test in tests:
            if not test():
                print(f"❌ Test {test.__name__} failed")
                break

        # Cleanup
        self.cleanup_test_data()

        # Print results
        print(f"\n📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = FleetManagementAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())