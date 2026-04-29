import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { initSounds } from './logic/sounds';

import SplashScreen        from './screens/SplashScreen';
import AuthScreen          from './screens/AuthScreen';
import HomeScreen          from './screens/HomeScreen';
import CreateGroupScreen   from './screens/CreateGroupScreen';
import FamilyDashboard     from './screens/FamilyDashboard';
import TripDashboard       from './screens/TripDashboard';
import AdminPanelScreen    from './screens/AdminPanelScreen';
import PublicDashboard     from './screens/PublicDashboard';
import ProfileScreen       from './screens/ProfileScreen';
import { CollectionListScreen, ExpenseListScreen, ActivityLogScreen, SettlementScreen, BudgetCalculatorScreen } from './screens/Screens';

import './index.css';

function Router() {
  const { user, loading } = useAuth();
  const [splash, setSplash]       = useState(true);
  const [screen, setScreen]       = useState('home');
  const [params,  setParams]      = useState({});
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => { initSounds(); }, []);

  // Parse URL on first load — handles /view/GROUP_ID shareable links
  useEffect(() => {
    const path = window.location.pathname;
    const viewMatch = path.match(/^\/view\/(.+)$/);
    if (viewMatch) {
      const groupId = viewMatch[1];
      setScreen('publicDash');
      setParams({ groupId });
      setActiveGroup(groupId);
      // Clean up URL after parsing
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const navigate = (to, p = {}) => {
    setScreen(to);
    setParams(p);
    if (p.groupId) setActiveGroup(p.groupId);
    window.scrollTo(0, 0);
  };

  if (splash) return <SplashScreen onDone={() => setSplash(false)} />;
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', color:'var(--text3)' }}>
      Loading…
    </div>
  );

  // Resolve groupId before any screen — needed by publicDash (no login required)
  const gid = params.groupId || activeGroup;

  // Public dashboard: no login required
  if (screen === 'publicDash') {
    return (
      <div className="app-root">
        <PublicDashboard navigate={navigate} groupId={gid} />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const screens = {
    home:           <HomeScreen navigate={navigate} />,
    profile:        <ProfileScreen navigate={navigate} />,
    create:         <CreateGroupScreen navigate={navigate} params={params} />,
    familyDash:     <FamilyDashboard navigate={navigate} groupId={gid} />,
    dashboard:      <TripDashboard navigate={navigate} groupId={gid} />,
    adminPanel:     <AdminPanelScreen navigate={navigate} groupId={gid} />,
    publicDash:     <PublicDashboard navigate={navigate} groupId={gid} />,
    collectionList: <CollectionListScreen navigate={navigate} groupId={gid} />,
    expenseList:    <ExpenseListScreen navigate={navigate} groupId={gid} />,
    activityLog:    <ActivityLogScreen navigate={navigate} groupId={gid} />,
    settlement:     <SettlementScreen navigate={navigate} groupId={gid} />,
    budget:         <BudgetCalculatorScreen navigate={navigate} />,
  };

  return (
    <div className="app-root">
      {screens[screen] || screens.home}
    </div>
  );
}

export default function App() {
  const [uid, setUid] = useState(null);
  return (
    <AuthProvider>
      <ThemeProvider uid={uid}>
        <UidSync setUid={setUid}>
          <Router />
        </UidSync>
      </ThemeProvider>
    </AuthProvider>
  );
}

function UidSync({ children, setUid }) {
  const { user } = useAuth();
  useEffect(() => { setUid(user?.uid || null); }, [user]);
  return children;
}
