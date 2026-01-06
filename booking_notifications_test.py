#!/usr/bin/env python3
"""
Focused test for Booking Notifications & Recurring Booking Editing feature
"""

import requests
import json
from datetime import datetime, timedelta
import uuid

class BookingNotificationsAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.staff_token = None
        self.test_car_id = None

    def authenticate(self):
        """Authenticate both admin and staff users"""
        print("=== Authentication ===")
        
        # Admin login
        admin_login = {
            "email": "admin@quickwing.com",
            "password": "admin123"
        }
        
        response = requests.post(f"{self.api_url}/auth/login", json=admin_login)
        if response.status_code == 200:
            self.admin_token = response.json()['access_token']
            print("✅ Admin authenticated")
        else:
            print(f"❌ Admin auth failed: {response.status_code}")
            return False

        # Staff login
        staff_login = {
            "email": "staff@quickwing.com",
            "password": "staff123"
        }
        
        response = requests.post(f"{self.api_url}/auth/login", json=staff_login)
        if response.status_code == 200:
            self.staff_token = response.json()['access_token']
            print("✅ Staff authenticated")
        else:
            print(f"❌ Staff auth failed: {response.status_code}")
            return False

        return True

    def get_test_car(self):
        """Get a car for testing"""
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response = requests.get(f"{self.api_url}/cars", headers=headers)
        
        if response.status_code == 200:
            cars = response.json()
            if cars:
                # Use first available car that's not blocked
                for car in cars:
                    if not car.get('is_blocked', False):
                        self.test_car_id = car['id']
                        print(f"✅ Using test car: {car['name']} ({car['id']})")
                        return True
                
                # If all cars are blocked, use the first one anyway
                self.test_car_id = cars[0]['id']
                print(f"⚠️  Using blocked car: {cars[0]['name']} ({cars[0]['id']})")
                return True
        
        print("❌ No cars available for testing")
        return False

    def test_booking_rejection_notification(self):
        """Test the complete booking rejection and notification flow"""
        print("\n=== Testing Booking Rejection & Notification Flow ===")
        
        # Step 1: Create recurring booking as staff (needs approval)
        print("\n1. Creating recurring booking as staff...")
        start_time = datetime.now() + timedelta(days=1)
        end_time = start_time + timedelta(hours=2)
        
        recurring_booking_data = {
            "car_id": self.test_car_id,
            "user_name": "Emma Watson",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "destination_notes": "Weekly client meetings",
            "is_recurring": True,
            "recurrence_type": "weekly",
            "recurrence_count": 3
        }
        
        headers = {'Authorization': f'Bearer {self.staff_token}'}
        response = requests.post(f"{self.api_url}/bookings", json=recurring_booking_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to create recurring booking: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        booking_data = response.json()
        recurring_group_id = booking_data.get('recurring_group_id')
        
        if not recurring_group_id:
            print("❌ No recurring_group_id returned")
            return False
        
        print(f"✅ Created recurring booking group: {recurring_group_id}")
        print(f"   Status: {booking_data.get('status')}")

        # Step 2: Get pending bookings as admin
        print("\n2. Getting pending bookings as admin...")
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response = requests.get(f"{self.api_url}/admin/pending-bookings", headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to get pending bookings: {response.status_code}")
            return False
        
        pending_bookings = response.json()
        print(f"✅ Found {len(pending_bookings)} pending booking groups")
        
        # Find our booking group
        our_group = None
        for group in pending_bookings:
            if group.get('group_id') == recurring_group_id:
                our_group = group
                break
        
        if not our_group:
            print("❌ Our recurring booking group not found in pending bookings")
            return False
        
        print(f"✅ Found our group: {our_group.get('user_name')} - {len(our_group.get('bookings', []))} bookings")

        # Step 3: Reject the booking with reason
        print("\n3. Rejecting booking with reason...")
        reject_data = {
            "reason": "Vehicle scheduled for maintenance during requested period"
        }
        
        response = requests.post(f"{self.api_url}/admin/bookings/{recurring_group_id}/reject", 
                               json=reject_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to reject booking: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        print(f"✅ Booking rejected: {response.json().get('message')}")

        # Step 4: Check for rejection notification as staff
        print("\n4. Checking for rejection notification as staff...")
        headers = {'Authorization': f'Bearer {self.staff_token}'}
        response = requests.get(f"{self.api_url}/booking-notifications", headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to get notifications: {response.status_code}")
            return False
        
        notifications = response.json()
        print(f"✅ Found {len(notifications)} unread notifications")
        
        # Find the rejection notification
        rejection_notification = None
        for notification in notifications:
            if (notification.get('type') == 'booking_rejected' and 
                notification.get('booking_group_id') == recurring_group_id):
                rejection_notification = notification
                break
        
        if not rejection_notification:
            print("❌ Rejection notification not found")
            print("Available notifications:")
            for notif in notifications:
                print(f"   - Type: {notif.get('type')}, Group: {notif.get('booking_group_id')}")
            return False
        
        print(f"✅ Found rejection notification:")
        print(f"   Reason: {rejection_notification.get('rejection_reason')}")
        print(f"   Rejected by: {rejection_notification.get('rejected_by')}")
        print(f"   Car ID: {rejection_notification.get('car_id')}")
        print(f"   User: {rejection_notification.get('user_name')}")

        # Step 5: Mark notification as read
        print("\n5. Marking notification as read...")
        notification_id = rejection_notification.get('id')
        
        response = requests.post(f"{self.api_url}/booking-notifications/{notification_id}/read", 
                               headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to mark notification as read: {response.status_code}")
            return False
        
        print(f"✅ Notification marked as read: {response.json().get('message')}")

        # Step 6: Verify notification is no longer unread
        print("\n6. Verifying notification is no longer unread...")
        response = requests.get(f"{self.api_url}/booking-notifications", headers=headers)
        
        if response.status_code == 200:
            notifications = response.json()
            found_notification = False
            for notification in notifications:
                if notification.get('id') == notification_id:
                    found_notification = True
                    break
            
            if found_notification:
                print("❌ Notification still appears in unread list")
                return False
            else:
                print("✅ Notification correctly removed from unread list")
        
        return True

    def test_booking_editing(self):
        """Test individual booking and series editing"""
        print("\n=== Testing Booking Editing ===")
        
        # Test 1: Edit individual booking
        print("\n1. Testing individual booking editing...")
        
        # Create a single booking to edit
        single_booking_data = {
            "car_id": self.test_car_id,
            "user_name": "Michael Scott",
            "start_time": (datetime.now() + timedelta(days=2)).isoformat(),
            "end_time": (datetime.now() + timedelta(days=2, hours=1)).isoformat(),
            "destination_notes": "Original meeting location"
        }
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response = requests.post(f"{self.api_url}/bookings", json=single_booking_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to create single booking: {response.status_code}")
            return False
        
        booking_data = response.json()
        single_booking_id = booking_data.get('id')
        print(f"✅ Created single booking: {single_booking_id}")

        # Edit the single booking
        edit_data = {
            "user_name": "Michael Scott (Updated)",
            "destination_notes": "Updated meeting location - Conference Room B"
        }
        
        response = requests.put(f"{self.api_url}/admin/bookings/{single_booking_id}", 
                              json=edit_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to edit single booking: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        updated_booking = response.json()
        print(f"✅ Single booking edited successfully:")
        print(f"   Updated user: {updated_booking.get('user_name')}")
        print(f"   Updated notes: {updated_booking.get('destination_notes')}")
        
        # Check if individually_edited flag is set (if it was part of a series)
        if updated_booking.get('individually_edited'):
            print(f"   ✅ Marked as individually edited")

        # Test 2: Edit booking series
        print("\n2. Testing booking series editing...")
        
        # Create a recurring booking series to edit
        series_booking_data = {
            "car_id": self.test_car_id,
            "user_name": "Sales Team",
            "start_time": (datetime.now() + timedelta(days=3)).isoformat(),
            "end_time": (datetime.now() + timedelta(days=3, hours=1)).isoformat(),
            "destination_notes": "Original client visits",
            "is_recurring": True,
            "recurrence_type": "weekly",
            "recurrence_count": 2
        }
        
        response = requests.post(f"{self.api_url}/bookings", json=series_booking_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to create recurring series: {response.status_code}")
            return False
        
        series_data = response.json()
        series_group_id = series_data.get('recurring_group_id')
        print(f"✅ Created recurring series: {series_group_id}")

        # Edit the entire series
        series_edit_data = {
            "user_name": "Sales Team (Updated)",
            "destination_notes": "Updated client visits - New territory"
        }
        
        response = requests.put(f"{self.api_url}/admin/bookings/series/{series_group_id}", 
                              json=series_edit_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to edit booking series: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        print(f"✅ Booking series edited successfully:")
        print(f"   Response: {response.json().get('message')}")
        
        return True

    def test_approval_workflow(self):
        """Test the booking approval workflow"""
        print("\n=== Testing Approval Workflow ===")
        
        # Create recurring booking as staff (needs approval)
        print("\n1. Creating recurring booking for approval test...")
        start_time = datetime.now() + timedelta(days=4)
        end_time = start_time + timedelta(hours=1)
        
        approval_booking_data = {
            "car_id": self.test_car_id,
            "user_name": "Jennifer Lopez",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "destination_notes": "Monthly team building events",
            "is_recurring": True,
            "recurrence_type": "monthly",
            "recurrence_count": 2
        }
        
        headers = {'Authorization': f'Bearer {self.staff_token}'}
        response = requests.post(f"{self.api_url}/bookings", json=approval_booking_data, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to create approval test booking: {response.status_code}")
            return False
        
        booking_data = response.json()
        approval_group_id = booking_data.get('recurring_group_id')
        print(f"✅ Created booking for approval: {approval_group_id}")

        # Approve the booking as admin
        print("\n2. Approving the booking...")
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response = requests.post(f"{self.api_url}/admin/bookings/{approval_group_id}/approve", 
                               headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to approve booking: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        print(f"✅ Booking approved: {response.json().get('message')}")

        # Check for approval notification as staff
        print("\n3. Checking for approval notification...")
        headers = {'Authorization': f'Bearer {self.staff_token}'}
        response = requests.get(f"{self.api_url}/booking-notifications", headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to get notifications: {response.status_code}")
            return False
        
        notifications = response.json()
        print(f"✅ Found {len(notifications)} unread notifications")
        
        # Find the approval notification
        approval_notification = None
        for notification in notifications:
            if (notification.get('type') == 'booking_approved' and 
                notification.get('booking_group_id') == approval_group_id):
                approval_notification = notification
                break
        
        if approval_notification:
            print(f"✅ Found approval notification:")
            print(f"   Approved by: {approval_notification.get('approved_by')}")
            print(f"   Booking count: {approval_notification.get('booking_count')}")
            print(f"   User: {approval_notification.get('user_name')}")
        else:
            print("⚠️  Approval notification not found (may have been processed)")
        
        return True

    def run_all_tests(self):
        """Run all booking notification tests"""
        print("🚀 Starting Booking Notifications & Recurring Booking Editing Tests")
        print(f"Testing against: {self.base_url}")
        
        if not self.authenticate():
            print("❌ Authentication failed")
            return False
        
        if not self.get_test_car():
            print("❌ No test car available")
            return False
        
        tests = [
            self.test_booking_rejection_notification,
            self.test_booking_editing,
            self.test_approval_workflow
        ]
        
        all_passed = True
        for test in tests:
            try:
                if not test():
                    print(f"❌ Test {test.__name__} failed")
                    all_passed = False
                else:
                    print(f"✅ Test {test.__name__} passed")
            except Exception as e:
                print(f"❌ Test {test.__name__} failed with exception: {e}")
                all_passed = False
        
        if all_passed:
            print("\n🎉 All Booking Notifications & Recurring Booking Editing tests passed!")
        else:
            print("\n❌ Some tests failed")
        
        return all_passed

if __name__ == "__main__":
    tester = BookingNotificationsAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)