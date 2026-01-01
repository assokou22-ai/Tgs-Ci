
import React, { useState, useMemo, useEffect } from 'react';
import FactureList from './FactureList.tsx';
import ProformaList from './ProformaList.tsx';
import CommandeList from './CommandeList.tsx';
import MonthlyRevenueChart from './MonthlyRevenueChart.tsx';
import OrdersBySupplierChart from './OrdersBySupplierChart.tsx';
import BackupManager from './BackupManager.tsx';
import SimpleDocumentGenerator from './SimpleDocumentGenerator.tsx';
import useFactures from '../hooks/useFactures.ts';
import useCommandes from '../hooks/useCommandes.ts';
import { DocumentDuplicateIcon, BanknotesIcon, ShoppingCartIcon, ArrowPathIcon, ChartBarIcon, BookOpenIcon } from './icons.tsx';
import DashboardLayout, { NavItem } from './DashboardLayout.tsx';


type View = 'dashboard' | 'factures' | 'proformas' | 'commandes' | 'backup' | 'documents';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-gray-800 p-4 rounded-lg flex items-center shadow-lg">
        <div className="p-3 mr-4 bg-gray-700 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const DashboardContent: React.FC<{ setView: (view: View) => void }> = () => {
    const { factures, loading: facturesLoading } = useFactures();
    const { commandes, loading: commandesLoading } = useCommandes();

    const stats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Revenue from Invoices
        const invoiceRevenue = factures
            .filter(f => (f.status === 'Finalisé' || f.status === 'Payé') && new Date(f.date) >= startOfMonth)
            .reduce((sum, f) => sum + f.total, 0);
            
        // Revenue from Commandes (marked as isRevenue and Paid/Reçu)
        const orderRevenue = commandes
            .filter(c => c.isRevenue && (c.status === 'Payé' || c.status === 'Reçu') && new Date(c.date) >= startOfMonth)
            .reduce((sum, c) => sum + c.total, 0);

        const revenueThisMonth = invoiceRevenue + orderRevenue;
            
        const pendingInvoices = factures.filter(f => f.status === 'Brouillon').length;

        // Expenses from Commandes (NOT marked as isRevenue)
        const ordersThisMonth = commandes
            .filter(c => !c.isRevenue && (c.status === 'Commandé' || c.status === 'Reçu' || c.status === 'Payé') && new Date(c.date) >= startOfMonth)
            .reduce((sum, c) => sum + c.total, 0);

        return {
            revenueThisMonth,
            pendingInvoices,
            ordersThisMonth
        };
    }, [factures, commandes]);

    if (facturesLoading || commandesLoading) {
        return <div className="text-center">Chargement du tableau de bord...</div>;
    }

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Aperçu Financier</h1>
                <p className="mt-2 text-gray-400">Analyse des finances et des approvisionnements.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Entrées de Fonds (Mois)" 
                    value={`${stats.revenueThisMonth.toLocaleString('fr-FR')} F`}
                    icon={<BanknotesIcon className="h-6 w-6 text-green-400" />} 
                />
                 <StatCard 
                    title="Factures Brouillon" 
                    value={stats.pendingInvoices.toString()}
                    icon={<DocumentDuplicateIcon className="h-6 w-6 text-yellow-400" />} 
                />
                 <StatCard 
                    title="Dépenses Commandes (Mois)" 
                    value={`${stats.ordersThisMonth.toLocaleString('fr-FR')} F`}
                    icon={<ShoppingCartIcon className="h-6 w-6 text-blue-400" />} 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonthlyRevenueChart factures={factures} />
                <OrdersBySupplierChart commandes={commandes} />
            </div>
        </div>
    );
};


const FactureCommandeDashboard: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [initialEditId, setInitialEditId] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewFromUrl = urlParams.get('view') as View;
    const editId = urlParams.get('editId');

    if (viewFromUrl && ['factures', 'proformas', 'commandes', 'backup', 'documents'].includes(viewFromUrl)) {
        setView(viewFromUrl);
        setInitialEditId(editId);
    }
  }, []);

  const navItems: NavItem[] = [
      { id: 'dashboard', label: 'Tableau de Bord', icon: ChartBarIcon, isActive: view === 'dashboard', onClick: () => setView('dashboard') },
      { id: 'factures', label: 'Factures', icon: BanknotesIcon, isActive: view === 'factures', onClick: () => setView('factures') },
      { id: 'proformas', label: 'Proformas', icon: DocumentDuplicateIcon, isActive: view === 'proformas', onClick: () => setView('proformas') },
      { id: 'commandes', label: 'Commandes', icon: ShoppingCartIcon, isActive: view === 'commandes', onClick: () => setView('commandes') },
      { id: 'documents', label: 'Courriers', icon: BookOpenIcon, isActive: view === 'documents', onClick: () => setView('documents') },
      { id: 'backup', label: 'Sauvegarde', icon: ArrowPathIcon, isActive: view === 'backup', onClick: () => setView('backup') },
  ];

  const renderContent = () => {
    switch (view) {
      case 'factures':
        return <FactureList onBack={() => setView('dashboard')} initialEditId={initialEditId} />;
      case 'proformas':
        return <ProformaList onBack={() => setView('dashboard')} />;
      case 'commandes':
        return <CommandeList onBack={() => setView('dashboard')} initialEditId={initialEditId} />;
      case 'documents':
        return <SimpleDocumentGenerator onBack={() => setView('dashboard')} />;
      case 'backup':
        return <BackupManager />;
      case 'dashboard':
      default:
        return <DashboardContent setView={setView} />;
    }
  };

  return (
    <DashboardLayout title="Finance" navItems={navItems}>
        {renderContent()}
    </DashboardLayout>
  );
};

export default FactureCommandeDashboard;
