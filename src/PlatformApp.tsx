import { DEFAULT_POLICY } from "./lib/business";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { validPhone } from "./lib/customer";
import {
  CalendarDays,
  WalletCards,
  Ticket,
  Plus,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  Users,
  ScanLine,
  X,
  WifiOff,
  ArrowUpRight,
  Camera,
  Inbox,
  Trash2,
} from "lucide-react";
import {
  ADMIN_EMAILS,
  Booking,
  DEFAULT_PRICING,
  localToday,
  nowInRange,
  Role,
  Space,
} from "./pages/types";
import {
  ensureUser,
  watchUser,
  watchAllBookings,
  watchUsers,
  watchAdmins,
  watchAdminLogs,
  watchBanners,
  watchBookingLocks,
  watchOffers,
  watchResourceBlocks,
  watchRoleAssignment,
  saveUserProfile,
  loadDeskPricing,
} from "./lib/firestore";
import {
  activateAssignment,
  watchOwnProfile,
  watchPermissions,
  watchSetting,
} from "./lib/platform";
import {
  canAccess,
  DEFAULT_PERMISSIONS,
  Permission,
  PermissionMatrix,
} from "./lib/permissions";
import CustomerHome from "./pages/CustomerHome";
import Dialog from "./components/Dialog";
import CommandSearch from "./components/CommandSearch";
import InstallApp from "./components/InstallApp";
import UserAvatar from "./components/UserAvatar";
import { DatePicker } from "./pages/DatePicker";
import { prepareProfileImage } from "./lib/profileImage";
import logo from "./assets/coworx-logo-full.png";
const BookingPage = lazy(() => import("./pages/Booking"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const Collections = lazy(() => import("./pages/Collections"));
const CustomerDirectory = lazy(() => import("./pages/CustomerDirectory"));
const Reception = lazy(() => import("./pages/Reception"));
const Administration = lazy(() => import("./pages/Administration"));
const Operations = lazy(() => import("./pages/OperationsSuite"));
const Dashboard = lazy(() => import("./pages/StaffDashboard"));
const Offers = lazy(() =>
  import("./pages/Other").then((m) => ({ default: m.OffersPage })),
);
const Amenities = lazy(() => import("./pages/Amenities"));
const companyDefault = {
  name: "Coworx Central",
  address: "Vinkar Society, C-26, MIDC, Solapur, Maharashtra 413006",
  gstNumber: "",
  gstRate: 18,
  invoicePrefix: "CC",
  phone: "+91 7517517732",
  email: "info@coworxcentral.com",
};
const operationalPages: [string, string, Permission, string][] = [
  ["ops:customers", "Customers", "customersView", "People"],
  ["ops:enquiries", "Enquiries", "enquiriesManage", "People"],
  ["ops:resources", "Maintenance", "resourcesManage", "Workspace"],
  ["ops:holidays", "Holidays", "resourcesManage", "Workspace"],
  ["ops:pricing", "Pricing", "pricingManage", "Workspace"],
  ["ops:catalog", "Plans & offers", "catalogManage", "Workspace"],
  ["ops:wednesday", "Wednesday policy", "pricingManage", "Workspace"],
  ["ops:banners", "Homepage notices", "noticesManage", "Communications"],
  ["ops:comms", "Message templates", "communicationsManage", "Communications"],
  ["ops:revenue", "Booking value", "revenueView", "Finance"],
  ["ops:refunds", "Refunds", "refundsManage", "Finance"],
];
export default function PlatformApp() {
  const [user, setUser] = useState<any>(null),
    [authReady, setAuthReady] = useState(false),
    [profile, setProfile] = useState<any>(null),
    [page, setPage] = useState("home"),
    [menu, setMenu] = useState(false),
    [flash, setFlash] = useState(""),
    [authError, setAuthError] = useState("");
  const [theme, setTheme] = useState(
      () => localStorage.getItem("coworx-theme") || "light",
    ),
    [online, setOnline] = useState(navigator.onLine),
    [command, setCommand] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [profileDraft, setProfileDraft] = useState<any>({}),
    [photoBusy, setPhotoBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<PermissionMatrix>(DEFAULT_PERMISSIONS),
    [admins, setAdmins] = useState<string[]>(ADMIN_EMAILS),
    [users, setUsers] = useState<any[]>([]),
    [logs, setLogs] = useState<any[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [staffBookings, setStaffBookings] = useState<Booking[]>([]),
    [bookingsLoading, setBookingsLoading] = useState(true),
    [staffLoading, setStaffLoading] = useState(true),
    [banners, setBanners] = useState<any[]>([]),
    [offers, setOffers] = useState<any[]>([]),
    [locks, setLocks] = useState<any[]>([]),
    [blocks, setBlocks] = useState<any[]>([]),
    [availabilityLoaded, setAvailabilityLoaded] = useState(false),
    [assignment, setAssignment] = useState<any>(null);
  const [businessPolicy, setBusinessPolicy] = useState<any>(DEFAULT_POLICY);
  const [company, setCompany] = useState<any>(companyDefault),
    [wifi, setWifi] = useState<any>({}),
    [upi, setUpi] = useState<any>({}),
    [prices, setPrices] = useState<any>(DEFAULT_PRICING),
    [deskPrices, setDeskPrices] = useState<any>({});
  const [date, setDate] = useState(localToday()),
    [space, setSpace] = useState<Space>("desk"),
    [selectedSeats, setSelectedSeats] = useState<string[]>([]),
    [staffBooking, setStaffBooking] = useState(false),
    [phoneNumber, setPhoneNumber] = useState("");
  const [meeting, setMeeting] = useState("09:00"),
    [conf, setConf] = useState("09:00"),
    [pod, setPod] = useState("09:00"),
    [meetingDuration, setMeetingDuration] = useState(1),
    [confDuration, setConfDuration] = useState(1),
    [podDuration, setPodDuration] = useState(1);
  const [clock, setClock] = useState(Date.now());
  const businessToday = localToday();
  const [initialCustomer, setInitialCustomer] = useState<any>(null),
    [scanRequest, setScanRequest] = useState(0);
  const routed = useRef("");
  const [customerQuery, setCustomerQuery] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const owner = Boolean(
    user?.emailVerified && ADMIN_EMAILS.includes(user.email?.toLowerCase()),
  );
  const role: Role =
    owner ||
    (user?.emailVerified && admins.includes(user?.email?.toLowerCase()))
      ? "Admin"
      : ["Manager", "Receptionist"].includes(profile?.role)
        ? profile.role
        : "User";
  const can = useCallback(
    (key: Permission) => Boolean(user) && canAccess(role, key, matrix, owner),
    [role, matrix, owner, user?.uid],
  );
  const hasStaffAccess = role !== "User";
  const hasAdmin = PERMISSION_ADMIN.some(can);
  useEffect(() => {
    if (!profile || !user) return;
    const key = `${user.uid}:${role}`;
    if (routed.current === key) return;
    routed.current = key;
    if (hasStaffAccess && !window.location.search)
      setPage(
        role === "Receptionist" && can("checkIn")
          ? "reception"
          : can("bookingsView")
            ? "dashboard"
            : hasAdmin
              ? "administration"
              : "home",
      );
  }, [profile, role, user?.uid]);
  const reportError = useCallback(
    (e: any) => setFlash(e?.message || "Could not load workspace data."),
    [],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("coworx-theme", theme);
  }, [theme]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(""), 7000);
    return () => clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((x) => !x);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(
    () =>
      onAuthStateChanged(auth, async (current) => {
        setUser(current);
        setProfile(null);
        setAuthReady(true);
        setAuthError("");
        if (!current) {
          setBookings([]);
          setStaffBookings([]);
          setUsers([]);
          setMatrix(DEFAULT_PERMISSIONS);
          setBookingsLoading(false);
          return;
        }
        try {
          await ensureUser(current);
        } catch (e: any) {
          setAuthError(e.message || "Could not load your account.");
        }
      }),
    [],
  );
  useEffect(() => {
    if (!user) return;
    const stops = [
      watchOwnProfile(user.uid, setProfile, reportError),
      watchPermissions(setMatrix, reportError),
      watchAdmins(setAdmins, reportError),
      watchRoleAssignment(user.email || "", setAssignment),
      watchOffers(user.email || "", setOffers, reportError),
      watchSetting(
        "company",
        (data) => setCompany({ ...companyDefault, ...data }),
        reportError,
      ),
      watchSetting("wifi", setWifi, reportError),
      watchSetting("upi", setUpi, reportError),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user?.uid]);
  useEffect(() => {
    if (!user) return;
    setBookingsLoading(true);
    return watchUser(
      user.uid,
      user.email,
      (rows) => {
        setBookings(rows);
        setBookingsLoading(false);
      },
      (e) => {
        setBookingsLoading(false);
        reportError(e);
      },
    );
  }, [user?.uid]);
  useEffect(() => {
    const stops = [
      watchBanners(setBanners),
      watchSetting(
        "policy",
        (p) => setBusinessPolicy({ ...DEFAULT_POLICY, ...p }),
        reportError,
      ),
      watchSetting("pricing", (data) =>
        setPrices({ ...DEFAULT_PRICING, ...data }),
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
  useEffect(() => {
    if (!user) {
      setAvailabilityLoaded(false);
      setLocks([]);
      return;
    }
    const a = watchBookingLocks(
        businessToday,
        (rows) => {
          setLocks(rows);
          setAvailabilityLoaded(true);
        },
        reportError,
      ),
      b = watchResourceBlocks(businessToday, setBlocks, reportError);
    return () => {
      a();
      b();
    };
  }, [user?.uid, businessToday]);
  useEffect(() => {
    if (!user) return;
    loadDeskPricing(date, prices).then(setDeskPrices).catch(reportError);
  }, [user?.uid, date, prices]);
  useEffect(() => {
    if (!can("bookingsView") && !can("revenueView") && !can("refundsManage")) {
      setStaffBookings([]);
      setStaffLoading(false);
      return;
    }
    setStaffLoading(true);
    return watchAllBookings(
      (rows) => {
        setStaffBookings(rows);
        setStaffLoading(false);
      },
      (e) => {
        setStaffLoading(false);
        reportError(e);
      },
    );
  }, [can]);
  useEffect(() => {
    if (!can("customersView")) {
      setUsers([]);
      return;
    }
    return watchUsers(setUsers, reportError);
  }, [can]);
  useEffect(() => {
    if (!can("auditView")) {
      setLogs([]);
      return;
    }
    return watchAdminLogs(setLogs, reportError);
  }, [can]);
  useEffect(() => {
    if (
      user &&
      assignment?.status === "accepted" &&
      ["Manager", "Receptionist"].includes(assignment.role) &&
      profile &&
      profile.role !== assignment.role &&
      !owner
    )
      activateAssignment(assignment, user.uid).catch(reportError);
  }, [assignment?.status, assignment?.role, profile?.role, user?.uid]);
  const nav = (next: string) => {
    if (!user && next !== "home" && next !== "amenities") {
      setPage("login");
    } else setPage(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const book = (s: Space = "desk", walkIn = false) => {
    setSpace(s);
    setSelectedSeats([]);
    setDate(localToday());
    setInitialCustomer(null);
    setStaffBooking(walkIn && can("bookingsCreate"));
    nav("book");
  };
  const login = async () => {
    setSaving(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setPage("home");
    } catch (e: any) {
      setAuthError(e.message || "Sign-in failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!authReady) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "book-desk") book("desk");
    if (params.get("action") === "book-meeting") book("meeting");
    if (params.get("view") === "my-bookings") nav("bookings");
  }, [authReady]);
  useEffect(() => {
    if (user && online) void import("./pages/BookingsPage");
  }, [user?.uid, online]);
  const signout = async () => {
    await signOut(auth);
    setPage("home");
    setMenu(false);
    setProfileOpen(false);
    setCompany(companyDefault);
    setWifi({});
    setUpi({});
    setPhoneNumber("");
  };
  const openProfile = () => {
    setProfileDraft({
      phone: profile?.phone || "",
      gender: profile?.gender || "",
      dob: profile?.dob || "",
      profession: profile?.profession || "",
      photoURL: profile?.photoURL || "",
      company: profile?.company || "",
      gstNumber: profile?.gstNumber || "",
      billingAddress: profile?.billingAddress || "",
      reminderPreferences: profile?.reminderPreferences || {
        booking: true,
        expiry: true,
        balance: true,
      },
    });
    setProfileOpen(true);
  };
  const staffPage =
    [
      "dashboard",
      "reception",
      "staff-bookings",
      "administration",
      "passes",
      "collections",
    ].includes(page) ||
    page.startsWith("ops:") ||
    (page === "book" && staffBooking);
  const permitted =
    page === "passes"
      ? can("passesView")
      : page === "collections"
        ? can("collectionsView")
        : page === "dashboard"
          ? can("bookingsView")
          : page === "reception"
            ? can("bookingsView") && (can("checkIn") || can("checkOut"))
            : page === "staff-bookings"
              ? can("bookingsView")
              : page === "administration"
                ? hasAdmin
                : page.startsWith("ops:")
                  ? can(
                      operationalPages.find(
                        ([id]) => id === page,
                      )?.[2] as Permission,
                    )
                  : true;
  const liveLocks = locks.filter(
    (l) =>
      l.status === "Confirmed" ||
      (l.status === "Pending" && (l.expiresAt?.toMillis?.() || 0) > clock),
  );
  const activeBanners = banners.filter(
    (b) =>
      b.active !== false &&
      nowInRange(b.startDate, b.endDate, b.startTime, b.endTime),
  );
  const goDesk = (id: string) => {
    book("desk");
    setSelectedSeats([id]);
  };
  const navButton = (id: string, label: string, Icon: any) => (
    <button
      key={id}
      className={page === id ? "active" : ""}
      onClick={() => nav(id)}
    >
      <Icon size={18} />
      {label}
    </button>
  );
  return (
    <div className="platformApp">
      <header className={`siteHeader ${staffPage ? "staffHeader" : ""}`}>
        <button
          className="siteBrand"
          onClick={() => nav("home")}
          aria-label="Coworx Central home"
        >
          <img src={logo} alt="Coworx Central" />
        </button>
        {!staffPage && (
          <nav className="siteNav" aria-label="Main navigation">
            <button
              className={page === "home" ? "active" : ""}
              onClick={() => nav("home")}
            >
              Home
            </button>
            <button
              className={page === "book" ? "active" : ""}
              onClick={() => book()}
            >
              Workspaces
            </button>
            {user && (
              <button
                className={page === "bookings" ? "active" : ""}
                onClick={() => nav("bookings")}
              >
                My bookings
              </button>
            )}
            <button onClick={() => nav(user ? "offers" : "amenities")}>
              {user ? "Offers" : "Amenities"}
            </button>
            {hasStaffAccess && (
              <button
                className={staffPage ? "active" : ""}
                onClick={() =>
                  nav(
                    can("bookingsView")
                      ? "dashboard"
                      : hasAdmin
                        ? "administration"
                        : operationalPages.find(([, , p]) => can(p))?.[0] ||
                          "home",
                  )
                }
              >
                Staff workspace
              </button>
            )}
          </nav>
        )}
        <div className="headerTools">
          <button
            className="commandTrigger"
            onClick={() => setCommand(true)}
            aria-label="Open search"
          >
            <Search size={17} />
            {staffPage && <span>Search customer or desk</span>}
            <kbd>Ctrl K</kbd>
          </button>
          <button
            className="iconButton"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <button
              className="accountAvatar"
              onClick={openProfile}
              aria-label="Open my profile"
            >
              <UserAvatar
                profile={{
                  ...user,
                  ...profile,
                  name: profile?.name || user.displayName,
                }}
                size={44}
              />
            </button>
          ) : (
            <button className="primary small" onClick={login} disabled={saving}>
              {saving ? "Signing in…" : "Sign in"}
              <ArrowUpRight size={15} />
            </button>
          )}
          <button
            className="iconButton mobileOnly"
            onClick={() => setMenu(!menu)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
        </div>
      </header>
      {staffPage && (
        <div className="staffCommandBar">
          <nav className="primaryStaffNav" aria-label="Daily work">
            {can("bookingsView") &&
              navButton(
                role === "Receptionist" ? "reception" : "dashboard",
                role === "Receptionist" ? "Front Desk" : "Overview",
                LayoutDashboard,
              )}
            {role !== "Receptionist" &&
              (can("checkIn") || can("checkOut")) &&
              navButton("reception", "Front Desk", ScanLine)}
            {can("bookingsView") &&
              navButton("staff-bookings", "All bookings", CalendarDays)}
            {can("enquiriesManage") &&
              navButton("ops:enquiries", "Enquiries", Inbox)}
            {can("customersView") &&
              navButton("ops:customers", "Customers", Users)}
            {can("passesView") && navButton("passes", "Passes", Ticket)}
            {can("collectionsView") &&
              navButton("collections", "Collections", WalletCards)}
          </nav>
          <div className="staffQuickActions">
            {(can("checkIn") || can("checkOut")) && (
              <button
                className="ghost"
                onClick={() => {
                  nav("reception");
                  setScanRequest((x) => x + 1);
                }}
              >
                <ScanLine size={19} />
                Scan pass
              </button>
            )}
            {can("bookingsCreate") && (
              <button className="primary" onClick={() => book("desk", true)}>
                <Plus size={19} />
                New booking
              </button>
            )}
          </div>
        </div>
      )}
      {!online && (
        <div className="offlineBanner" role="status">
          <WifiOff size={17} /> You’re offline. Saved bookings and passes remain
          available. Reconnect to make changes.
        </div>
      )}
      {authError && (
        <div className="inlineError accountError" role="alert">
          {authError}
        </div>
      )}
      {assignment?.status === "pending" && user && (
        <div className="roleInvitation">
          You’ve been invited as {assignment.role}.
          <button
            className="primary small"
            onClick={() =>
              activateAssignment(assignment, user.uid)
                .then(() => setFlash("Staff access activated."))
                .catch(reportError)
            }
          >
            Accept role
          </button>
        </div>
      )}
      {menu && (
        <div className="mobileNavigation">
          <div className="dialogHeading">
            <h3>Menu</h3>
            <button
              className="iconButton"
              onClick={() => setMenu(false)}
              aria-label="Close menu"
            >
              <X />
            </button>
          </div>
          {navButton("home", "Home", Home)}
          {navButton("book", "Book a workspace", CalendarDays)}
          {user && navButton("bookings", "My bookings", CalendarDays)}
          {hasStaffAccess &&
            navButton("dashboard", "Staff workspace", LayoutDashboard)}
          {staffPage && (
            <>
              {can("bookingsView") &&
                navButton("staff-bookings", "All bookings", CalendarDays)}
              {(can("checkIn") || can("checkOut")) &&
                navButton("reception", "Front desk", ScanLine)}
              {operationalPages
                .filter(([, , p]) => can(p))
                .map(([id, label]) => navButton(id, label, Settings2))}
              {hasAdmin &&
                navButton("administration", "Administration", Settings2)}
            </>
          )}
          {user && (
            <button onClick={signout}>
              <LogOut size={18} /> Sign out
            </button>
          )}
        </div>
      )}
      <div className={staffPage ? "staffLayout" : "customerLayout"}>
        {staffPage && (
          <aside className="workspaceSidebar">
            <span className="sidebarEyebrow">ADVANCED TOOLS</span>
            {operationalPages
              .filter(
                ([id, , permission]) =>
                  !["ops:customers", "ops:enquiries"].includes(id) &&
                  can(permission),
              )
              .map(([id, label, , group], i, all) => (
                <div key={id}>
                  {(!i || all[i - 1][3] !== group) && (
                    <span className="sidebarGroup">{group}</span>
                  )}
                  {navButton(id, label, Settings2)}
                </div>
              ))}
            {hasAdmin &&
              navButton("administration", "Business settings", Settings2)}
            <div className="sidebarIdentity">
              <UserAvatar
                profile={{
                  ...user,
                  ...profile,
                  name: profile?.name || user?.displayName,
                }}
                size={38}
              />
              <span>
                <b>{user?.displayName?.split(" ")[0]}</b>
                <small>{owner ? "Owner" : role}</small>
              </span>
            </div>
          </aside>
        )}
        <div className="pageContent">
          <Suspense
            fallback={
              <div className="pageSkeleton">
                <div
                  className="skeleton"
                  style={{ height: 48, width: "60%" }}
                />
                <div className="skeleton" style={{ height: 300 }} />
              </div>
            }
          >
            {!permitted ? (
              <section className="workspacePage">
                <div className="emptyState surface">
                  <Settings2 />
                  <h2>Access is not enabled</h2>
                  <p>Ask an owner to enable this capability for your role.</p>
                  <button className="primary" onClick={() => nav("home")}>
                    Back to home
                  </button>
                </div>
              </section>
            ) : (
              <>
                {page === "home" && (
                  <CustomerHome
                    user={user}
                    prices={prices}
                    profile={profile}
                    policy={businessPolicy}
                    bookings={bookings}
                    activeLocks={liveLocks}
                    maintenance={blocks}
                    offers={offers}
                    upi={upi}
                    banners={activeBanners}
                    availabilityLoaded={availabilityLoaded}
                    online={online}
                    wifi={wifi}
                    company={company}
                    nav={nav}
                    book={book}
                  />
                )}
                {page === "login" && (
                  <section className="loginView">
                    <span className="eyebrow">WELCOME TO COWORX CENTRAL</span>
                    <h1>
                      Your next great workday
                      <br />
                      starts here.
                    </h1>
                    <p>
                      Sign in to book a workspace, manage your visits, and keep
                      your digital pass handy.
                    </p>
                    <button
                      className="primary"
                      disabled={saving}
                      onClick={login}
                    >
                      {saving ? "Signing in…" : "Continue with Google"}
                    </button>
                  </section>
                )}
                {page === "book" && user && (
                  <BookingPage
                    user={user}
                    role={role}
                    staff={can("bookingsCreate")}
                    canConfirm={can("paymentsCollect")}
                    canDiscount={can("bookingsDiscount")}
                    initialCustomer={initialCustomer}
                    canCreateCustomer={can("customersCreate")}
                    users={users}
                    nav={nav}
                    date={date}
                    setDate={setDate}
                    space={space}
                    setSpace={setSpace}
                    selectedSeats={selectedSeats}
                    setSelectedSeats={setSelectedSeats}
                    staffBooking={staffBooking}
                    setStaffBooking={setStaffBooking}
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                    myProfile={{
                      mobile: profile?.phone || "",
                      gender: profile?.gender || "",
                      dob: profile?.dob || "",
                      profession: profile?.profession || "",
                      company: profile?.company || "",
                      gstNumber: profile?.gstNumber || "",
                      billingAddress: profile?.billingAddress || "",
                      reminderPreferences: profile?.reminderPreferences || {
                        booking: true,
                        expiry: true,
                        balance: true,
                      },
                    }}
                    onProfileSaved={(data: any) =>
                      setProfile({ ...profile, ...data, phone: data.mobile })
                    }
                    offers={offers}
                    prices={prices}
                    deskPrices={deskPrices}
                    meeting={meeting}
                    setMeeting={setMeeting}
                    conf={conf}
                    setConf={setConf}
                    pod={pod}
                    setPod={setPod}
                    meetingDuration={meetingDuration}
                    setMeetingDuration={setMeetingDuration}
                    confDuration={confDuration}
                    setConfDuration={setConfDuration}
                    podDuration={podDuration}
                    setPodDuration={setPodDuration}
                  />
                )}
                {(page === "bookings" ||
                  page === "staff-bookings" ||
                  page === "passes") &&
                  user && (
                    <BookingsPage
                      key={page}
                      user={user}
                      bookings={page !== "bookings" ? staffBookings : bookings}
                      staff={page !== "bookings"}
                      passesOnly={page === "passes"}
                      can={can}
                      company={company}
                      wifi={wifi}
                      onFlash={setFlash}
                      loading={
                        page !== "bookings" ? staffLoading : bookingsLoading
                      }
                      book={() => book("desk", page !== "bookings")}
                    />
                  )}
                {page === "dashboard" && (
                  <Dashboard
                    user={user}
                    bookings={staffBookings}
                    locks={liveLocks}
                    blocks={blocks}
                    can={can}
                    nav={nav}
                    loading={staffLoading}
                    bookCustomer={() => book("desk", true)}
                  />
                )}
                {page === "reception" && (
                  <Reception
                    scanRequest={scanRequest}
                    bookings={staffBookings}
                    can={can}
                    onFlash={setFlash}
                    bookCustomer={() => book("desk", true)}
                  />
                )}
                {page === "administration" && (
                  <Administration
                    user={user}
                    company={company}
                    wifi={wifi}
                    upi={upi}
                    users={users}
                    admins={admins}
                    logs={logs}
                    matrix={matrix}
                    bookings={staffBookings}
                    can={can}
                    onFlash={setFlash}
                  />
                )}
                {page === "collections" && (
                  <Collections
                    bookings={staffBookings}
                    can={can}
                    company={company}
                    onFlash={setFlash}
                  />
                )}
                {page === "ops:customers" && (
                  <CustomerDirectory
                    users={users}
                    bookings={staffBookings}
                    user={user}
                    can={can}
                    company={company}
                    onFlash={setFlash}
                    initialQuery={customerQuery}
                    bookCustomer={(customer: any) => {
                      book("desk", true);
                      setInitialCustomer(customer);
                    }}
                  />
                )}
                {page.startsWith("ops:") && page !== "ops:customers" && (
                  <Operations
                    key={page}
                    initialTab={page.slice(4)}
                    initialQuery={customerQuery}
                    users={users}
                    bookings={staffBookings}
                    admins={admins}
                    adminLogs={logs}
                    actorUid={user?.uid}
                    actorEmail={user?.email}
                    can={can}
                    onFlash={setFlash}
                  />
                )}
                {page === "offers" && user && <Offers offers={offers} />}
                {page === "amenities" && <Amenities />}
              </>
            )}
          </Suspense>
        </div>
      </div>
      <footer className="siteFooter">
        <div>
          <b>Coworx Central</b>
          <span>Work. Connect. Create.</span>
        </div>
        <span>Vinkar Society, C-26, MIDC, Solapur</span>
        <a href="mailto:info@coworxcentral.com">
          Say hello <ArrowUpRight size={15} />
        </a>
      </footer>
      {flash && (
        <div className="platformToast" role="status">
          <span>{flash}</span>
          <button
            className="iconButton"
            onClick={() => setFlash("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {command && (
        <CommandSearch
          users={users}
          openCustomer={(customer: any) => {
            setCustomerQuery(customer.email);
            nav("ops:customers");
          }}
          bookings={staffBookings}
          can={can}
          nav={nav}
          bookDesk={goDesk}
          prices={prices}
          onClose={() => setCommand(false)}
        />
      )}
      {profileOpen && (
        <Dialog title="Your profile" onClose={() => setProfileOpen(false)}>
          <div className="profilePhotoEditor">
            <UserAvatar
              profile={{ ...user, ...profileDraft, name: user?.displayName }}
              size={78}
            />
            <div>
              <strong>{user?.displayName}</strong>
              <span>{user?.email}</span>
              <small>
                Profile photo is optional. A gender-based avatar is used when
                none is added.
              </small>
            </div>
            <label className="ghost profilePhotoButton">
              <Camera size={17} />
              {photoBusy
                ? "Preparing…"
                : profileDraft.photoURL
                  ? "Change photo"
                  : "Add photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={photoBusy || saving}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoBusy(true);
                  try {
                    const photoURL = await prepareProfileImage(file);
                    setProfileDraft({ ...profileDraft, photoURL });
                  } catch (error) {
                    reportError(error);
                  } finally {
                    setPhotoBusy(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {profileDraft.photoURL && (
              <button
                className="textButton dangerText"
                type="button"
                onClick={() =>
                  setProfileDraft({ ...profileDraft, photoURL: "" })
                }
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>
          <div className="fieldGrid">
            {[
              ["phone", "Mobile", "tel"],
              ["profession", "Profession", "text"],
            ].map(([key, label, type]) => (
              <label key={key}>
                {label}
                <input
                  type={type}
                  value={profileDraft[key] || ""}
                  onChange={(e) =>
                    setProfileDraft({ ...profileDraft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <div className="customerDateField">
              <DatePicker
                label="Date of birth"
                value={profileDraft.dob || ""}
                min="1900-01-01"
                max={localToday()}
                placeholder="Choose date of birth"
                onChange={(dob) => setProfileDraft({ ...profileDraft, dob })}
              />
            </div>
            <label>
              Gender
              <select
                value={profileDraft.gender || ""}
                onChange={(e) =>
                  setProfileDraft({ ...profileDraft, gender: e.target.value })
                }
              >
                <option value="">Prefer not to say</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </label>
          </div>
          <div className="fieldGrid">
            {[
              ["company", "Company"],
              ["gstNumber", "GST number"],
              ["billingAddress", "Billing address"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={profileDraft[key] || ""}
                  onChange={(e) =>
                    setProfileDraft({ ...profileDraft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="preferenceRow">
            {[
              ["booking", "Booking reminders"],
              ["expiry", "Pass expiry reminders"],
              ["balance", "Payment reminders"],
            ].map(([key, label]) => (
              <label className="checkLabel" key={key}>
                <input
                  type="checkbox"
                  checked={profileDraft.reminderPreferences?.[key] !== false}
                  onChange={(e) =>
                    setProfileDraft({
                      ...profileDraft,
                      reminderPreferences: {
                        ...profileDraft.reminderPreferences,
                        [key]: e.target.checked,
                      },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="formActions">
            <button className="textButton" onClick={signout}>
              <LogOut size={16} /> Sign out
            </button>
            <button
              className="primary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  if (profileDraft.phone && !validPhone(profileDraft.phone))
                    throw Error("Enter a mobile number with 10–15 digits.");
                  await saveUserProfile(user.uid, profileDraft);
                  setProfileOpen(false);
                  setFlash("Profile saved.");
                } catch (e) {
                  reportError(e);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </Dialog>
      )}
      {!staffPage && <InstallApp />}
    </div>
  );
}
const PERMISSION_ADMIN: Permission[] = [
  "companyManage",
  "paymentsManage",
  "wifiManage",
  "policyManage",
  "teamManage",
  "auditView",
];
