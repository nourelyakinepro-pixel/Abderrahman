import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  Package, 
  CheckCircle, 
  Clock,
  Trash2,
  ChevronDown,
  ArrowUpDown,
  X,
  Users,
  ShoppingCart,
  Edit2,
  LogOut,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import CreatableSelect from 'react-select/creatable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Order, OrderFormData, OrderStatus, Customer } from './types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount).replace(/\u00a0/g, ' ') + ' DH';
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [view, setView] = useState<'orders' | 'customers'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'Tous'>('Tous');
  const [emailFilter, setEmailFilter] = useState<string | 'Tous'>('Tous');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersRes, customersRes] = await Promise.all([
        window.fetch('/api/orders'),
        window.fetch('/api/customers')
      ]);
      const ordersData = await ordersRes.json();
      const customersData = await customersRes.json();
      setOrders(ordersData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrder = async (formData: OrderFormData) => {
    try {
      const res = await window.fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await loadData();
        setIsModalOpen(false);
        toast.success('Commande créée avec succès !');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Erreur lors de la création de la commande');
      }
    } catch (error) {
      console.error('Error adding order:', error);
      toast.error('Une erreur est survenue lors de la connexion au serveur');
    }
  };

  const handleDeleteOrder = async (id: number) => {
    try {
      const res = await window.fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOrders(orders.filter(o => o.id !== id));
        setOrderToDelete(null);
        toast.success('Commande supprimée');
        loadData(); // Refresh to update customer order counts
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Erreur de connexion');
    }
  };

  const handleStatusUpdate = async (id: number, newStatus: OrderStatus) => {
    try {
      const res = await window.fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setOrders(orders.map(o => o.id === id ? { ...o, statut: newStatus } : o));
        toast.success('Statut mis à jour');
      } else {
        toast.error('Erreur lors de la mise à jour du statut');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur de connexion');
    }
  };

  const handleAddCustomer = async (email: string) => {
    try {
      const res = await window.fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        await loadData();
        setIsCustomerModalOpen(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de l\'ajout du client');
      }
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const handleUpdateCustomer = async (id: number, email: string) => {
    try {
      const res = await window.fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        await loadData();
        setIsCustomerModalOpen(false);
        setEditingCustomer(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    try {
      const res = await window.fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders.filter(order => {
      const matchesSearch = 
        order.numero_commande.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.email_client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.nom_produit.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'Tous' || order.statut === statusFilter;
      const matchesEmail = emailFilter === 'Tous' || order.email_client === emailFilter;

      return matchesSearch && matchesStatus && matchesEmail;
    });

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [orders, searchQuery, statusFilter, emailFilter, sortConfig]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    const totalSales = orders.reduce((acc, curr) => acc + curr.prix_vente, 0);
    const totalProfit = orders.reduce((acc, curr) => acc + (curr.prix_vente - curr.prix_achat), 0);
    const deliveredCount = orders.filter(o => o.statut === 'Livrée').length;
    return { totalSales, totalProfit, deliveredCount };
  }, [orders]);

  const exportToCSV = () => {
    const headers = ['Numéro de commande', 'Produit', 'Statut', 'Quantité', 'Email', 'Prix d\'achat', 'Prix de vente', 'Bénéfice'];
    const rows = filteredOrders.map(o => [
      o.numero_commande,
      o.nom_produit,
      o.statut,
      o.quantite,
      o.email_client,
      formatCurrency(o.prix_achat),
      formatCurrency(o.prix_vente),
      formatCurrency(o.prix_vente - o.prix_achat)
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "export_commandes.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const rows = filteredOrders.map(o => ({
      'Numéro de commande': o.numero_commande,
      'Produit': o.nom_produit,
      'Statut': o.statut,
      'Quantité': o.quantite,
      'Email': o.email_client,
      'Prix d\'achat': formatCurrency(o.prix_achat),
      'Prix de vente': formatCurrency(o.prix_vente),
      'Bénéfice': formatCurrency(o.prix_vente - o.prix_achat)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Commandes");
    XLSX.writeFile(workbook, "export_commandes.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const headers = [['Numéro de commande', 'Produit', 'Statut', 'Quantité', 'Email', 'Prix d\'achat', 'Prix de vente', 'Bénéfice']];
    const rows = filteredOrders.map(o => [
      o.numero_commande,
      o.nom_produit,
      o.statut,
      o.quantite.toString(),
      o.email_client,
      formatCurrency(o.prix_achat),
      formatCurrency(o.prix_vente),
      formatCurrency(o.prix_vente - o.prix_achat)
    ]);

    doc.text("Export des commandes", 14, 15);
    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save("export_commandes.pdf");
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      <Toaster position="top-right" richColors />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Package className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">OrderFlow</h1>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => { setView('orders'); setSearchQuery(''); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  view === 'orders' ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                <ShoppingCart size={18} />
                Commandes
              </button>
              <button 
                onClick={() => { setView('customers'); setSearchQuery(''); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  view === 'customers' ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                <Users size={18} />
                Emails clients
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => view === 'orders' ? setIsModalOpen(true) : setIsCustomerModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm font-medium text-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">{view === 'orders' ? 'Nouvelle commande' : 'Ajouter un email'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
        {/* Mobile Nav */}
        <div className="md:hidden flex border-t border-gray-100">
          <button 
            onClick={() => { setView('orders'); setSearchQuery(''); }}
            className={cn(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2",
              view === 'orders' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500"
            )}
          >
            <ShoppingCart size={16} />
            Commandes
          </button>
          <button 
            onClick={() => { setView('customers'); setSearchQuery(''); }}
            className={cn(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2",
              view === 'customers' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500"
            )}
          >
            <Users size={16} />
            Emails clients
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'orders' ? (
          <>
            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard 
                title="Ventes totales" 
                value={formatCurrency(stats.totalSales)} 
                icon={<TrendingUp className="text-emerald-600" />}
                color="bg-emerald-50"
              />
              <StatCard 
                title="Bénéfice total" 
                value={formatCurrency(stats.totalProfit)} 
                icon={<TrendingUp className="text-indigo-600" />}
                color="bg-indigo-50"
              />
              <StatCard 
                title="Commandes livrées" 
                value={stats.deliveredCount.toString()} 
                icon={<CheckCircle className="text-blue-600" />}
                color="bg-blue-50"
              />
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Rechercher commandes, produits ou clients..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select 
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'Tous')}
                  >
                    <option value="Tous">Tous les statuts</option>
                    <option value="Expédiée">Expédiée</option>
                    <option value="Livrée">Livrée</option>
                  </select>
                  <select 
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[200px]"
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                  >
                    <option value="Tous">Tous les clients</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.email}>{c.email}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <button 
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <Download size={16} />
                      Exporter
                      <ChevronDown size={14} />
                    </button>
                    
                    <AnimatePresence>
                      {isExportMenuOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50"
                        >
                          <button 
                            onClick={() => { exportToCSV(); setIsExportMenuOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Exporter en CSV
                          </button>
                          <button 
                            onClick={() => { exportToExcel(); setIsExportMenuOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Exporter en Excel
                          </button>
                          <button 
                            onClick={() => { exportToPDF(); setIsExportMenuOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Exporter en PDF
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <SortableHeader label="N° Commande" sortKey="numero_commande" currentSort={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Produit" sortKey="nom_produit" currentSort={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Client" sortKey="email_client" currentSort={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Statut" sortKey="statut" currentSort={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Qté" sortKey="quantite" currentSort={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Bénéfice" sortKey="prix_vente" currentSort={sortConfig} onSort={handleSort} />
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span>Chargement des commandes...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          Aucune commande trouvée correspondant à vos critères.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.numero_commande}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{order.nom_produit}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{order.email_client}</td>
                          <td className="px-6 py-4">
                            <StatusSelect 
                              status={order.statut} 
                              onChange={(newStatus) => handleStatusUpdate(order.id, newStatus)} 
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{order.quantite}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                            {formatCurrency(order.prix_vente - order.prix_achat)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setOrderToDelete(order.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Customer Management View */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Rechercher un email client..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Client</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre de commandes</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span>Chargement des clients...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                          Aucun client trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <span className="bg-gray-100 px-2 py-1 rounded-md font-medium">
                              {customer.order_count} commande{customer.order_count > 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button 
                              onClick={() => {
                                setEditingCustomer(customer);
                                setIsCustomerModalOpen(true);
                              }}
                              className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCustomer(customer.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              disabled={customer.order_count > 0}
                              title={customer.order_count > 0 ? "Impossible de supprimer un client avec des commandes" : ""}
                            >
                              <Trash2 size={16} className={customer.order_count > 0 ? "opacity-30" : ""} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <AddOrderModal 
            onClose={() => setIsModalOpen(false)} 
            onSubmit={handleAddOrder}
            customers={customers}
          />
        )}
        {isCustomerModalOpen && (
          <CustomerModal 
            onClose={() => {
              setIsCustomerModalOpen(false);
              setEditingCustomer(null);
            }} 
            onSubmit={(email) => editingCustomer ? handleUpdateCustomer(editingCustomer.id, email) : handleAddCustomer(email)}
            initialEmail={editingCustomer?.email || ''}
            isEditing={!!editingCustomer}
          />
        )}
        {orderToDelete !== null && (
          <DeleteConfirmationModal 
            onClose={() => setOrderToDelete(null)}
            onConfirm={() => handleDeleteOrder(orderToDelete)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login === 'Admin' && password === '1234') {
      localStorage.setItem('isAuthenticated', 'true');
      onLogin();
    } else {
      setError('Identifiants incorrects');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-100 p-4 rounded-full">
            <Lock className="text-indigo-600 w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Connexion OrderFlow</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Identifiant</label>
            <input 
              type="text"
              required
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Saisissez votre identifiant"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Mot de passe</label>
            <input 
              type="password"
              required
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-sm mt-4"
          >
            Se connecter
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={cn("p-3 rounded-lg", color)}>
        {icon}
      </div>
    </div>
  );
}

function StatusSelect({ status, onChange }: { status: OrderStatus, onChange: (newStatus: OrderStatus) => void }) {
  return (
    <div className="relative inline-block w-full min-w-[120px]">
      <select 
        value={status}
        onChange={(e) => onChange(e.target.value as OrderStatus)}
        className={cn(
          "w-full appearance-none px-3 py-1.5 pr-8 rounded-lg text-xs font-semibold transition-all cursor-pointer outline-none border border-transparent focus:ring-2 focus:ring-indigo-500/20",
          status === 'Expédiée' 
            ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200" 
            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200"
        )}
      >
        <option value="Expédiée">Expédiée</option>
        <option value="Livrée">Livrée</option>
      </select>
      <ChevronDown className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5",
        status === 'Expédiée' ? "text-orange-500" : "text-emerald-500"
      )} />
    </div>
  );
}

function SortableHeader({ label, sortKey, currentSort, onSort }: { 
  label: string, 
  sortKey: string, 
  currentSort: { key: string; direction: 'asc' | 'desc' } | null,
  onSort: (key: string) => void 
}) {
  const isActive = currentSort?.key === sortKey;
  return (
    <th 
      className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={cn("transition-opacity", isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
      </div>
    </th>
  );
}

function AddOrderModal({ onClose, onSubmit, customers }: { 
  onClose: () => void, 
  onSubmit: (data: OrderFormData) => void,
  customers: Customer[]
}) {
  const [formData, setFormData] = useState<OrderFormData>({
    numero_commande: '',
    statut: 'Expédiée',
    quantite: 1,
    email_client: '',
    prix_achat: 0,
    prix_vente: 0,
    nom_produit: ''
  });

  const customerOptions = customers.map(c => ({ value: c.email, label: c.email }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold">Nouvelle commande</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form className="p-6 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          
          // Validation
          if (!formData.numero_commande.trim()) {
            toast.error('Le numéro de commande est obligatoire');
            return;
          }
          if (!formData.nom_produit.trim()) {
            toast.error('Le nom du produit est obligatoire');
            return;
          }
          if (!formData.email_client.trim()) {
            toast.error('L\'email du client est obligatoire');
            return;
          }
          if (isNaN(formData.quantite) || formData.quantite <= 0) {
            toast.error('La quantité doit être un nombre supérieur à 0');
            return;
          }
          if (isNaN(formData.prix_achat) || formData.prix_achat < 0) {
            toast.error('Le prix d\'achat doit être un nombre positif');
            return;
          }
          if (isNaN(formData.prix_vente) || formData.prix_vente < 0) {
            toast.error('Le prix de vente doit être un nombre positif');
            return;
          }

          onSubmit(formData);
        }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Numéro de commande</label>
              <input 
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                value={formData.numero_commande}
                onChange={e => setFormData({ ...formData, numero_commande: e.target.value })}
                placeholder="ORD-123"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Nom du produit</label>
              <input 
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                value={formData.nom_produit}
                onChange={e => setFormData({ ...formData, nom_produit: e.target.value })}
                placeholder="Produit A"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Email du client</label>
            <CreatableSelect
              isClearable
              isSearchable
              options={customerOptions}
              value={formData.email_client ? { value: formData.email_client, label: formData.email_client } : null}
              onChange={(opt) => setFormData({ ...formData, email_client: opt?.value || '' })}
              onCreateOption={(val) => setFormData({ ...formData, email_client: val })}
              placeholder="Sélectionner ou saisir un nouvel email..."
              formatCreateLabel={(inputValue) => `Ajouter "${inputValue}"`}
              styles={{
                control: (base) => ({
                  ...base,
                  backgroundColor: '#F9FAFB',
                  borderColor: '#E5E7EB',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  '&:hover': { borderColor: '#E5E7EB' }
                }),
                menu: (base) => ({ ...base, borderRadius: '0.5rem', overflow: 'hidden' })
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Quantité</label>
              <input 
                type="number"
                required
                min="1"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                value={isNaN(formData.quantite) ? '' : formData.quantite}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setFormData({ ...formData, quantite: isNaN(val) ? NaN : val });
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Prix d'achat total (DH)</label>
              <input 
                type="number"
                step="0.01"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                value={isNaN(formData.prix_achat) ? '' : formData.prix_achat}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setFormData({ ...formData, prix_achat: isNaN(val) ? NaN : val });
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Prix de vente total (DH)</label>
              <input 
                type="number"
                step="0.01"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                value={isNaN(formData.prix_vente) ? '' : formData.prix_vente}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setFormData({ ...formData, prix_vente: isNaN(val) ? NaN : val });
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Statut initial</label>
            <div className="flex gap-2">
              {(['Expédiée', 'Livrée'] as OrderStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormData({ ...formData, statut: s })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                    formData.statut === s 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Annuler
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
            >
              Créer la commande
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DeleteConfirmationModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="text-red-600 w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
          <p className="text-sm text-gray-500 mb-6">
            Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Annuler
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all shadow-sm"
            >
              Supprimer
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CustomerModal({ onClose, onSubmit, initialEmail, isEditing }: { 
  onClose: () => void, 
  onSubmit: (email: string) => void,
  initialEmail: string,
  isEditing: boolean
}) {
  const [email, setEmail] = useState(initialEmail);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold">{isEditing ? 'Modifier le client' : 'Ajouter un client'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form className="p-6 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          onSubmit(email);
        }}>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Email du client</label>
            <input 
              required
              type="email"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="client@exemple.com"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
            >
              Annuler
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
            >
              {isEditing ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
