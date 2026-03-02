import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  BarChart3, FileText, Building2, Receipt, Settings,
  TrendingUp, Users, Car, Calendar, DollarSign,
  Download, Filter, Search, RefreshCw, AlertTriangle,
  CheckCircle, Clock, XCircle, Plus, Eye, Send,
  ChevronDown, Printer
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [franchisesReport, setFranchisesReport] = useState(null);
  const [invoicesReport, setInvoicesReport] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [tenants, setTenants] = useState([]);

  // Form states
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    tenant_id: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_rate: 23,
    notes: ''
  });

  // Settings form
  const [editSettings, setEditSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // PDF Download helper function
  const downloadPdf = async (endpoint, filename) => {
    setDownloadingPdf(true);
    try {
      const response = await axios.get(`${API}${endpoint}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess('PDF downloaded successfully');
    } catch (err) {
      setError('Failed to download PDF');
      console.error(err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'executive') {
        const res = await axios.get(`${API}/platform/reports/executive-summary`);
        setExecutiveSummary(res.data);
      } else if (activeTab === 'franchises') {
        const res = await axios.get(`${API}/platform/reports/franchises`);
        setFranchisesReport(res.data);
      } else if (activeTab === 'invoices') {
        const [invRes, tenRes] = await Promise.all([
          axios.get(`${API}/platform/invoices`),
          axios.get(`${API}/platform/tenants`)
        ]);
        setInvoices(invRes.data.invoices || []);
        setInvoicesReport(invRes.data);
        setTenants(tenRes.data.tenants || []);
      } else if (activeTab === 'settings') {
        const res = await axios.get(`${API}/platform/settings`);
        setCompanySettings(res.data);
        setSettingsForm(res.data);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      const invoiceData = {
        ...newInvoice,
        items: newInvoice.items.filter(i => i.description && i.unit_price > 0)
      };
      await axios.post(`${API}/platform/invoices`, invoiceData);
      setSuccess('Invoice created successfully');
      setShowCreateInvoice(false);
      setNewInvoice({
        tenant_id: '',
        items: [{ description: '', quantity: 1, unit_price: 0 }],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tax_rate: 23,
        notes: ''
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invoice');
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId, newStatus) => {
    try {
      await axios.put(`${API}/platform/invoices/${invoiceId}`, { status: newStatus });
      setSuccess('Invoice updated');
      fetchData();
    } catch (err) {
      setError('Failed to update invoice');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put(`${API}/platform/settings`, settingsForm);
      setSuccess('Settings saved');
      setEditSettings(false);
      fetchData();
    } catch (err) {
      setError('Failed to save settings');
    }
  };

  const addInvoiceItem = () => {
    setNewInvoice({
      ...newInvoice,
      items: [...newInvoice.items, { description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const updateInvoiceItem = (index, field, value) => {
    const items = [...newInvoice.items];
    items[index][field] = field === 'quantity' || field === 'unit_price' ? parseFloat(value) || 0 : value;
    setNewInvoice({ ...newInvoice, items });
  };

  const removeInvoiceItem = (index) => {
    const items = newInvoice.items.filter((_, i) => i !== index);
    setNewInvoice({ ...newInvoice, items: items.length ? items : [{ description: '', quantity: 1, unit_price: 0 }] });
  };

  const calculateInvoiceTotal = () => {
    const subtotal = newInvoice.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = subtotal * (newInvoice.tax_rate / 100);
    return { subtotal, tax, total: subtotal + tax };
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500'
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (amount) => {
    return `€${(amount || 0).toFixed(2)}`;
  };

  const tabs = [
    { id: 'executive', label: 'Executive Summary', icon: BarChart3 },
    { id: 'franchises', label: 'Franchises Report', icon: Building2 },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'settings', label: 'Company Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports & Billing</h1>
              <p className="text-sm text-gray-500 mt-1">Manage invoices and view platform analytics</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertTriangle size={18} className="mr-2" />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
            <CheckCircle size={18} className="mr-2" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto text-green-500">&times;</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Executive Summary Tab */}
            {activeTab === 'executive' && executiveSummary && (
              <div className="space-y-6">
                {/* Header with Export Button */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Executive Summary</h2>
                  <button
                    onClick={() => downloadPdf('/platform/reports/executive-summary/pdf', 'executive_summary.pdf')}
                    disabled={downloadingPdf}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    data-testid="export-executive-pdf-btn"
                  >
                    <Download size={18} />
                    <span>{downloadingPdf ? 'Downloading...' : 'Export PDF'}</span>
                  </button>
                </div>
                
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Franchises</p>
                        <p className="text-3xl font-bold text-gray-900">{executiveSummary.summary.tenants.total}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Building2 className="text-blue-600" size={24} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm">
                      <span className="text-green-600">{executiveSummary.summary.tenants.active} active</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-red-600">{executiveSummary.summary.tenants.suspended} suspended</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Users</p>
                        <p className="text-3xl font-bold text-gray-900">{executiveSummary.summary.users}</p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Users className="text-purple-600" size={24} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Revenue Collected</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(executiveSummary.summary.revenue.total_collected)}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <DollarSign className="text-green-600" size={24} />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {formatCurrency(executiveSummary.summary.revenue.pending)} pending
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Vehicles</p>
                        <p className="text-3xl font-bold text-gray-900">{executiveSummary.summary.vehicles}</p>
                      </div>
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Car className="text-orange-600" size={24} />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {executiveSummary.summary.bookings} bookings
                    </div>
                  </div>
                </div>

                {/* Plan Distribution & Recent Tenants */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <h3 className="font-semibold text-gray-900 mb-4">Plan Distribution</h3>
                    <div className="space-y-3">
                      {Object.entries(executiveSummary.summary.plan_distribution || {}).map(([plan, count]) => (
                        <div key={plan} className="flex items-center justify-between">
                          <span className="capitalize text-gray-700">{plan}</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">{count}</span>
                        </div>
                      ))}
                      {Object.keys(executiveSummary.summary.plan_distribution || {}).length === 0 && (
                        <p className="text-gray-500 text-sm">No franchises yet</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <h3 className="font-semibold text-gray-900 mb-4">Recent Franchises</h3>
                    <div className="space-y-3">
                      {executiveSummary.recent_tenants?.map(tenant => (
                        <div key={tenant.slug} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-500">{tenant.slug}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tenant.status}
                          </span>
                        </div>
                      ))}
                      {(!executiveSummary.recent_tenants || executiveSummary.recent_tenants.length === 0) && (
                        <p className="text-gray-500 text-sm">No franchises yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Franchises Report Tab */}
            {activeTab === 'franchises' && franchisesReport && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">All Franchises ({franchisesReport.total})</h3>
                    <button 
                      onClick={() => downloadPdf('/platform/reports/franchises/pdf', 'franchises_report.pdf')}
                      disabled={downloadingPdf}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      data-testid="export-franchises-pdf-btn"
                    >
                      <Download size={16} />
                      <span>{downloadingPdf ? 'Downloading...' : 'Export PDF'}</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicles</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Billed</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {franchisesReport.franchises?.map(franchise => (
                          <tr key={franchise.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{franchise.name}</p>
                                <p className="text-xs text-gray-500">{franchise.slug}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                franchise.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {franchise.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 capitalize text-sm">{franchise.plan}</td>
                            <td className="px-4 py-3 text-sm">{franchise.stats?.users || 0}</td>
                            <td className="px-4 py-3 text-sm">{franchise.stats?.vehicles || 0}</td>
                            <td className="px-4 py-3 text-sm">{formatCurrency(franchise.stats?.total_billed)}</td>
                            <td className="px-4 py-3">
                              <span className={`font-medium ${franchise.stats?.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(franchise.stats?.balance_due)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(!franchisesReport.franchises || franchisesReport.franchises.length === 0) && (
                    <div className="p-8 text-center text-gray-500">
                      <Building2 size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No franchises found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                {invoicesReport && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm text-gray-500">Total Invoiced</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoicesReport.summary?.total_amount)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm text-gray-500">Paid</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(invoicesReport.summary?.paid_amount)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm text-gray-500">Pending</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(invoicesReport.summary?.pending_amount)}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Invoices</h3>
                  <button
                    onClick={() => setShowCreateInvoice(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={18} />
                    <span>Create Invoice</span>
                  </button>
                </div>

                {/* Create Invoice Form */}
                {showCreateInvoice && (
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <h4 className="font-semibold text-gray-900 mb-4">New Invoice</h4>
                    <form onSubmit={handleCreateInvoice} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Franchise</label>
                          <select
                            value={newInvoice.tenant_id}
                            onChange={(e) => setNewInvoice({ ...newInvoice, tenant_id: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                          >
                            <option value="">Select franchise</option>
                            {tenants.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                          <input
                            type="date"
                            value={newInvoice.due_date}
                            onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
                        {newInvoice.items.map((item, index) => (
                          <div key={index} className="flex items-center space-x-2 mb-2">
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                              className="flex-1 px-3 py-2 border rounded-lg"
                            />
                            <input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value)}
                              className="w-20 px-3 py-2 border rounded-lg"
                              min="1"
                            />
                            <input
                              type="number"
                              placeholder="Price"
                              value={item.unit_price}
                              onChange={(e) => updateInvoiceItem(index, 'unit_price', e.target.value)}
                              className="w-28 px-3 py-2 border rounded-lg"
                              step="0.01"
                            />
                            <span className="w-24 text-right font-medium">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeInvoiceItem(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                            >
                              <XCircle size={18} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addInvoiceItem}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          + Add line item
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                          <input
                            type="number"
                            value={newInvoice.tax_rate}
                            onChange={(e) => setNewInvoice({ ...newInvoice, tax_rate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border rounded-lg"
                            step="0.1"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                          <input
                            type="text"
                            value={newInvoice.notes}
                            onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Optional notes"
                          />
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(calculateInvoiceTotal().subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Tax ({newInvoice.tax_rate}%):</span>
                          <span>{formatCurrency(calculateInvoiceTotal().tax)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                          <span>Total:</span>
                          <span>{formatCurrency(calculateInvoiceTotal().total)}</span>
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Create Invoice
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateInvoice(false)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Invoices Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map(invoice => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{invoice.invoice_number}</td>
                          <td className="px-4 py-3">{invoice.tenant_name}</td>
                          <td className="px-4 py-3 font-medium">{formatCurrency(invoice.total)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{new Date(invoice.due_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {invoice.status === 'draft' && (
                                <button
                                  onClick={() => handleUpdateInvoiceStatus(invoice.id, 'sent')}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Send Invoice"
                                >
                                  <Send size={16} />
                                </button>
                              )}
                              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                <button
                                  onClick={() => handleUpdateInvoiceStatus(invoice.id, 'paid')}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {invoices.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <Receipt size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No invoices yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Company Settings Tab */}
            {activeTab === 'settings' && companySettings && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-900">Company Information</h3>
                    {!editSettings ? (
                      <button
                        onClick={() => setEditSettings(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Edit Settings
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveSettings}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditSettings(false); setSettingsForm(companySettings); }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">Business Details</h4>
                      {editSettings ? (
                        <>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Company Name</label>
                            <input
                              type="text"
                              value={settingsForm.company_name || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Tagline</label>
                            <input
                              type="text"
                              value={settingsForm.tagline || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Email</label>
                            <input
                              type="email"
                              value={settingsForm.email || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Phone</label>
                            <input
                              type="text"
                              value={settingsForm.phone || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Website</label>
                            <input
                              type="text"
                              value={settingsForm.website || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Tax ID / VAT Number</label>
                            <input
                              type="text"
                              value={settingsForm.tax_id || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, tax_id: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <p><span className="text-gray-500">Company:</span> <strong>{companySettings.company_name}</strong></p>
                          <p><span className="text-gray-500">Tagline:</span> {companySettings.tagline || 'N/A'}</p>
                          <p><span className="text-gray-500">Email:</span> {companySettings.email || 'N/A'}</p>
                          <p><span className="text-gray-500">Phone:</span> {companySettings.phone || 'N/A'}</p>
                          <p><span className="text-gray-500">Website:</span> {companySettings.website || 'N/A'}</p>
                          <p><span className="text-gray-500">Tax ID:</span> {companySettings.tax_id || 'N/A'}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">Address</h4>
                      {editSettings ? (
                        <>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Address Line 1</label>
                            <input
                              type="text"
                              value={settingsForm.address_line1 || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, address_line1: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Address Line 2</label>
                            <input
                              type="text"
                              value={settingsForm.address_line2 || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, address_line2: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">City</label>
                              <input
                                type="text"
                                value={settingsForm.city || ''}
                                onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Postal Code</label>
                              <input
                                type="text"
                                value={settingsForm.postal_code || ''}
                                onChange={(e) => setSettingsForm({ ...settingsForm, postal_code: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Country</label>
                            <input
                              type="text"
                              value={settingsForm.country || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, country: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1 text-sm">
                          <p>{companySettings.address_line1 || 'No address set'}</p>
                          {companySettings.address_line2 && <p>{companySettings.address_line2}</p>}
                          <p>
                            {[companySettings.city, companySettings.postal_code].filter(Boolean).join(', ') || ''}
                          </p>
                          <p>{companySettings.country}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">Banking Details</h4>
                      {editSettings ? (
                        <>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
                            <input
                              type="text"
                              value={settingsForm.bank_name || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bank_name: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">IBAN</label>
                            <input
                              type="text"
                              value={settingsForm.bank_iban || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bank_iban: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">BIC/SWIFT</label>
                            <input
                              type="text"
                              value={settingsForm.bank_bic || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bank_bic: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <p><span className="text-gray-500">Bank:</span> {companySettings.bank_name || 'N/A'}</p>
                          <p><span className="text-gray-500">IBAN:</span> {companySettings.bank_iban || 'N/A'}</p>
                          <p><span className="text-gray-500">BIC:</span> {companySettings.bank_bic || 'N/A'}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">Invoice Settings</h4>
                      {editSettings ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Invoice Prefix</label>
                              <input
                                type="text"
                                value={settingsForm.invoice_prefix || ''}
                                onChange={(e) => setSettingsForm({ ...settingsForm, invoice_prefix: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Default Tax Rate (%)</label>
                              <input
                                type="number"
                                value={settingsForm.default_tax_rate || 0}
                                onChange={(e) => setSettingsForm({ ...settingsForm, default_tax_rate: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg"
                                step="0.1"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Currency</label>
                              <input
                                type="text"
                                value={settingsForm.currency || ''}
                                onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Currency Symbol</label>
                              <input
                                type="text"
                                value={settingsForm.currency_symbol || ''}
                                onChange={(e) => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Invoice Footer</label>
                            <textarea
                              value={settingsForm.invoice_footer || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, invoice_footer: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                              rows={2}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <p><span className="text-gray-500">Prefix:</span> {companySettings.invoice_prefix}</p>
                          <p><span className="text-gray-500">Tax Rate:</span> {companySettings.default_tax_rate}%</p>
                          <p><span className="text-gray-500">Currency:</span> {companySettings.currency} ({companySettings.currency_symbol})</p>
                          <p><span className="text-gray-500">Footer:</span> {companySettings.invoice_footer}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
