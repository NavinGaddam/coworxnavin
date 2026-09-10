import Dialog from "../components/Dialog";
import CustomerPicker from "../components/CustomerPicker";
import DeskRates from "../components/DeskRates";
import EnquiryCRM from "../components/EnquiryCRM";
import { HomepageContentEditor } from "../components/HomepagePossibilities";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Gift,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Tag,
  Users,
  WalletCards,
  Trash2,
  Megaphone,
  ReceiptText,
  UserSearch,
  CalendarX,
  Building2,
  Zap,
  ExternalLink,
} from "lucide-react";
import { auth } from "../firebase";
import {
  addHours,
  BUSINESS_END,
  BUSINESS_START,
  dateSpan,
  desks,
  Space,
  spaceLabel,
  today,
  localToday,
  DEFAULT_PRICING,
} from "./types";
import {
  assignMembership,
  createAddon,
  createCoupon,
  createOffer,
  createMembershipPlan,
  loadNotificationTemplates,
  loadOperationsSettings,
  loadPolicy,
  removeResourceBlock,
  saveNotificationTemplates,
  saveOperationsSettings,
  savePermissions,
  savePolicy,
  saveShift,
  setCustomerBlock,
  setResourceBlock,
  toggleAddon,
  toggleCoupon,
  toggleOffer,
  setCouponVisibility,
  setOfferVisibility,
  updateCustomer,
  updateRefund,
  watchAddons,
  watchCoupons,
  watchAllOffers,
  watchMembershipPlans,
  watchResourceBlocks,
  watchHolidays,
  setHoliday,
  removeHoliday,
  watchBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  watchPricingRules,
  savePricingRule,
  deletePricingRule,
  loadCompanySettings,
  saveCompanySettings,
  watchEnquiries,
  createEnquiry,
  updateEnquiry,
  savePricing,
} from "../lib/firestore";
import { DateRangePicker, DatePicker } from "./DatePicker";
import "./operations-suite.css";
const money = (n: number) =>
  `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;
const dayValue = (b: any) => Number(b.days || 1);
const isActive = (b: any) =>
  b.status === "Confirmed" ||
  (b.status === "Pending" && (b.expiresAt?.toMillis?.() || 0) > Date.now());
const emailOf = (x: any) =>
  String(x.email || x.customerEmail || x.userEmail || "").toLowerCase();
const csv = (rows: any[][]) =>
  rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
const download = (name: string, text: string, type = "text/csv") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
export default function OperationsSuite({
  users = [],
  bookings = [],
  admins = [],
  adminLogs = [],
  actorUid = "",
  actorEmail = "",
  onFlash = () => {},
  can = () => false,
  initialTab = "resources",
  initialQuery = "",
}: any) {
  const [newCustomer, setNewCustomer] = useState(false);
  const [tab, setTab] = useState(initialTab),
    [queryText, setQueryText] = useState(initialQuery),
    [policy, setPolicy] = useState<any>({
      maxAdvanceDays: 60,
      businessStart: BUSINESS_START,
      businessEnd: BUSINESS_END,
    }),
    [ops, setOps] = useState<any>({
      referralEnabled: true,
      referralRewardPercent: 5,
      weekendMultiplier: 1,
      peakMultiplier: 1,
    }),
    [templates, setTemplates] = useState<any>({}),
    [coupons, setCoupons] = useState<any[]>([]),
    [offers, setOffers] = useState<any[]>([]),
    [plans, setPlans] = useState<any[]>([]),
    [addons, setAddons] = useState<any[]>([]);
  const [coupon, setCoupon] = useState<any>({
      code: "",
      type: "percent",
      value: 10,
      maxUses: 100,
      maxUsesPerCustomer: 1,
      visibleToUsers: true,
      active: true,
    }),
    [offer,setOffer]=useState<any>({title:"",description:"",type:"percent",value:10,targetType:"all",targetEmail:"",visibleToUsers:true,autoApply:true}),
    [plan, setPlan] = useState<any>({
      name: "",
      description: "",
      price: 5000,
      days: 30,
      deskDays: 20,
    }),
    [addon, setAddon] = useState<any>({
      name: "",
      unitPrice: 50,
      space: "all",
    }),
    [selectedDate, setSelectedDate] = useState(today()),
    [blockToDate, setBlockToDate] = useState(today()),
    [blocking, setBlocking] = useState(false),
    [block, setBlock] = useState<any>({
      inventoryId: "D01",
      reason: "Maintenance",
    }),
    [membershipUser, setMembershipUser] = useState("");
  const [customerDraft, setCustomerDraft] = useState<any>({}),
    [permissionDraft, setPermissionDraft] = useState<any>({
      Manager: {
        book: true,
        confirm: true,
        pricing: false,
        customers: true,
        refunds: false,
      },
      Admin: {
        book: true,
        confirm: true,
        pricing: true,
        customers: true,
        refunds: true,
      },
    }),
    [shift, setShift] = useState<any>({
      morning: "09:00–15:00",
      evening: "15:00–19:00",
      note: "",
    }),
    [refundDraft, setRefundDraft] = useState<any>({}),
    [refundMethod,setRefundMethod] = useState<any>({});
  const [pricingRules, setPricingRules] = useState<any[]>([]),
    [ruleForm, setRuleForm] = useState<any>({
      label: "",
      startDate: today(),
      endDate: today(),
      standing: false,
      ...DEFAULT_PRICING,
    });
  const [holidays, setHolidays] = useState<any[]>([]),
    [holidayForm, setHolidayForm] = useState<any>({
      date: today(),
      reason: "",
    });
  const [banners, setBanners] = useState<any[]>([]),
    [bannerForm, setBannerForm] = useState<any>({
      kind: "offer",
      title: "",
      message: "",
      startDate: today(),
      endDate: today(),
      startTime: "",
      endTime: "",
    });
  const [enquiries, setEnquiries] = useState<any[]>([]),
    [enquiryForm, setEnquiryForm] = useState<any>({
      name: "",
      phone: "",
      email: "",
      interest: "desk",
      notes: "",
    });
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => {
    const a = watchPricingRules(setPricingRules),
      b = watchHolidays(setHolidays),
      c = watchBanners(setBanners),
      d = can("enquiriesManage") ? watchEnquiries(setEnquiries) : () => {};
    return () => {
      a();
      b();
      c();
      d();
    };
  }, []);
  const uid = actorUid || auth.currentUser?.uid || "",
    email = actorEmail || auth.currentUser?.email || "";
  const [blockedToday, setBlockedToday] = useState<any[]>([]);
  useEffect(() => {
    const u = watchResourceBlocks(today(), setBlockedToday);
    return () => u();
  }, []);
  const [selectedDateBlocks, setSelectedDateBlocks] = useState<any[]>([]);
  useEffect(() => {
    const u = watchResourceBlocks(selectedDate, setSelectedDateBlocks);
    return () => u();
  }, [selectedDate]);
  useEffect(() => {
    loadPolicy()
      .then(setPolicy)
      .catch(() => {});
    loadOperationsSettings()
      .then(setOps)
      .catch(() => {});
    loadNotificationTemplates()
      .then(setTemplates)
      .catch(() => {});
    const a = watchCoupons(setCoupons),
      o = watchAllOffers(setOffers),
      b = watchMembershipPlans(setPlans),
      c = watchAddons(setAddons);
    return () => {
      a();
      o();
      b();
      c();
    };
  }, []);
  const confirmed = bookings.filter((b: any) => b.status === "Confirmed"),
    pending = bookings.filter(
      (b: any) => b.status === "Pending" && isActive(b),
    ),
    cancelled = bookings.filter((b: any) => b.status === "Cancelled"),
    revenue = confirmed.reduce(
      (n: number, b: any) => n + Number(b.total || 0),
      0,
    ),
    todayBookings = bookings.filter(
      (b: any) => b.date === today() || b.endDate === today(),
    );
  const utilization = Math.round(
    (todayBookings
      .filter((b: any) => b.status === "Confirmed")
      .reduce((n: number, b: any) => n + (b.inventoryIds?.length || 1), 0) /
      22) *
      100,
  );
  const nowTime = useMemo(() => new Date().toTimeString().slice(0, 5), []);
  const activeBlocks = useMemo(
    () => blockedToday.filter((r: any) => r.active !== false),
    [blockedToday],
  );
  const deskBookingsToday = useMemo(
    () => todayBookings.filter((b: any) => b.space === "desk" && isActive(b)),
    [todayBookings],
  );
  const deskHeld = useMemo(
    () =>
      deskBookingsToday
        .filter((b: any) => b.status === "Pending")
        .reduce((n: number, b: any) => n + (b.inventoryIds?.length || 1), 0),
    [deskBookingsToday],
  );
  const deskOccupied = useMemo(
    () =>
      deskBookingsToday
        .filter((b: any) => b.status === "Confirmed")
        .reduce((n: number, b: any) => n + (b.inventoryIds?.length || 1), 0),
    [deskBookingsToday],
  );
  const deskMaintenance = useMemo(
    () =>
      activeBlocks.filter((r: any) => /^(desk-)?D\d/.test(r.inventoryId || ""))
        .length,
    [activeBlocks],
  );
  const deskAvailable = Math.max(
    0,
    22 - deskHeld - deskOccupied - deskMaintenance,
  );
  const attentionItems = useMemo(() => {
    const out: { key: string; tone: string; label: string }[] = [];
    for (const b of pending.slice(0, 3))
      out.push({
        key: `p-${b.id}`,
        tone: "warn",
        label: `Payment pending — ${b.customerName || b.customerEmail || "customer"} · ${spaceLabel(b.space)}`,
      });
    for (const b of todayBookings.filter(
      (x: any) =>
        x.status === "Confirmed" &&
        x.start &&
        !x.checkedInAt &&
        x.start <= addHours(nowTime, 1) &&
        x.start >= nowTime,
    ))
      out.push({
        key: `a-${b.id}`,
        tone: "info",
        label: `Arriving soon — ${b.customerName || b.customerEmail || "customer"} · ${spaceLabel(b.space)} ${b.start}`,
      });
    for (const b of todayBookings.filter(
      (x: any) =>
        x.checkedInAt &&
        !x.checkedOutAt &&
        (x.end ? x.end < nowTime : nowTime > BUSINESS_END),
    ))
      out.push({
        key: `o-${b.id}`,
        tone: "danger",
        label: `Check-out overdue — ${b.customerName || b.customerEmail || "customer"} · ${spaceLabel(b.space)}`,
      });
    return out.slice(0, 5);
  }, [pending, todayBookings, nowTime]);
  const customerRows = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return users.filter(
      (u: any) =>
        !q ||
        [u.name, u.email, u.phone, u.profession, u.company]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  }, [users, queryText]);
  const serviceRevenue = useMemo(() => {
    const out: any = { desk: 0, meeting: 0, conference: 0, podcast: 0 };
    confirmed.forEach(
      (b: any) => (out[b.space] = (out[b.space] || 0) + Number(b.total || 0)),
    );
    return out;
  }, [confirmed]);
  const topCustomers = useMemo(() => {
    const map = new Map<string, any>();
    for (const b of confirmed) {
      const e = emailOf(b);
      const row = map.get(e) || {
        email: e,
        name: b.customerName || e,
        spend: 0,
        bookings: 0,
      };
      row.spend += Number(b.total || 0);
      row.bookings++;
      map.set(e, row);
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend).slice(0, 6);
  }, [confirmed]);
  const savePolicyAll = async () => {
    try {
      await savePolicy(policy);
      await saveOperationsSettings(ops);
      onFlash("Operating policies saved.");
    } catch (e: any) {
      onFlash(e.message || "Could not save policies");
    }
  };
  const saveComms = async () => {
    try {
      await saveNotificationTemplates(templates);
      onFlash("WhatsApp templates saved.");
    } catch (e: any) {
      onFlash(e.message || "Could not save templates");
    }
  };
  const addCoupon = async () => {
    try {
      await createCoupon(coupon, uid);
      setCoupon({
        code: "",
        type: "percent",
        value: 10,
        maxUses: 100,
        maxUsesPerCustomer: 1,
        visibleToUsers: true,
        active: true,
      });
      onFlash("Coupon saved.");
    } catch (e: any) {
      onFlash(e.message || "Could not save coupon");
    }
  };
  const addOffer=async()=>{try{await createOffer(offer,uid);setOffer({title:"",description:"",type:"percent",value:10,targetType:"all",targetEmail:"",visibleToUsers:true,autoApply:true});onFlash("Offer published.");}catch(e:any){onFlash(e.message||"Could not save offer");}};
  const changePromotion=async(action:()=>Promise<void>,message:string)=>{try{await action();onFlash(message);}catch(e:any){onFlash(e.message||"Could not update this promotion.");}};
  const addPlan = async () => {
    try {
      await createMembershipPlan(plan, uid);
      setPlan({
        name: "",
        description: "",
        price: 5000,
        days: 30,
        deskDays: 20,
      });
      onFlash("Membership plan created.");
    } catch (e: any) {
      onFlash(e.message || "Could not create plan");
    }
  };
  const addAddon = async () => {
    try {
      await createAddon(addon, uid);
      setAddon({ name: "", unitPrice: 50, space: "all" });
      onFlash("Add-on created.");
    } catch (e: any) {
      onFlash(e.message || "Could not create add-on");
    }
  };
  const updateCustomerRow = async (u: any, patch: any) => {
    try {
      await updateCustomer(u.uid, patch, uid, email);
      onFlash(`Customer ${u.email} updated.`);
    } catch (e: any) {
      onFlash(e.message || "Could not update customer");
    }
  };
  const toggleBlock = async (u: any) => {
    try {
      await setCustomerBlock(
        u.uid,
        !u.blocked,
        customerDraft[u.uid]?.blockedReason ||
          "Repeated policy or payment issue",
        uid,
        email,
      );
      onFlash(u.blocked ? "Customer unblocked." : "Customer blocked.");
    } catch (e: any) {
      onFlash(e.message || "Could not change customer access");
    }
  };
  const exportBookings = () =>
    download(
      `coworx-bookings-${today()}.csv`,
      csv([
        [
          "Invoice",
          "Customer",
          "Email",
          "Phone",
          "Space",
          "Date",
          "End date",
          "Start",
          "End",
          "Status",
          "Payment",
          "Amount",
        ],
        ...bookings.map((b: any) => [
          b.invoiceNumber || "",
          b.customerName || "",
          b.customerEmail || b.userEmail || "",
          b.customerPhone || "",
          spaceLabel(b.space),
          b.date,
          b.endDate || b.date,
          b.start || "09:00",
          b.end || "19:00",
          b.status,
          b.paymentStatus || b.paymentMethod || "",
          b.total,
        ]),
      ]),
    );
  const exportCustomers = () =>
    download(
      `coworx-customers-${today()}.csv`,
      csv([
        [
          "Name",
          "Email",
          "Phone",
          "Profession",
          "Company",
          "VIP",
          "Blocked",
          "Bookings",
          "Spend",
        ],
        ...users.map((u: any) => [
          u.name,
          u.email,
          u.phone || "",
          u.profession || "",
          u.company || "",
          u.vip ? "Yes" : "No",
          u.blocked ? "Yes" : "No",
          u.bookingCount || 0,
          u.totalSpend || 0,
        ]),
      ]),
    );
  const sendBroadcast = () => {
    const text =
      templates.broadcast ||
      "Coworx Central update: new offers and workspace slots are now available.";
    const recipients = users.filter((u: any) => u.phone).slice(0, 20);
    for (const u of recipients) {
      const ph = String(u.phone).replace(/\D/g, "");
      if (ph)
        window.open(
          `https://wa.me/${ph.length === 10 ? `91${ph}` : ph}?text=${encodeURIComponent(text.replaceAll("{name}", u.name || "there"))}`,
          "_blank",
        );
    }
    onFlash(`Opened WhatsApp for ${recipients.length} saved contacts.`);
  };
  const waLink = (phone: string, text: string) => {
    const ph = String(phone || "").replace(/\D/g, "");
    if (!ph) return "";
    return `https://wa.me/${ph.length === 10 ? `91${ph}` : ph}?text=${encodeURIComponent(text)}`;
  };
  const conflictsFor = (date: string) =>
    bookings.filter(
      (b: any) =>
        (b.status === "Confirmed" || b.status === "Pending") &&
        (b.dates?.includes(date) ||
          (b.date <= date && (b.endDate || b.date) >= date)),
    );
  const saveRule = async () => {
    try {
      const pricingFields = Object.fromEntries(
        Object.keys(DEFAULT_PRICING).map((k) => [k, Number(ruleForm[k] || 0)]),
      );
      if (ruleForm.standing) {
        await savePricing(pricingFields);
        onFlash("Standing default pricing updated for all days.");
      } else {
        if (!ruleForm.label.trim())
          return onFlash("Enter a label for this pricing rule.");
        if (ruleForm.endDate < ruleForm.startDate)
          return onFlash("End date must be on or after the start date.");
        await savePricingRule(
          {
            label: ruleForm.label,
            startDate: ruleForm.startDate,
            endDate: ruleForm.endDate,
            pricing: pricingFields,
          },
          uid,
        );
        onFlash(
          "Seasonal pricing rule saved. Already-booked dates are unaffected.",
        );
      }
      setRuleForm({
        label: "",
        startDate: today(),
        endDate: today(),
        standing: false,
        ...DEFAULT_PRICING,
      });
    } catch (e: any) {
      onFlash(e.message || "Could not save pricing");
    }
  };
  const addHoliday = async () => {
    try {
      if (!holidayForm.date) return onFlash("Pick a holiday date.");
      await setHoliday(holidayForm.date, holidayForm.reason || "Holiday", uid);
      setHolidayForm({ date: today(), reason: "" });
      onFlash("Holiday marked. All services are blocked that day.");
    } catch (e: any) {
      onFlash(e.message || "Could not mark holiday");
    }
  };
  const addBanner = async () => {
    try {
      if (!bannerForm.title.trim()) return onFlash("Enter a banner title.");
      await createBanner(bannerForm, uid);
      setBannerForm({
        kind: "offer",
        title: "",
        message: "",
        startDate: today(),
        endDate: today(),
        startTime: "",
        endTime: "",
      });
      onFlash("Banner created.");
    } catch (e: any) {
      onFlash(e.message || "Could not create banner");
    }
  };
  const addEnquiry = async () => {
    try {
      if (!enquiryForm.name.trim())
        return onFlash("Enter a name for the enquiry.");
      await createEnquiry(enquiryForm, uid);
      setEnquiryForm({
        name: "",
        phone: "",
        email: "",
        interest: "desk",
        notes: "",
      });
      onFlash("Enquiry logged.");
    } catch (e: any) {
      onFlash(e.message || "Could not log enquiry");
    }
  };
  const bookedEmails = useMemo(
    () => new Set(bookings.map((b: any) => emailOf(b)).filter(Boolean)),
    [bookings],
  );
  const autoEnquiries = useMemo(
    () =>
      users.filter(
        (u: any) => !(u.bookingCount > 0) && !bookedEmails.has(emailOf(u)),
      ),
    [users, bookedEmails],
  );
  const labels: any = {
    customers: [
      "Customer directory",
      "Profiles, booking history and customer preferences.",
    ],
    revenue: ["Booking value", "Value of reservations. Actual money received is in Collections."],
    catalog: ["Plans & offers", "Membership plans and customer promotions."],
    addons: [
      "Add-ons",
      "Manage extras customers can include with their booking.",
    ],
    pricing: ["Pricing", "Set default rates and seasonal prices."],
    resources: [
      "Maintenance",
      "Block desks or rooms when they need attention.",
    ],
    holidays: ["Holidays", "Manage workspace closure dates."],
    banners: ["Homepage notices", "Publish timely updates for your customers."],
    wednesday: [
      "Wednesday discount",
      "Manage the power-cut notice and Wednesday discount.",
    ],
    enquiries: [
      "Enquiries",
      "Follow up with people interested in the workspace.",
    ],
    comms: ["Communication", "Templates for customer conversations."],
    refunds: ["Refunds", "Review cancellations and record completed refunds."],
  };
  const title = labels[tab] || ["Operations", ""];
  return (
    <section className="opsSuite workspacePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">WORKSPACE OPERATIONS</span>
          <h1>{title[0]}</h1>
          <p>{title[1]}</p>
        </div>
        <div className="buttonRow">
          {can("revenueView") && (
            <button className="ghost small" onClick={exportBookings}>
              <FileSpreadsheet size={16} /> Export bookings
            </button>
          )}
          {newCustomer && (
            <Dialog
              title="Customer profile"
              onClose={() => setNewCustomer(false)}
            >
              <CustomerPicker
                users={users}
                user={{ uid, email }}
                onSelect={(customer: any) => {
                  if (customer) {
                    setNewCustomer(false);
                    setQueryText(customer.email);
                    onFlash("Customer selected.");
                  }
                }}
              />
            </Dialog>
          )}
          {tab === "customers" && can("customersView") && (
            <button className="ghost small" onClick={exportCustomers}>
              <Users size={16} /> Export customers
            </button>
          )}
        </div>
      </div>
      {tab === "customers" && can("customersView") && (
        <section className="opsPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">CRM</span>
              <h3>Customer database</h3>
              {can("customersCreate") && (
                <button
                  className="primary small"
                  onClick={() => setNewCustomer(true)}
                >
                  Add customer
                </button>
              )}
              <small>
                VIP, notes, blacklist, preferences, profile and spend.
              </small>
            </div>
            <label className="inlineSearch">
              Search
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Name, email, phone, profession"
              />
            </label>
          </div>
          <div className="crmTable">
            {customerRows.map((u: any) => (
              <article
                className={`crmRow ${u.blocked ? "blocked" : u.vip ? "vip" : ""}`}
                key={u.uid}
              >
                <div className="crmIdentity">
                  <span>{(u.name || "?").slice(0, 1).toUpperCase()}</span>
                  <div>
                    <b>{u.name || u.email}</b>
                    <small>
                      {u.email} · {u.phone || "No phone"}
                    </small>
                  </div>
                </div>
                <div className="crmStats">
                  <span>
                    {u.bookingCount ||
                      bookings.filter((b: any) => emailOf(b) === emailOf(u))
                        .length}{" "}
                    bookings
                  </span>
                  <span>
                    {money(
                      u.totalSpend ||
                        bookings
                          .filter(
                            (b: any) =>
                              emailOf(b) === emailOf(u) &&
                              b.status === "Confirmed",
                          )
                          .reduce(
                            (n: number, b: any) => n + Number(b.total || 0),
                            0,
                          ),
                    )}
                  </span>
                </div>
                <fieldset className="crmControls">
                  <input
                    disabled={!can("customersEdit")}
                    value={
                      customerDraft[u.uid]?.profession ?? u.profession ?? ""
                    }
                    onChange={(e) =>
                      setCustomerDraft({
                        ...customerDraft,
                        [u.uid]: {
                          ...(customerDraft[u.uid] || {}),
                          profession: e.target.value,
                        },
                      })
                    }
                    placeholder="Profession"
                  />
                  <input
                    disabled={!can("customersEdit")}
                    value={customerDraft[u.uid]?.company ?? u.company ?? ""}
                    onChange={(e) =>
                      setCustomerDraft({
                        ...customerDraft,
                        [u.uid]: {
                          ...(customerDraft[u.uid] || {}),
                          company: e.target.value,
                        },
                      })
                    }
                    placeholder="Company"
                  />
                  <input
                    disabled={!can("customersEdit")}
                    value={
                      customerDraft[u.uid]?.customerNotes ??
                      u.customerNotes ??
                      ""
                    }
                    onChange={(e) =>
                      setCustomerDraft({
                        ...customerDraft,
                        [u.uid]: {
                          ...(customerDraft[u.uid] || {}),
                          customerNotes: e.target.value,
                        },
                      })
                    }
                    placeholder="Internal note"
                  />
                  <div className="crmButtons">
                    <button
                      className={`ghost small ${u.vip ? "tagOn" : ""}`}
                      disabled={!can("customersEdit")}
                      onClick={() => updateCustomerRow(u, { vip: !u.vip })}
                    >
                      <Tag /> {u.vip ? "VIP" : "Make VIP"}
                    </button>
                    <button
                      className="ghost small"
                      disabled={!can("customersBlock")}
                      onClick={() => toggleBlock(u)}
                    >
                      {u.blocked ? <PlayCircle /> : <PauseCircle />}{" "}
                      {u.blocked ? "Unblock" : "Block"}
                    </button>
                    <button
                      className="primary small"
                      disabled={!can("customersEdit")}
                      onClick={() =>
                        updateCustomerRow(u, customerDraft[u.uid] || {})
                      }
                    >
                      Save profile
                    </button>
                  </div>
                </fieldset>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === "revenue" && can("revenueView") && (
        <>
          <section className="opsMetricGrid">
            <Metric
              label="Confirmed bookings"
              value={confirmed.length}
              icon={<CheckCircle2 />}
            />
            <Metric
              label="Booked value"
              value={money(revenue)}
              icon={<WalletCards />}
            />
            <Metric
              label="Average booking"
              value={money(confirmed.length ? revenue / confirmed.length : 0)}
              icon={<BarChart3 />}
            />
            <Metric
              label="Cancelled"
              value={cancelled.length}
              icon={<ShieldAlert />}
            />
          </section>
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">REPORTING</span>
                <h3>Bookings ledger</h3>
              </div>
              <button className="primary small" onClick={exportBookings}>
                <Download /> CSV report
              </button>
            </div>
            <div className="ledger">
              {bookings.slice(0, 100).map((b: any) => (
                <div className="ledgerRow" key={b.id}>
                  <span>{b.invoiceNumber || b.id.slice(0, 8)}</span>
                  <span>
                    {b.customerName || b.customerEmail || b.userEmail}
                  </span>
                  <span>{spaceLabel(b.space)}</span>
                  <span>
                    {b.date}
                    {b.endDate && b.endDate !== b.date ? ` → ${b.endDate}` : ""}
                  </span>
                  <span className={`status ${String(b.status).toLowerCase()}`}>
                    {b.status}
                  </span>
                  <b>{money(b.total)}</b>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "catalog" && can("catalogManage") && (
        <div className="opsTwo opsCatalog">
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">COUPONS</span>
                <h3>Coupon codes</h3>
              </div>
              <Tag />
            </div>
            <div className="stackForm">
              <label>
                Coupon code
                <input
                  value={coupon.code}
                  onChange={(e) =>
                    setCoupon({ ...coupon, code: e.target.value.toUpperCase() })
                  }
                  placeholder="WELCOME10"
                />
              </label>
              <label>
                Discount type
                <select
                  value={coupon.type}
                  onChange={(e) =>
                    setCoupon({ ...coupon, type: e.target.value })
                  }
                >
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </select>
              </label>
              <label>
                {coupon.type === "percent"
                  ? "Discount value (%)"
                  : "Discount value (₹)"}
                <input
                  type="number"
                  min="1"
                  value={coupon.value}
                  onChange={(e) =>
                    setCoupon({ ...coupon, value: Number(e.target.value) })
                  }
                  placeholder={
                    coupon.type === "percent" ? "e.g. 10" : "e.g. 200"
                  }
                />
              </label>
              <label>
                Uses per customer
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={coupon.maxUsesPerCustomer}
                  onChange={(e) =>
                    setCoupon({ ...coupon, maxUsesPerCustomer: Number(e.target.value) })
                  }
                  placeholder="e.g. 1"
                />
                <small>1 means the same customer can use this code only once.</small>
              </label>
              <label className="standingToggle"><input type="checkbox" checked={coupon.visibleToUsers===true} onChange={e=>setCoupon({...coupon,visibleToUsers:e.target.checked})}/><span>Show in customer Offers and booking dropdown</span></label>
              <button className="primary" onClick={addCoupon}>
                <Plus /> Create coupon
              </button>
            </div>
            <div className="catalogList">
              {coupons.map((c) => (
                <div key={c.id} className="catalogItem">
                  <b>{c.code}</b>
                  <span>
                    {c.value}
                    {c.type === "percent" ? "%" : "₹"}
                  </span>
                  <small>{c.visibleToUsers?"Public":"Staff only"} · {c.maxUsesPerCustomer??c.maxUses??1} use(s) per customer</small>
                  <div className="catalogActions">
                    <button className="ghost small" onClick={() => changePromotion(()=>setCouponVisibility(c.id,c.visibleToUsers!==true,uid),c.visibleToUsers?"Coupon hidden from customers.":"Coupon is now visible to customers.")}>{c.visibleToUsers?"Hide":"Show"}</button>
                    <button className="ghost small" onClick={() => changePromotion(()=>toggleCoupon(c.id, !c.active, uid),c.active?"Coupon paused.":"Coupon activated.")}>{c.active ? "Pause" : "Activate"}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="opsPanel">
            <div className="panelHead"><div><span className="eyebrow">PUBLIC OFFERS</span><h3>Offer cards</h3></div><Gift/></div>
            <div className="stackForm">
              <label>Offer title<input value={offer.title} onChange={e=>setOffer({...offer,title:e.target.value})} placeholder="20% off meeting rooms"/></label>
              <label>Description<textarea value={offer.description} onChange={e=>setOffer({...offer,description:e.target.value})} placeholder="Short customer-facing explanation"/></label>
              <label>Discount type<select value={offer.type} onChange={e=>setOffer({...offer,type:e.target.value})}><option value="percent">Percent (%)</option><option value="fixed">Fixed amount (₹)</option></select></label>
              <label>Discount value<input type="number" min="1" max={offer.type==="percent"?100:undefined} value={offer.value} onChange={e=>setOffer({...offer,value:Number(e.target.value)})}/></label>
              <label>Audience<select value={offer.targetType} onChange={e=>setOffer({...offer,targetType:e.target.value})}><option value="all">All customers</option><option value="email">One customer</option></select></label>
              {offer.targetType==="email"&&<label>Customer email<input type="email" value={offer.targetEmail} onChange={e=>setOffer({...offer,targetEmail:e.target.value})}/></label>}
              <label className="standingToggle"><input type="checkbox" checked={offer.visibleToUsers===true} onChange={e=>setOffer({...offer,visibleToUsers:e.target.checked})}/><span>Visible to eligible customers</span></label>
              <label className="standingToggle"><input type="checkbox" checked={offer.autoApply!==false} onChange={e=>setOffer({...offer,autoApply:e.target.checked})}/><span>Auto-apply when eligible</span></label>
              <button className="primary" onClick={addOffer}><Plus/>Create offer</button>
            </div>
            <div className="catalogList">{offers.map(o=><div key={o.id} className="catalogItem"><b>{o.title}</b><span>{o.type==="percent"?`${o.value}%`:`₹${o.value}`}</span><small>{o.visibleToUsers?"Visible":"Hidden"} · {o.targetType==="email"?o.targetEmail:"All customers"}</small><div className="catalogActions"><button className="ghost small" onClick={()=>changePromotion(()=>setOfferVisibility(o.id,o.visibleToUsers!==true,uid),o.visibleToUsers?"Offer hidden from customers.":"Offer is now visible to customers.")}>{o.visibleToUsers?"Hide":"Show"}</button><button className="ghost small" onClick={()=>changePromotion(()=>toggleOffer(o.id,!o.active,uid),o.active?"Offer paused.":"Offer activated.")}>{o.active?"Pause":"Activate"}</button></div></div>)}</div>
          </section>
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">MEMBERSHIPS</span>
                <h3>10-day / 20-day / monthly plans</h3>
              </div>
              <BriefcaseBusiness />
            </div>
            <div className="stackForm">
              <label>
                Plan name
                <input
                  value={plan.name}
                  onChange={(e) => setPlan({ ...plan, name: e.target.value })}
                  placeholder="20 Day Flex Pass"
                />
              </label>
              <label>
                Description
                <input
                  value={plan.description}
                  onChange={(e) =>
                    setPlan({ ...plan, description: e.target.value })
                  }
                  placeholder="Short description shown to customers"
                />
              </label>
              <label>
                Price (₹)
                <input
                  type="number"
                  value={plan.price}
                  onChange={(e) =>
                    setPlan({ ...plan, price: Number(e.target.value) })
                  }
                  placeholder="e.g. 5000"
                />
              </label>
              <label>Consecutive working days<select value={plan.deskDays||20} onChange={e=>setPlan({...plan,deskDays:Number(e.target.value),days:Number(e.target.value)})}><option value={10}>10 days · 1 reschedule</option><option value={20}>20 days · 2 reschedules</option><option value={30}>30 days · 3 reschedules</option></select></label>
              <label>Minimum advance %<input type="number" min="1" max="100" value={plan.minimumAdvancePercent??50} onChange={e=>setPlan({...plan,minimumAdvancePercent:Number(e.target.value)})}/></label>
              <label>Balance due after start (calendar days)<input type="number" min="0" max="30" value={plan.balanceDueDays??7} onChange={e=>setPlan({...plan,balanceDueDays:Number(e.target.value)})}/></label>
              <label className="checkLabel"><input type="checkbox" checked={plan.active!==false} onChange={e=>setPlan({...plan,active:e.target.checked})}/>Available for new bookings</label>
              <p>Sundays and declared holidays are excluded. A pass is activated through the booking and payment flow.</p>
              <button className="primary" onClick={addPlan}>
                <Plus /> {plan.id?"Save plan changes":"Create pass plan"}
              </button>
            </div>
            <div className="catalogList">
              {plans.map((p) => (
                <div className="catalogItem" key={p.id}>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {money(p.price)} · {p.deskDays || p.days} desk days
                    </small>
                  </div>
                  <span>{p.active===false?"Unavailable":"Available"}</span><button className="ghost" onClick={()=>setPlan(p)}>Edit plan</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {tab === "pricing" && can("pricingManage") && (
        <>
          <DeskRates onFlash={onFlash} />
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">CALENDAR PRICING</span>
                <h3>Seasonal & standing pricing rules</h3>
                <small>
                  Set special pricing for a date range — already-booked dates
                  are unaffected — or apply the rates as the new standing
                  default for all days.
                </small>
              </div>
              <CalendarDays />
            </div>
            <div className="stackForm">
              <label>
                Rule label
                <input
                  value={ruleForm.label}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, label: e.target.value })
                  }
                  placeholder="Diwali season"
                  disabled={ruleForm.standing}
                />
              </label>
              <div className="dateRangeRow">
                <DateRangePicker
                  start={ruleForm.startDate}
                  end={ruleForm.endDate}
                  onChange={(s, e) =>
                    setRuleForm({ ...ruleForm, startDate: s, endDate: e })
                  }
                  min={today()}
                />
              </div>
              <div className="formGrid">
                {Object.keys(DEFAULT_PRICING).map((k) => (
                  <label key={k}>
                    {k.replaceAll("_", " ")}
                    <input
                      type="number"
                      min="0"
                      value={ruleForm[k]}
                      onChange={(e) =>
                        setRuleForm({
                          ...ruleForm,
                          [k]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="standingToggle">
                <input
                  type="checkbox"
                  checked={!!ruleForm.standing}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, standing: e.target.checked })
                  }
                />{" "}
                Apply as new standing default for all days (ignores the date
                range)
              </label>
              <button className="primary" onClick={saveRule}>
                <CheckCircle2 />{" "}
                {ruleForm.standing
                  ? "Save as standing default"
                  : "Save seasonal rule"}
              </button>
            </div>
            <p className="opsNote">
              Seasonal rules apply only within their date range; the standing
              default applies to every day that has no matching seasonal rule.
            </p>
            <div className="catalogList">
              {pricingRules.map((r: any) => (
                <div className="catalogItem pricingRuleItem" key={r.id}>
                  <div>
                    <b>{r.label}</b>
                    <small>
                      {r.startDate} → {r.endDate}
                    </small>
                    <span className="ruleFields">
                      {Object.entries(r.pricing || {})
                        .map(
                          ([k, v]: any) => `${k.replaceAll("_", " ")}: ₹${v}`,
                        )
                        .join(" · ")}
                    </span>
                  </div>
                  <button
                    className="ghost small"
                    onClick={() =>
                      deletePricingRule(r.id, uid)
                        .then(() => onFlash("Pricing rule removed."))
                        .catch((e: any) =>
                          onFlash(e.message || "Could not remove rule"),
                        )
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
              {!pricingRules.length && (
                <p className="opsNote">No seasonal pricing rules yet.</p>
              )}
            </div>
          </section>
        </>
      )}
      {tab === "holidays" && can("resourcesManage") && (
        <section className="opsPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">HOLIDAYS</span>
              <h3>Mark a holiday</h3>
              <small>
                All services are blocked on a holiday. Existing bookings on that
                date are flagged below so staff can proactively reschedule.
              </small>
            </div>
            <CalendarX />
          </div>
          <div className="stackForm">
            <DatePicker
              value={holidayForm.date}
              onChange={(v) => setHolidayForm({ ...holidayForm, date: v })}
              min={today()}
              label="Holiday date"
            />
            <input
              value={holidayForm.reason}
              onChange={(e) =>
                setHolidayForm({ ...holidayForm, reason: e.target.value })
              }
              placeholder="Reason (e.g. Diwali, Independence Day)"
            />
            <button className="primary" onClick={addHoliday}>
              <Plus /> Mark holiday
            </button>
          </div>
          <div className="catalogList">
            {holidays.map((h: any) => {
              const hc = conflictsFor(h.date);
              return (
                <div className="holidayBlock" key={h.id}>
                  <div className="catalogItem">
                    <div>
                      <b>{h.date}</b>
                      <small>{h.reason || "Holiday"}</small>
                    </div>
                    <button
                      className="ghost small"
                      onClick={() =>
                        removeHoliday(h.date, uid)
                          .then(() => onFlash("Holiday removed."))
                          .catch((e: any) =>
                            onFlash(e.message || "Could not remove holiday"),
                          )
                      }
                    >
                      <Trash2 />
                    </button>
                  </div>
                  {hc.length > 0 && (
                    <div className="conflictList">
                      <small className="opsNote" style={{ margin: 0 }}>
                        <ShieldAlert size={13} /> {hc.length} existing booking
                        {hc.length === 1 ? "" : "s"} on this date — contact to
                        reschedule:
                      </small>
                      {hc.map((b: any) => (
                        <div className="conflictRow" key={b.id}>
                          <div>
                            <b>
                              {b.customerName || b.customerEmail || b.userEmail}
                            </b>
                            <span>
                              {b.customerPhone || "No phone"} ·{" "}
                              {spaceLabel(b.space)} · {b.status}
                            </span>
                          </div>
                          {b.customerPhone ? (
                            <a
                              className="ghost small"
                              href={waLink(
                                b.customerPhone,
                                `Hello, this is Coworx Central. ${h.date} has been marked as a holiday — we'd like to help you reschedule your ${spaceLabel(b.space)} booking.`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle /> WhatsApp
                            </a>
                          ) : (
                            <span className="opsNote" style={{ margin: 0 }}>
                              No phone on file
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!holidays.length && <p className="opsNote">No holidays marked.</p>}
          </div>
        </section>
      )}
      {tab === "banners" && can("noticesManage") && (
        <>
          <HomepageContentEditor onFlash={onFlash} />
        <section className="opsPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">BANNERS</span>
              <h3>Homepage banner</h3>
              <small>
                Shown at the very top of the customer homepage, signed in or
                not, only while the date/time window is active.
              </small>
            </div>
            <Megaphone />
          </div>
          <div className="stackForm">
            <select
              value={bannerForm.kind}
              onChange={(e) =>
                setBannerForm({ ...bannerForm, kind: e.target.value })
              }
            >
              <option value="offer">Offer</option>
              <option value="instruction">Instruction</option>
              <option value="reminder">Reminder</option>
              <option value="holiday">Holiday</option>
            </select>
            <input
              value={bannerForm.title}
              onChange={(e) =>
                setBannerForm({ ...bannerForm, title: e.target.value })
              }
              placeholder="Banner title"
            />
            <textarea
              value={bannerForm.message}
              onChange={(e) =>
                setBannerForm({ ...bannerForm, message: e.target.value })
              }
              placeholder="Banner message"
            />
            <div className="dateRangeRow">
              <DateRangePicker
                start={bannerForm.startDate}
                end={bannerForm.endDate}
                onChange={(s, e) =>
                  setBannerForm({ ...bannerForm, startDate: s, endDate: e })
                }
              />
            </div>
            <div className="dateRangeRow">
              <label>
                Start time (optional)
                <input
                  type="time"
                  value={bannerForm.startTime}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      startTime: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                End time (optional)
                <input
                  type="time"
                  value={bannerForm.endTime}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      endTime: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <button className="primary" onClick={addBanner}>
              <Plus /> Create banner
            </button>
          </div>
          <div className="catalogList">
            {banners.map((b: any) => (
              <div className="catalogItem bannerItem" key={b.id}>
                <div>
                  <b>{b.title}</b>
                  <small>
                    {b.kind} · {b.startDate} → {b.endDate}
                    {b.startTime ? ` · ${b.startTime}–${b.endTime}` : ""}
                  </small>
                  <span className="ruleFields">{b.message}</span>
                </div>
                <div className="crmButtons">
                  <button
                    className={`ghost small ${b.active !== false ? "tagOn" : ""}`}
                    onClick={() =>
                      updateBanner(b.id, { active: b.active === false }, uid)
                        .then(() =>
                          onFlash(
                            b.active === false
                              ? "Banner activated."
                              : "Banner paused.",
                          ),
                        )
                        .catch((e: any) =>
                          onFlash(e.message || "Could not update banner"),
                        )
                    }
                  >
                    {b.active !== false ? "Active" : "Paused"}
                  </button>
                  <button
                    className="ghost small"
                    onClick={() =>
                      deleteBanner(b.id, uid)
                        .then(() => onFlash("Banner deleted."))
                        .catch((e: any) =>
                          onFlash(e.message || "Could not delete banner"),
                        )
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
            {!banners.length && <p className="opsNote">No banners yet.</p>}
          </div>
        </section>
        </>
      )}
      {tab === "wednesday" && can("pricingManage") && (
        <section className="opsPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">WEDNESDAY POWER CUT</span>
              <h3>MSEB discount & notice</h3>
              <small>
                Every Wednesday in Solapur, MSEB may cut power for 2–3 hours.
                Customers are warned and given this fixed discount before
                completing a Wednesday booking.
              </small>
            </div>
            <Zap />
          </div>
          <div className="stackForm">
            <label>
              Discount percent
              <input
                type="number"
                min="0"
                max="100"
                value={ops.wednesdayDiscountPercent || 0}
                onChange={(e) =>
                  setOps({
                    ...ops,
                    wednesdayDiscountPercent: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Notice text (optional override)
              <textarea
                value={ops.wednesdayNoticeText || ""}
                onChange={(e) =>
                  setOps({ ...ops, wednesdayNoticeText: e.target.value })
                }
                placeholder="MSEB may cut power for 2-3 hours on Wednesdays in Solapur."
              />
            </label>
            <button
              className="primary"
              onClick={() =>
                saveOperationsSettings(ops)
                  .then(() => onFlash("Wednesday settings saved."))
                  .catch((e: any) =>
                    onFlash(e.message || "Could not save Wednesday settings"),
                  )
              }
            >
              <CheckCircle2 /> Save Wednesday settings
            </button>
          </div>
        </section>
      )}
      {tab === "enquiries" && can("enquiriesManage") && (
        <EnquiryCRM actorUid={uid} onFlash={onFlash} />
      )}
      {tab === "resources" && can("resourcesManage") && (
        <div className="opsTwo">
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">MAINTENANCE</span>
                <h3>Desk / room maintenance</h3>
                <small>
                  Temporarily disable a resource for one day or a date range.
                </small>
              </div>
              <ShieldAlert />
            </div>
            <div className="stackForm">
              <div className="dateRangeRow">
                <label>
                  From
                  <input
                    type="date"
                    value={selectedDate}
                    min={today()}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      if (blockToDate < e.target.value)
                        setBlockToDate(e.target.value);
                    }}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={blockToDate}
                    min={selectedDate}
                    onChange={(e) => setBlockToDate(e.target.value)}
                  />
                </label>
              </div>
              <select
                value={block.inventoryId}
                onChange={(e) =>
                  setBlock({ ...block, inventoryId: e.target.value })
                }
              >
                {desks.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.id} · Desk {d.number}
                  </option>
                ))}
                <option value="meeting">Meeting Room</option>
                <option value="conference">Conference Room</option>
                <option value="podcast">Creator Studio</option>
              </select>
              <input
                value={block.reason}
                onChange={(e) => setBlock({ ...block, reason: e.target.value })}
                placeholder="Maintenance reason"
              />
              <button
                className="primary"
                disabled={blocking}
                onClick={async () => {
                  const range = dateSpan(
                    selectedDate,
                    blockToDate || selectedDate,
                  );
                  if (!range.length) return onFlash("Invalid date range.");
                  setBlocking(true);
                  try {
                    for (const d of range)
                      await setResourceBlock(
                        { ...block, date: d, active: true },
                        uid,
                      );
                    onFlash(
                      range.length > 1
                        ? `Blocked for ${range.length} days (${selectedDate} → ${blockToDate}).`
                        : "Resource blocked for maintenance.",
                    );
                  } catch (e: any) {
                    onFlash(e.message || "Could not block resource");
                  } finally {
                    setBlocking(false);
                  }
                }}
              >
                <PauseCircle />{" "}
                {blocking
                  ? "Blocking…"
                  : dateSpan(selectedDate, blockToDate || selectedDate).length >
                      1
                    ? `Block ${dateSpan(selectedDate, blockToDate || selectedDate).length} days`
                    : "Block resource"}
              </button>
            </div>
            <p className="opsNote">
              Maintenance blocks are stored per resource per day, so the booking
              layer can prevent new reservations across the whole range.
            </p>
            {selectedDateBlocks.filter((r: any) => r.active !== false).length >
              0 && (
              <div className="catalogList">
                <small className="opsNote" style={{ margin: 0 }}>
                  Showing blocks for {selectedDate}:
                </small>
                {selectedDateBlocks
                  .filter((r: any) => r.active !== false)
                  .map((r: any) => (
                    <div className="catalogItem" key={r.id}>
                      <div>
                        <b>{r.inventoryId}</b>
                        <small>{r.reason || "Maintenance"}</small>
                      </div>
                      <button
                        className="ghost small"
                        onClick={() =>
                          removeResourceBlock(r.id, uid)
                            .then(() => onFlash("Resource unblocked."))
                            .catch((e: any) =>
                              onFlash(e.message || "Could not unblock"),
                            )
                        }
                      >
                        <PlayCircle /> Unblock
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}
      {tab === "addons" && can("catalogManage") && (
        <div>
          {" "}
          {/*ADDONS*/}
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">ADD-ONS</span>
                <h3>Printing, lockers, beverages</h3>
              </div>
              <Plus />
            </div>
            <div className="stackForm">
              <input
                value={addon.name}
                onChange={(e) => setAddon({ ...addon, name: e.target.value })}
                placeholder="10-page printing"
              />
              <input
                type="number"
                value={addon.unitPrice}
                onChange={(e) =>
                  setAddon({ ...addon, unitPrice: Number(e.target.value) })
                }
                placeholder="Unit price"
              />
              <select
                value={addon.space}
                onChange={(e) => setAddon({ ...addon, space: e.target.value })}
              >
                <option value="all">All spaces</option>
                <option value="desk">Desks</option>
                <option value="meeting">Meeting Room</option>
                <option value="conference">Conference Room</option>
                <option value="podcast">Creator Studio</option>
              </select>
              <button className="primary" onClick={addAddon}>
                <Plus /> Add add-on
              </button>
            </div>
            <div className="catalogList">
              {addons.map((a) => (
                <div className="catalogItem" key={a.id}>
                  <b>{a.name}</b>
                  <span>{money(a.unitPrice)}</span>
                  <button
                    className="ghost small"
                    onClick={() => toggleAddon(a.id, !a.active, uid)}
                  >
                    {a.active ? "Pause" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {tab === "comms" && can("communicationsManage") && (
        <div className="opsTwo">
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">WHATSAPP TEMPLATES</span>
                <h3>Templates staff can reuse</h3>
              </div>
              <MessageCircle />
            </div>
            <div className="templateForm">
              {[
                ["bookingConfirmation", "Booking confirmation"],
                ["paymentReminder", "Payment reminder"],
                ["cancellation", "Cancellation"],
                ["checkIn", "Check-in reminder"],
                ["broadcast", "Admin broadcast"],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <textarea
                    value={templates[k] || ""}
                    onChange={(e) =>
                      setTemplates({ ...templates, [k]: e.target.value })
                    }
                    placeholder="Use {name}, {date}, {booking}"
                  />
                </label>
              ))}
            </div>
            <button className="primary" onClick={saveComms}>
              <CheckCircle2 /> Save templates
            </button>
          </section>
          <section className="opsPanel">
            <div className="panelHead">
              <div>
                <span className="eyebrow">BROADCAST</span>
                <h3>Customer WhatsApp batch</h3>
                <small>
                  Uses saved phone numbers. Opened one-by-one in WhatsApp.
                </small>
              </div>
            </div>
            <button className="primary" onClick={sendBroadcast}>
              <MessageCircle /> Open WhatsApp batch
            </button>
            <div className="opsNote">
              Keep batches small and relevant. WhatsApp may rate-limit rapid
              messages.
            </div>
          </section>
        </div>
      )}
      {tab === "refunds" && can("refundsManage") && (
        <section className="opsPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">REFUNDS</span>
              <h3>Refund workflow</h3>
            </div>
          </div>
          {bookings
            .filter(
              (b: any) =>
                b.refundStatus === "Pending" || b.status === "Cancelled",
            )
            .slice(0, 15)
            .map((b: any) => (
              <div className="refundRow" key={b.id}>
                <div>
                  <b>{b.customerName || b.customerEmail}</b>
                  <small>
                    {b.invoiceNumber || b.id.slice(0, 8)} ·{" "}
                    {money(b.refundAmount || 0)}
                  </small>
                </div>
                <select aria-label="Refund method" value={refundMethod[b.id]||"UPI"} onChange={e=>setRefundMethod({...refundMethod,[b.id]:e.target.value})}><option>UPI</option><option>Cash</option><option>Other</option></select>
                <input
                  placeholder="Refund reference"
                  value={refundDraft[b.id] || ""}
                  onChange={(e) =>
                    setRefundDraft({
                      ...refundDraft,
                      [b.id]: e.target.value,
                    })
                  }
                />
                <button
                  className="ghost small"
                  disabled={b.refundStatus === "Processed" || !b.refundAmount || !refundDraft[b.id]?.trim()}
                  onClick={() =>
                    updateRefund(
                      b.id,
                      uid,
                      "Processed",
                      b.refundAmount || 0,
                      refundDraft[b.id] || "",
                      refundMethod[b.id] || "UPI",
                    )
                      .then(() => onFlash("Refund marked processed."))
                      .catch((e: any) =>
                        onFlash(e.message || "Could not update refund"),
                      )
                  }
                >
                  Mark processed
                </button>
              </div>
            ))}
        </section>
      )}
    </section>
  );
}
function Metric({ label, value, icon }: any) {
  return (
    <article className="opsMetric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}
