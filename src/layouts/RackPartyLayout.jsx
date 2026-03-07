import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  PartyPopper, Users, BarChart3, LogOut, Menu, X, Home, Building, Calendar,
} from 'lucide-react';
import { useOrganizer } from '../contexts/OrganizerContext';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { title: 'Parties', icon: PartyPopper, path: '/rackparty' },
  { title: 'Guest Book', icon: Users, path: '/rackparty/guestbook' },
  { title: 'Responses', icon: BarChart3, path: '/rackparty/responses' },
];

export function RackPartyLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { organizer, eventCount } = useOrganizer();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/rackparty') {
      return location.pathname === '/rackparty';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const renderSidebar = (isMobile = false) => (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Logo className="h-10" />
        </div>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-gray-200/60 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-900" />
          </button>
        )}
      </div>

      {/* Subtitle */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-primary" />
          <span className="font-semibold text-gray-900">RackParty</span>
        </div>
      </div>

      {/* Organizer Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {organizer?.logo_url ? (
            <img
              src={organizer.logo_url}
              alt={organizer.business_name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {organizer?.business_name || 'My Organization'}
            </p>
            <p className="text-xs text-gray-600">Party Host</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
              isActive(item.path)
                ? 'bg-primary text-white'
                : 'text-gray-900/70 hover:bg-gray-200/60'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.title}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-4 pb-2 space-y-1">
        {eventCount > 0 ? (
          <Link
            to="/organizer"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-200/60 transition-colors text-sm"
          >
            <Calendar className="w-4 h-4" />
            Organizer Dashboard &rarr;
          </Link>
        ) : (
          <Link
            to="/organizer/events/create"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-primary hover:bg-primary/5 transition-colors text-sm font-medium"
          >
            <Calendar className="w-4 h-4" />
            Create Your First Event &rarr;
          </Link>
        )}
        <Link
          to="/"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-200/60 transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          Back to Website
        </Link>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200/60">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-gray-200/60 rounded-lg"
        >
          <Menu className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-primary" />
          <span className="font-semibold text-gray-900">RackParty</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {renderSidebar(true)}
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-between px-6">
          <div>
            <h2 className="font-medium text-gray-900">Welcome to RackParty!</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle className="text-gray-900/60" />
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
