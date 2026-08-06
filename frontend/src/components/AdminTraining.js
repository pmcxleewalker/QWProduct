import React, { useState } from 'react';
import { 
  X, ChevronRight, ChevronLeft, CheckCircle, Users, Car, Calendar, 
  BarChart3, Settings, FileText, QrCode, Shield, Bell, HelpCircle,
  Play, BookOpen, Lightbulb, Crown, Star, Lock
} from 'lucide-react';

const AdminTraining = ({ isOpen, onClose, franchiseName, planData }) => {
  const [currentModule, setCurrentModule] = useState(0);
  const [completedModules, setCompletedModules] = useState([]);
  const [showVideo, setShowVideo] = useState(false);
  
  // Get tier info
  const planId = planData?.plan?.id || 'standard';
  const planName = planData?.plan?.name || 'Standard';
  const features = planData?.features || {};
  
  // Tier styling
  const tierStyles = {
    standard: { color: 'gray', icon: '🚗', badge: 'bg-gray-600' },
    essential: { color: 'blue', icon: '⭐', badge: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
    professional: { color: 'purple', icon: '👑', badge: 'bg-gradient-to-r from-purple-600 to-pink-600' }
  };
  const tierStyle = tierStyles[planId] || tierStyles.standard;

  const modules = [
    {
      id: 'welcome',
      title: 'Welcome to Quick Wing',
      icon: BookOpen,
      color: tierStyle.color,
      content: {
        heading: `Welcome to ${franchiseName || 'Your Franchise'}!`,
        description: `You're on the ${planName} plan. This training guide will help you get the most out of your fleet management system.`,
        sections: [
          {
            title: `Your ${planName} Plan Includes`,
            items: [
              `Up to ${planData?.limits?.max_vehicles || 10} vehicles`,
              `Up to ${planData?.limits?.max_users || 20} team members`,
              features.enhanced_reports ? '✅ Enhanced Reports' : '❌ Enhanced Reports (upgrade to Essential)',
              features.detailed_reports ? '✅ Detailed Analytics' : '❌ Detailed Analytics (upgrade to Professional)',
              features.cost_analytics ? '✅ Cost Analytics (customizable rates)' : '❌ Cost Analytics (Professional only)',
              features.priority_support ? '✅ Priority Support' : '❌ Priority Support (Professional only)'
            ]
          },
          {
            title: 'Your Role as Admin',
            items: [
              'Full access to all franchise features within your plan',
              'Ability to create and manage user accounts',
              'Vehicle fleet management and compliance tracking',
              'Booking oversight and reporting'
            ]
          }
        ],
        tip: planId === 'standard' 
          ? 'Upgrade to Essential for enhanced reports and booking controls!' 
          : planId === 'essential'
          ? 'Upgrade to Professional for cost analytics and custom branding!'
          : 'You have access to all premium features!'
      }
    },
    {
      id: 'users',
      title: 'Managing Users',
      icon: Users,
      color: 'green',
      content: {
        heading: 'Adding & Managing Team Members',
        description: `Your ${planName} plan allows up to ${planData?.limits?.max_users || 20} team members.`,
        sections: [
          {
            title: 'Adding a New Team Member',
            steps: [
              'Go to your Dashboard and click the "Team" tab',
              'Click the "Add Member" button',
              'Enter the team member\'s name and email',
              'Select their role: Admin or Staff',
              'Click "Add Member" - a temporary password will be generated',
              'Share the login credentials with your team member'
            ]
          },
          {
            title: 'User Roles Explained',
            items: [
              'Admin: Full access to vehicles, bookings, team management, and reports',
              'Staff: Can view fleet status, make bookings, and request lifts'
            ]
          },
          {
            title: 'Managing Existing Users',
            items: [
              'View all users in Admin Panel → Team tab',
              'Change user roles using the dropdown',
              'Reset passwords for staff members (requires your admin password)',
              'Remove users who no longer need access'
            ]
          }
        ],
        tip: `You're using ${planData?.usage?.users || 0} of ${planData?.limits?.max_users || 20} available user slots.`
      }
    },
    {
      id: 'vehicles',
      title: 'Fleet Management',
      icon: Car,
      color: 'purple',
      content: {
        heading: 'Setting Up Your Vehicle Fleet',
        description: `Your ${planName} plan allows up to ${planData?.limits?.max_vehicles || 10} vehicles.`,
        sections: [
          {
            title: 'Adding a New Vehicle',
            steps: [
              'Go to Admin Panel → Fleet tab',
              'Click "Add Car" button',
              'Enter vehicle name (e.g., "Ford Transit Van 1")',
              'Enter registration number',
              'Add optional details: mileage, service due date, tax expiry',
              'Click "Add Vehicle" to save'
            ]
          },
          {
            title: 'Vehicle Compliance Tracking',
            items: [
              'Set tax expiry dates - alerts appear when due within 30 days',
              'Track service intervals - get notified when service is due',
              'Monitor current mileage for each vehicle',
              'Compliance alerts show on your main dashboard',
              'Pair with the Car Inspection Sheet (see Documents) to log the walk-around each morning'
            ]
          },
          {
            title: 'QR Codes',
            items: [
              'Click the QR button on any vehicle card',
              'Print and attach to vehicle dashboard',
              'Staff can scan to quickly book or update vehicle status',
              'QR codes link directly to that specific vehicle'
            ]
          },
          {
            title: 'Blocking Vehicles',
            items: [
              'Use "Block for Appointment" for vehicles in service',
              'Blocked vehicles cannot be booked by staff',
              'Shows red "Blocked" status in Live Fleet view'
            ]
          }
        ],
        tip: 'Keep compliance dates updated to receive timely alerts and avoid missed renewals.'
      }
    },
    {
      id: 'bookings',
      title: 'Managing Bookings',
      icon: Calendar,
      color: 'orange',
      content: {
        heading: 'Booking System Overview',
        description: 'Learn how to create, manage, and view all vehicle bookings.',
        sections: [
          {
            title: 'Creating a Booking',
            steps: [
              'Go to the Bookings page',
              'Click "New Booking" or click on a time slot',
              'Select the vehicle you want to book',
              'Choose start and end date/time',
              'Add booking details (customer name, location, notes)',
              'Check "Double Up Call" if multiple passengers sharing',
              'Click "Create Booking" to confirm'
            ]
          },
          {
            title: 'Calendar Views',
            items: [
              'Day View: See hourly slots for all vehicles',
              'Week View: Overview of the entire week',
              'Month View: Long-term booking planning',
              'Filter by specific vehicles using the dropdown'
            ]
          },
          {
            title: 'Booking Status Colors',
            items: [
              'Green: Available/Free time slots',
              'Orange: Booked - confirmed booking',
              'Purple: Recurring booking',
              'Red: Blocked/Unavailable'
            ]
          },
          {
            title: 'Managing Existing Bookings',
            items: [
              'Click on any booking to view details',
              'Edit bookings to change times or details',
              'Cancel bookings when needed',
              'View booking history in reports'
            ]
          }
        ],
        tip: 'Use recurring bookings for regular customers to save time on repeat entries.'
      }
    },
    {
      id: 'livesheet',
      title: 'Live Fleet Sheet',
      icon: FileText,
      color: 'teal',
      content: {
        heading: 'Real-Time Fleet Monitoring',
        description: 'Track all your vehicles in real-time with the Live Sheet.',
        sections: [
          {
            title: 'Understanding the Live Sheet',
            items: [
              'Shows current status of every vehicle',
              'Updates automatically every 30 seconds',
              'Status counters at the top for quick overview',
              'Sortable columns for easy filtering'
            ]
          },
          {
            title: 'Status Types',
            items: [
              'Free: Vehicle available for booking',
              'Booked: Has upcoming reservation',
              'In Use: Currently on a job',
              'Blocked: Not available (service/repair)',
              'Needs Cleaning: Requires attention',
              'Needs Repair: Maintenance required'
            ]
          },
          {
            title: 'Exporting Data',
            items: [
              'Click "Export Excel" to download current status',
              'Useful for daily reports and records',
              'Includes all vehicle details and status'
            ]
          }
        ],
        tip: 'Check the Live Sheet first thing each morning to see your fleet status at a glance.'
      }
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      icon: BarChart3,
      color: 'indigo',
      content: {
        heading: 'Using Reports Effectively',
        description: 'Generate reports to track performance and make data-driven decisions.',
        sections: [
          {
            title: 'Available Reports',
            items: [
              'Executive Summary: Overview of fleet performance',
              'Fleet Reports: Vehicle utilisation and history',
              'Booking Reports: Booking patterns and statistics',
              'User Activity: Staff performance tracking',
              'Incident Reports: Damage, accidents and near-misses (Documents tab)',
              'Inspection Log: Daily Car Inspection Sheet submissions per vehicle'
            ]
          },
          {
            title: 'Generating Reports',
            steps: [
              'Navigate to the Reports page',
              'Select the report type you need',
              'Choose date range (From/To dates)',
              'Click "Apply Dates" to generate',
              'Use "Export CSV" or "Export PDF" to download'
            ]
          },
          {
            title: 'Report Export Options',
            items: [
              'CSV: Open in Excel for further analysis',
              'PDF: Professional format for sharing/printing',
              'Branded with Quick Wing logo and your franchise name'
            ]
          },
          {
            title: 'Key Metrics to Track',
            items: [
              'Utilisation % — hours booked ÷ hours available, per vehicle',
              'Idle days — days since each vehicle was last used',
              'Peak hours & day-of-week heatmap — spot where you\'re short of cars',
              'Cost per km — from Cost Analytics (running cost × distance)',
              'Cost per booking — average spend per journey',
              'Compliance countdown — tax, service, insurance and driver licence expiries in the next 30/60 days',
              'Inspection compliance % — vehicles inspected in the last 7 days',
              'Incident rate — incidents per 1,000 km, split by type and vehicle',
              'Cancellation / no-show rate — bookings cancelled vs completed',
              'Downtime days — days in "Blocked" or "Needs Repair" per month',
              'Top drivers — most km / most bookings this month',
              'Booked vs actual km — planned mileage vs odometer readings from inspections'
            ]
          }
        ],
        tip: 'Run a weekly Utilisation + Compliance report every Monday. If any vehicle is under 40% utilised for two weeks running, consider reallocating or downsizing.'
      }
    },
    {
      id: 'documents',
      title: 'Documents & Inspections',
      icon: FileText,
      color: 'blue',
      content: {
        heading: 'Custom Documents, Inspections & Incidents',
        description: 'Design forms for your team to submit from their phone. Everything lands in the Documents Inbox for you to review.',
        sections: [
          {
            title: 'Built-in Car Inspection Sheet',
            items: [
              '14-point pre-trip check (tyres, lights, fluids, brakes, wipers, interior, etc.)',
              'Records odometer reading and overall condition',
              'Staff can attach up to 5 photos of damage or defects',
              'Free-text field for any issues noted'
            ]
          },
          {
            title: 'Inspection Reminders (per-vehicle)',
            items: [
              'Open Fleet → Manage Vehicles → Edit and set "Inspection Reminder (days)"',
              'e.g. 7 = weekly walk-around; 1 = daily pre-trip check',
              'Leave blank or 0 to disable reminders for a specific vehicle',
              'Any vehicle whose next check is overdue (or due within 24h) appears in "Inspection Reminders" on the Overview dashboard',
              'Staff can still book overdue vehicles — the reminder is just a nudge for admins'
            ]
          },
          {
            title: 'Reviewing Submissions',
            steps: [
              'Go to Dashboard → Documents tab',
              'Documents Inbox lists every submission newest-first, grouped by day',
              'Filter by document type or search by staff/vehicle',
              'Click any row to see the full submission with photos',
              'Delete a submission if it was entered in error'
            ]
          },
          {
            title: 'Creating Your Own Templates',
            steps: [
              'Click "New template" on the Documents tab',
              'Give it a name and description (e.g. "Weekly Deep Clean")',
              'Add fields — text, number, date, dropdown, checkbox, vehicle picker, or photo (up to 5 per field)',
              'Toggle "Visible to staff" when you\'re ready to go live',
              'Staff see it instantly on their mobile Docs tab'
            ]
          },
          {
            title: 'Incident Reports',
            items: [
              'Staff tap "Report Incident" from their Docs tab to flag damage, accidents, breakdowns or near-misses',
              'Photos are compressed and attached automatically',
              'Admins get a red-badge notification on the Documents tab',
              'Every incident is timestamped, vehicle-linked and driver-linked for audit'
            ]
          }
        ],
        tip: 'Make the Car Inspection Sheet part of the morning routine. It creates a paper trail if damage is disputed later.'
      }
    },
    {
      id: 'gps',
      title: 'GPS Trackers',
      icon: QrCode,
      color: 'teal',
      content: {
        heading: 'SinoTrack GPS Bridge',
        description: 'Link a SinoTrack tracker to any vehicle to see its live position, journey history and driver behaviour.',
        sections: [
          {
            title: 'Adding a Tracker',
            steps: [
              'Go to Admin Panel → Trackers',
              'Click "Add Tracker" and enter the IMEI number (printed on the device)',
              'Assign it to a vehicle from the dropdown',
              'Save — the system verifies with SinoTrack and starts polling every 30 seconds'
            ]
          },
          {
            title: 'What You Get',
            items: [
              'Live map with every tracked vehicle plotted in real time',
              'Journey playback — replay any trip from the last 30 days',
              'Driver behaviour — harsh braking, harsh acceleration and speeding events',
              'Alerts — SOS, low battery, geofence exit',
              'Strict tenant isolation — trackers only visible inside your franchise'
            ]
          },
          {
            title: 'Tips',
            items: [
              'Pair GPS data with the Car Inspection Sheet for a full daily audit',
              'Use journey playback to resolve customer or staff disputes',
              'Set geofences around your depot to spot vehicles leaving out of hours'
            ]
          }
        ],
        tip: 'One active tracker per car. If you swap devices, deactivate the old one first so history stays clean.'
      }
    },
    {
      id: 'advanced',
      title: 'Advanced Features',
      icon: Settings,
      color: 'rose',
      content: {
        heading: 'Additional Features & Tips',
        description: 'Master these advanced features to get the most from Quick Wing.',
        sections: [
          {
            title: 'Lift Requests',
            items: [
              'Staff can request lifts from colleagues',
              'Requests appear as notifications for all users',
              'Accept or dismiss requests from the notification panel',
              'Great for carpooling and resource sharing'
            ]
          },
          {
            title: 'Push Notifications',
            items: [
              'Enable browser notifications for real-time alerts',
              'Get notified of new bookings, lift requests, updates',
              'Toggle on/off from the navigation bar'
            ]
          },
          {
            title: 'Staff Mobile App',
            items: [
              'Staff log in on their phone and get a dedicated mobile view',
              'Monthly calendar shows their bookings with a blue dot on booked days',
              'They can submit inspections and incident reports directly from the Docs tab',
              'A lock icon in the header pins the zoom level so the screen never accidentally scales — tap once to unlock pinch-to-zoom on small phones'
            ]
          },
          {
            title: 'Assistance/Breakdown Directory',
            items: [
              'Access emergency contacts from Assistance page',
              'Click-to-call functionality for quick contact',
              'Organized by location for easy reference'
            ]
          },
          {
            title: 'Best Practices',
            items: [
              'Update vehicle status promptly after each job',
              'Keep compliance dates current',
              'Review Live Sheet at start and end of each day',
              'Run weekly reports for insights',
              'Train all staff on the booking system'
            ]
          }
        ],
        tip: 'Need help? Contact support or refer back to this training guide anytime.'
      }
    }
  ];

  const markModuleComplete = () => {
    if (!completedModules.includes(currentModule)) {
      setCompletedModules([...completedModules, currentModule]);
    }
  };

  const nextModule = () => {
    markModuleComplete();
    if (currentModule < modules.length - 1) {
      setCurrentModule(currentModule + 1);
    }
  };

  const prevModule = () => {
    if (currentModule > 0) {
      setCurrentModule(currentModule - 1);
    }
  };

  const goToModule = (index) => {
    setCurrentModule(index);
  };

  const currentContent = modules[currentModule];
  const progress = ((completedModules.length) / modules.length) * 100;

  if (!isOpen) return null;

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    teal: 'bg-teal-100 text-teal-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    rose: 'bg-rose-100 text-rose-600'
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Admin Training Guide</h2>
              <p className="text-blue-100 text-sm">{franchiseName || 'Your Franchise'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            data-testid="close-training"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Module {currentModule + 1} of {modules.length}
            </span>
            <span className="text-sm text-gray-500">
              {completedModules.length} completed
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Module List */}
          <div className="w-64 bg-gray-50 border-r overflow-y-auto hidden md:block">
            <div className="p-4 space-y-2">
              {modules.map((module, index) => {
                const Icon = module.icon;
                const isCompleted = completedModules.includes(index);
                const isCurrent = currentModule === index;
                
                return (
                  <button
                    key={module.id}
                    onClick={() => goToModule(index)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${
                      isCurrent 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    data-testid={`module-${module.id}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCompleted ? 'bg-green-100' : colorClasses[module.color]
                    }`}>
                      {isCompleted ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <Icon size={16} />
                      )}
                    </div>
                    <span className="text-sm font-medium flex-1">{module.title}</span>
                    {isCurrent && <ChevronRight size={16} className="text-blue-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Module Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorClasses[currentContent.color]}`}>
                  <currentContent.icon size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{currentContent.content.heading}</h3>
                  <p className="text-gray-500">{currentContent.content.description}</p>
                </div>
              </div>

              {/* Content Sections */}
              <div className="space-y-6">
                {currentContent.content.sections.map((section, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-5">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      {section.steps ? (
                        <Play size={18} className="mr-2 text-blue-500" />
                      ) : (
                        <Lightbulb size={18} className="mr-2 text-yellow-500" />
                      )}
                      {section.title}
                    </h4>
                    {section.steps ? (
                      <ol className="space-y-2">
                        {section.steps.map((step, stepIdx) => (
                          <li key={stepIdx} className="flex items-start space-x-3">
                            <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              {stepIdx + 1}
                            </span>
                            <span className="text-gray-700">{step}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <ul className="space-y-2">
                        {section.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="flex items-start space-x-2">
                            <CheckCircle size={16} className="text-green-500 mt-1 flex-shrink-0" />
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {/* Tip Box */}
                {currentContent.content.tip && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
                    <HelpCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Pro Tip</p>
                      <p className="text-blue-700 text-sm">{currentContent.content.tip}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <button
            onClick={prevModule}
            disabled={currentModule === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-2">
            {modules.map((_, index) => (
              <button
                key={index}
                onClick={() => goToModule(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  currentModule === index 
                    ? 'bg-blue-600' 
                    : completedModules.includes(index)
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {currentModule === modules.length - 1 ? (
            <button
              onClick={() => {
                markModuleComplete();
                onClose();
              }}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              data-testid="finish-training"
            >
              <CheckCircle size={20} />
              <span>Complete Training</span>
            </button>
          ) : (
            <button
              onClick={nextModule}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              data-testid="next-module"
            >
              <span>Next</span>
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTraining;
