import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Role, Space, Booking, today } from "./pages/types";
import Home from "./pages/Home";
import BookingPage from "./pages/Booking";
import { Account, AdminPage } from "./pages/Other";
import coworxLogoFull from "./assets/coworx-logo-full.png";
import {
  ensureUser,
  backfillUserBookings,
  loadPricing as loadPricingLib,
  loadCompanySettings,
  loadWifi,
  loadUpi,
  watchBanners,
  watchHolidays,
  watchUser,
  watchOffers,
  watchRoleAssignment,
  watchBookingLocks,
  loadDeskPricing,
} from "./lib/firestore";
import "./styles.css";
import "./mobile.css";
import "./branding.css";

const Logo = () => <img className="brandLogoImg" src={coworxLogoFull} alt="coworx central" />;

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>("User");
  const [page, setPage] = useState<string>("home");
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(max-width:900px)")?.matches || false
  );

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [locks, setLocks] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [prices, setPrices] = useState<any>({});
  const [deskPrices, setDeskPrices] = useState<any>({});
  const [company, setCompany] = useState<any>({
    name: "Coworx Central",
    address: "Solapur City, Maharashtra",
    gstNumber: "",
    gstRate: 18,
    phone: "",
    email: "",
  });

  // load company and provide a safe global fallback for legacy callers
  useEffect(() => {
    const unBanners = (watchBanners?.( () => {}, () => {} ) as any) || (() => {});
    const unHolidays = (watchHolidays?.( () => {}, () => {} ) as any) || (() => {});
    loadCompanySettings()
      .then(c => { setCompany(c); (window as any)._coworx_company = c; })
      .catch(() => {});
    return () => { try { unBanners(); unHolidays(); } catch (_) {} };
  }, []);

  useEffect(() => { (window as any)._coworx_company = company; }, [company]);

  // load pricing / upi / wifi
  useEffect(() => {
    loadPricingLib().then(setPrices).catch(() => {});
    loadWifi().catch(() => {});
    loadUpi().catch(() => {});
  }, []);

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (!u) { setRole("User"); return; }
      try {
        const r = await ensureUser(u);
        setRole(r);
        await backfillUserBookings(u.uid);
      } catch (e) { /* ignore for now */ }
    });
    return () => unsub();
  }, []);

  // watch user-scoped data when signed in
  useEffect(() => {
    if (!user) { setBookings([]); setOffers([]); setLocks([]); return; }
    const uUnsub = (watchUser?.(user.uid, user.email || "", setBookings, () => {}) as any) || (() => {});
    const offersUnsub = (watchOffers?.(user.email || "", setOffers) as any) || (() => {});
    const roleUnsub = (watchRoleAssignment?.(user.email || "", () => {}) as any) || (() => {});
    const locksUnsub = (watchBookingLocks?.(today(), setLocks, () => {}) as any) || (() => {});
    (loadDeskPricing as any)?.(today(), {}).then(setDeskPrices).catch(() => {});
    return () => { try { uUnsub(); offersUnsub(); roleUnsub(); locksUnsub(); } catch (_) {} };
  }, [user]);

  const nav = (p: string) => { setPage(p); window.scrollTo(0, 0); };
  const resetBook = () => { setPage("book"); };

  return (
    <div className="app">
      <header>
        <button className="brand" onClick={() => nav("home")}><Logo /></button>
        <nav className="desktopNav">
          <button className={page === "book" ? "navActive" : ""} onClick={resetBook}>Book</button>
          <button className={page === "home" ? "navActive" : ""} onClick={() => nav("home")}>Home</button>
          <button className={page === "ops" ? "navActive" : ""} onClick={() => nav("ops")}>Operations</button>
          <button className={page === "about" ? "navActive" : ""} onClick={() => nav("about")}>About</button>
        </nav>
      </header>

      {page === "home" && (
        <Home
          book={(s: Space) => { setPage("book"); }}
          prices={prices}
          user={user}
          bookings={bookings}
          activeLocks={locks}
          offers={offers}
          nav={nav}
          company={company}
        />
      )}

      <main>
        {page === "book" && (
          <BookingPage
            prices={prices}
            deskPrices={deskPrices}
            date={today()}
            setDate={() => {}}
            space={"desk" as Space}
            setSpace={() => {}}
            conf={"09:00"}
            setConf={() => {}}
            confDuration={1}
            setConfDuration={() => {}}
            meeting={"09:00"}
            setMeeting={() => {}}
            meetingDuration={1}
            setMeetingDuration={() => {}}
            pod={"09:00"}
            setPod={() => {}}
            podDuration={1}
            setPodDuration={() => {}}
            user={user}
            role={role}
            bookings={bookings}
            setBookings={setBookings}
            locks={locks}
            setLocks={setLocks}
            offers={offers}
            setOffers={setOffers}
            prices={prices}
            deskPrices={deskPrices}
            setDeskPrices={setDeskPrices}
            setSelectedSeats={() => {}}
            selectedSeats={[]}
            setCustomerEmail={() => {}}
            customerEmail={""}
            phoneNumber={""}
            setPhoneNumber={() => {}}
            setStaffBooking={() => {}}
            staffBooking={false}
            users={[]}
            company={company}
          />
        )}

        {page === "account" && (
          <Account bookings={bookings} staff={false} onCancel={() => {}} onCheckIn={() => {}} onCheckOut={() => {}} wifi={{}} company={company} />
        )}

        {page === "admin" && (
          <AdminPage
            prices={prices}
            setPrices={setPrices}
            save={() => {}}
            date={today()}
            setDate={() => {}}
            deskPrices={deskPrices}
            setDeskPrices={setDeskPrices}
            saveDeskPrices={() => {}}
            copyPrice={() => {}}
            wifi={{}}
            setWifi={() => {}}
            saveWifi={() => {}}
            upi={{}}
            setUpi={() => {}}
            saveUpi={() => {}}
            managerEmail={""}
            setManagerEmail={() => {}}
            assignManager={() => {}}
            admins={[]}
            setAdmins={() => {}}
            adminLogs={[]}
            setAdminLogs={() => {}}
            company={company}
            saveCompany={(c: any) => {}}
          />
        )}
      </main>
    </div>
  );
}
