import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { BottomNav } from './components/BottomNav';
import { CenterSpinner } from './components/Spinner';
import Home from './pages/Home';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const Search = lazy(() => import('./pages/Search'));
const Provider = lazy(() => import('./pages/Provider'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Menu = lazy(() => import('./pages/Menu'));
const Rooms = lazy(() => import('./pages/Rooms'));
const Flights = lazy(() => import('./pages/Flights'));
const Packages = lazy(() => import('./pages/Packages'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Verify = lazy(() => import('./pages/Verify'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Addresses = lazy(() => import('./pages/Addresses'));
const Coupons = lazy(() => import('./pages/Coupons'));
const Loyalty = lazy(() => import('./pages/Loyalty'));
const Referral = lazy(() => import('./pages/Referral'));
const Disputes = lazy(() => import('./pages/Disputes'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Faq = lazy(() => import('./pages/Faq'));

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<CenterSpinner />}>
        {children}
      </Suspense>
      <BottomNav />
    </>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<CenterSpinner />}>{children}</Suspense>;
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <CenterSpinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Shell><Home /></Shell>} />
      <Route path="/search" element={<Shell><Search /></Shell>} />
      <Route path="/provider/:id" element={<Shell><Provider /></Shell>} />
      <Route path="/provider/:id/catalog" element={<Shell><Catalog /></Shell>} />
      <Route path="/provider/:id/menu" element={<Shell><Menu /></Shell>} />
      <Route path="/provider/:id/rooms" element={<Shell><Rooms /></Shell>} />
      <Route path="/provider/:id/flights" element={<Shell><Flights /></Shell>} />
      <Route path="/provider/:id/packages" element={<Shell><Packages /></Shell>} />
      <Route path="/item/:providerId/:kind/:itemId" element={<Lazy><ItemDetail /></Lazy>} />
      <Route path="/cart" element={<Shell><Cart /></Shell>} />
      <Route path="/checkout" element={<Lazy><Checkout /></Lazy>} />
      <Route path="/orders" element={<Shell><Orders /></Shell>} />
      <Route path="/orders/:id" element={<Lazy><OrderDetail /></Lazy>} />
      <Route path="/login" element={<Lazy><Login /></Lazy>} />
      <Route path="/register" element={<Lazy><Register /></Lazy>} />
      <Route path="/verify" element={<Lazy><Verify /></Lazy>} />
      <Route path="/forgot-password" element={<Lazy><ForgotPassword /></Lazy>} />
      <Route path="/profile" element={<Shell><Profile /></Shell>} />
      <Route path="/profile/edit" element={<Lazy><ProfileEdit /></Lazy>} />
      <Route path="/notifications" element={<Shell><Notifications /></Shell>} />
      <Route path="/favorites" element={<Shell><Favorites /></Shell>} />
      <Route path="/addresses" element={<Shell><Addresses /></Shell>} />
      <Route path="/coupons" element={<Shell><Coupons /></Shell>} />
      <Route path="/loyalty" element={<Shell><Loyalty /></Shell>} />
      <Route path="/referral" element={<Shell><Referral /></Shell>} />
      <Route path="/disputes" element={<Shell><Disputes /></Shell>} />
      <Route path="/privacy" element={<Lazy><PrivacyPolicy /></Lazy>} />
      <Route path="/faq" element={<Lazy><Faq /></Lazy>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}

function NotFound() {
  useLocale();
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', minHeight: '50vh' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
      <h2>{t('notFound.title')}</h2>
      <p style={{ color: 'var(--muted, #666)', marginTop: 8, marginBottom: 24 }}>{t('notFound.subtitle')}</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>{t('notFound.backHome')}</button>
    </div>
  );
}
