import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class FleetManagementAPITester:
    def __init__(self, base_url="https://page-maker-117.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_car_id = None
        self.test_booking_id = None
        self.test_provider_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

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
        """Test Car CRUD operations"""
        print("\n=== Testing Car CRUD Operations ===")
        
        # Create a car
        car_data = {
            "name": f"Test Car {datetime.now().strftime('%H%M%S')}",
            "registration": f"TEST-{datetime.now().strftime('%H%M%S')}",
            "current_status": "Free"
        }
        
        success, response = self.run_test(
            "Create Car",
            "POST",
            "cars",
            200,
            data=car_data
        )
        
        if success and 'id' in response:
            self.test_car_id = response['id']
            print(f"   Created car with ID: {self.test_car_id}")
        else:
            return False

        # Get all cars
        success, response = self.run_test(
            "Get All Cars",
            "GET",
            "cars",
            200
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
            "current_status": "In Use"
        }
        
        success, response = self.run_test(
            "Update Car",
            "PUT",
            f"cars/{self.test_car_id}",
            200,
            data=update_data
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
            200
        )
        
        if not success:
            return False

        # Get status history
        success, response = self.run_test(
            "Get Status History",
            "GET",
            f"status/history/{self.test_car_id}",
            200,
            params={"limit": 10}
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
            data=booking_data
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
            data=conflict_booking
        )
        
        if not success:
            print("❌ Conflict detection failed - should have returned 409")
            return False

        # Get all bookings
        success, response = self.run_test(
            "Get All Bookings",
            "GET",
            "bookings",
            200
        )
        
        if not success:
            return False

        # Get bookings for specific car
        success, response = self.run_test(
            "Get Car Bookings",
            "GET",
            f"bookings/car/{self.test_car_id}",
            200
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
            data=provider_data
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
            200
        )
        
        if not success:
            return False

        # Get providers by region
        success, response = self.run_test(
            "Get Providers by Region",
            "GET",
            "assistance/Kerry",
            200
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
            data=update_data
        )
        
        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n=== Cleaning Up Test Data ===")
        
        # Delete test booking
        if self.test_booking_id:
            self.run_test(
                "Delete Test Booking",
                "DELETE",
                f"bookings/{self.test_booking_id}",
                200
            )

        # Delete test provider
        if self.test_provider_id:
            self.run_test(
                "Delete Test Provider",
                "DELETE",
                f"assistance/{self.test_provider_id}",
                200
            )

        # Delete test car
        if self.test_car_id:
            self.run_test(
                "Delete Test Car",
                "DELETE",
                f"cars/{self.test_car_id}",
                200
            )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Fleet Management API Tests")
        print(f"Testing against: {self.base_url}")
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed, stopping tests")
            return False

        # Test all CRUD operations
        tests = [
            self.test_car_crud,
            self.test_status_operations,
            self.test_booking_operations,
            self.test_assistance_operations
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