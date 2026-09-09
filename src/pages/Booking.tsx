// @ts-nocheck
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import PaymentDialog from "../components/PaymentDialog";
import { collectPayment, emptyTender, tenderTotal } from "../lib/finance";
import { DEFAULT_POLICY, consecutiveDates, officeHours, PASS_ALLOWANCES, minutes } from "../lib/business";
import CustomerPicker from "../components/CustomerPicker";
import { watchSetting, watchLocksRange } from "../lib/platform";
import { validEmail, validPhone } from "../lib/customer";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  Lock,
  MessageCircle,
  Mic2,
  Monitor,
  Phone,
  Plus,
  Users,
  Building2,
  Percent,
  Zap,
  UserPlus,
  Save,
  WalletCards,
} from "lucide-react";
import {
  Space,
  desks,
  confStarts,
  meetingStarts,
  podStarts,
  addHours,
  addDays,
  dateSpan,
  localToday,
  BUSINESS_START,
  BUSINESS_END,
  isWednesday,
} from "./types";
import {
  createBooking,
  createCustomerProfile,
  getUserByEmail,
  loadOperationsSettings,
  loadPolicy,
  saveUserProfile,
  watchCoupons,
  watchResourceBlocksRange,
  watchHolidays,
  watchPricingRules,
  watchMembershipPlans,
  watchCouponRedemptions,
} from "../lib/firestore";
import conferenceImage from "../assets/conference-2.webp";
import podcastImage from "../assets/podcast.webp";
import { DateRangePicker } from "./DatePicker";
import "./booking.css";
import "./ui-fixes.css";
import "./multi-day.css";
import "./booking-enhancements.css";

const PREMIUM = new Set([2, 3, 9, 15, 22]);
const FLOOR: Array<string | null> = [
  "D04",
  "D03",
  "D02",
  "D01",
  "D05",
  "D06",
  "D07",
  "D08",
  "D11",
  "D10",
  "D09",
  null,
  "D12",
  "D13",
  "D14",
  "D15",
  "D19",
  "D18",
  "D17",
  "D16",
  "D20",
  "D21",
  "D22",
  null,
];
const MAP = Object.fromEntries(desks.map((d) => [d.id, d]));
const activeLock = (x: any) =>
  x.status === "Confirmed" ||
  (x.status === "Pending" && (x.expiresAt?.toMillis?.() || 0) > Date.now());
const busy = (locks: any[], space: string, slot: string) =>
  locks.some(
    (x) => x.inventoryId === space && x.start && minutes(x.start)<minutes(slot)+60 && minutes(x.end||addHours(x.start,1))>minutes(slot) && activeLock(x),
  );
const freeHours = (locks: any[], space: string, start: string, closing = BUSINESS_END) => {
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const t = addHours(start, i);
    if (minutes(t)+60 > minutes(closing) || busy(locks, space, t)) break;
    n++;
  }
  return n;
};

export default function Booking(p: any) {
  const isDesk = p.space === "desk" || p.space === "cubicle";
  const selected: string[] = p.selectedSeats || [];
  const [locks, setLocks] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [endDate, setEndDate] = useState(p.date || localToday());
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState({
    mobile: p.phoneNumber || (p.staffBooking ? "" : p.myProfile?.mobile || ""),
    gender: p.staffBooking ? "" : p.myProfile?.gender || "",
    dob: p.staffBooking ? "" : p.myProfile?.dob || "",
    profession: p.staffBooking ? "" : p.myProfile?.profession || "",
    otherProfession: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<any>(p.initialCustomer||null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState("");
  const [policy, setPolicy] = useState<any>({
    maxAdvanceDays: 60,
    businessStart: BUSINESS_START,
    businessEnd: BUSINESS_END,
  });
  const [ops, setOps] = useState<any>({
    referralEnabled: false,
    referralRewardPercent: 0,
  });
  const [plans,setPlans]=useState<any[]>([]),[planId,setPlanId]=useState(""),[paymentBooking,setPaymentBooking]=useState<any>(null);
  const [tender,setTender]=useState(emptyTender()),[paymentVerified,setPaymentVerified]=useState(false);
  const selectedPlan=isDesk ? plans.find(x=>x.id===planId&&x.active!==false) : null;
  const passDays=selectedPlan ? Number(selectedPlan.deskDays || selectedPlan.days) : 0;
  const [coupons, setCoupons] = useState<any[]>([]);
  useEffect(() => {
    if (!p.myProfile || p.staffBooking) return;
    setProfile((x) => ({
      mobile: x.mobile || p.myProfile.mobile || "",
      gender: x.gender || p.myProfile.gender || "",
      dob: x.dob || p.myProfile.dob || "",
      profession: x.profession || p.myProfile.profession || "",
      otherProfession: x.otherProfession,
    }));
  }, [p.myProfile, p.staffBooking]);
  useEffect(() => {
    setSelectedCustomer(p.initialCustomer||null);
    setMessage("");
    setProfile({
      mobile: p.staffBooking ? "" : p.myProfile?.mobile || "",
      gender: p.staffBooking ? "" : p.myProfile?.gender || "",
      dob: p.staffBooking ? "" : p.myProfile?.dob || "",
      profession: p.staffBooking ? "" : p.myProfile?.profession || "",
      otherProfession: "",
    });
  }, [p.staffBooking]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [drink, setDrink] = useState("");
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [holidays, setHolidays] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [deskRatesByDate, setDeskRatesByDate] = useState<any>({});
  useEffect(
    () =>
      watchSetting("deskPricing", setDeskRatesByDate, (e) =>
        setLoadError(e.message),
      ),
    [],
  );
  useEffect(() => {
    const stopPolicy=watchSetting("policy",p=>setPolicy({...DEFAULT_POLICY,...p}),e=>setLoadError(e.message));
    const stopPlans=watchMembershipPlans(setPlans,e=>setLoadError(e.message));
    loadOperationsSettings()
      .then(setOps)
      .catch(() => {});
    const a = watchCoupons(setCoupons, () => {}, !p.staff),
      c = watchHolidays(setHolidays, () => {}),
      d = watchPricingRules(setPricingRules, () => {});
    return () => {
      stopPolicy();stopPlans();
      a();
      c();
      d();
    };
  }, []);
  const couponCustomerId=p.staffBooking?selectedCustomer?.uid:p.user?.uid;
  const [couponUses,setCouponUses]=useState<Record<string,number>>({});
  useEffect(()=>{
    setCouponUses({});
    if(!couponCustomerId)return;
    return watchCouponRedemptions(couponCustomerId,rows=>setCouponUses(Object.fromEntries(rows.map((r:any)=>[r.couponId,Number(r.count||0)]))),()=>{});
  },[couponCustomerId]);
  useEffect(()=>{setTender(emptyTender());setPaymentVerified(false);},[p.staffBooking,selectedCustomer?.uid]);
  useEffect(() => {
    if (endDate < p.date) setEndDate(p.date);
  }, [p.date, endDate]);
  const start = isDesk
    ? ""
    : p.space === "meeting"
      ? p.meeting
      : p.space === "conference"
        ? p.conf
        : p.pod;
  const duration = isDesk
    ? 1
    : p.space === "meeting"
      ? Number(p.meetingDuration || 1)
      : p.space === "conference"
        ? Number(p.confDuration || 1)
        : Number(p.podDuration || 1);
  const hours=officeHours(p.date,policy,holidays);
  const end = isDesk ? hours.end : addHours(start, duration);
  const dates = useMemo(() => !p.date || !endDate ? [] : passDays ? consecutiveDates(p.date,passDays,policy,holidays) : dateSpan(p.date,endDate), [p.date,endDate,passDays,policy,holidays]);
  useEffect(()=>{if(passDays&&dates.length)setEndDate(dates[dates.length-1]);},[dates.join(","),passDays]);
  useEffect(()=>{if(!isDesk && (start < hours.start || minutes(start)+60>minutes(hours.end))) {const n=Math.ceil(minutes(hours.start)/15)*15;setStart(p,`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`);}},[hours.start,hours.end,isDesk]);
  const days = dates.length;
  useEffect(() => {
    setInventoryLoading(true);
    setLoadError("");
    if(!dates.length){setInventoryLoading(false);return;}
    return watchLocksRange(
      dates,
      (rows) => {
        setLocks(rows);
        setInventoryLoading(false);
      },
      (e) => {
        setInventoryLoading(false);
        setLoadError(
          e.message ||
            "Could not load availability. Please reload before booking.",
        );
      },
    );
  }, [dates.join(",")]);
  const bookedDesks = locks.filter(activeLock).map((l) => l.inventoryId);

  useEffect(() => {
    const u = watchResourceBlocksRange(dates, setBlocks, () => {});
    return () => u();
  }, [dates.join(",")]);
  const maxDate = addDays(localToday(), Number(policy.maxAdvanceDays || 60));
  const withinAdvance =
    p.date >= localToday() && endDate >= p.date && (passDays || endDate <= maxDate);
  const withinHours =
    isDesk ||
    dates.every(d=>{const h=officeHours(d,policy,holidays);return !h.closed&&start>=h.start&&end<=h.end&&start<end;});
  const roomAvailable = isDesk ? 0 : freeHours(locks, p.space, start, dates.reduce((end,d)=>officeHours(d,policy,holidays).end<end?officeHours(d,policy,holidays).end:end,hours.end));
  const startBusy = !isDesk && busy(locks, p.space, start);
  const blockedRange = isDesk
    ? selected.some((id) =>
        dates.some((d) =>
          blocks.some(
            (b) =>
              b.active &&
              b.date === d &&
              (b.inventoryId === `desk-${id}` || b.inventoryId === id),
          ),
        ),
      )
    : dates.some((d) =>
        blocks.some(
          (b) => b.active && b.date === d && b.inventoryId === p.space,
        ),
      );
  const blockedForDesk = (id: string) =>
    dates.some((d) =>
      blocks.some(
        (b) =>
          b.active &&
          b.date === d &&
          (b.inventoryId === `desk-${id}` || b.inventoryId === id),
      ),
    );
  const pricingRuleFor = (d: string) =>
    pricingRules
      .filter((r) => r.active !== false && r.startDate <= d && r.endDate >= d)
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
      )[0];
  const dayBase = (d: string) => {
    const rule = pricingRuleFor(d),
      eff = rule?.pricing || {};
    if (isDesk)
      return selected.reduce((sum, id) => {
        const premium = MAP[id]?.premium;
        const overridden =
          eff[id] ?? (premium ? eff.desk_premium : eff.desk_basic);
        const price =
          overridden ??
          deskRatesByDate[d]?.[id] ??
          (premium ? p.prices.desk_premium : p.prices.desk_basic);
        return sum + Number(price || 0);
      }, 0);
    const key =
      p.space === "meeting"
        ? "meeting_hourly"
        : p.space === "conference"
          ? "conference_hourly"
          : "podcast_hourly";
    const rate = eff[key] ?? roomPrice(p);
    return rate * duration;
  };
  const baseTotal = useMemo(
    () => selectedPlan ? Number(selectedPlan.price)*selected.length : dates.reduce((sum, d) => sum + dayBase(d), 0),
    [
      selectedPlan,
      dates.join(","),
      selected.join(","),
      pricingRules,
      deskRatesByDate,
      p.space,
      p.prices,
      duration,
      isDesk,
    ],
  );
  const dailyBase = days ? Math.round(baseTotal / days) : 0;
  const stayDiscount = !passDays && days >= 5 ? Math.round(baseTotal * 0.1) : 0;
  const bulkDiscount =
    isDesk && selected.length > 5 ? Math.round(baseTotal * 0.1) : 0;
  const wednesdayDates = dates.filter(isWednesday);
  const wednesdayDiscount =
    wednesdayDates.length && Number(ops.wednesdayDiscountPercent || 0) > 0
      ? wednesdayDates.reduce(
          (sum, d) =>
            sum +
            Math.round(
              (dayBase(d) * Number(ops.wednesdayDiscountPercent || 0)) / 100,
            ),
          0,
        )
      : 0;
  const holidayDates = dates.filter(d=>officeHours(d,policy,holidays).closed);
  const coupon = !passDays ? coupons.find(
    (c) =>
      c.active &&
      (p.staffBooking || c.visibleToUsers === true) &&
      String(c.code || "").toUpperCase() === couponCode.trim().toUpperCase() &&
      (!c.expiresAt || c.expiresAt.toMillis?.() > Date.now()) &&
      Number(couponUses[c.id] || 0) < Number(c.maxUsesPerCustomer ?? c.maxUses ?? 1),
  ) : null;
  const couponDiscount = coupon
    ? coupon.type === "percent"
      ? Math.round((baseTotal * Number(coupon.value || 0)) / 100)
      : Math.min(baseTotal, Number(coupon.value || 0))
    : 0;
  const referralDiscount =
    ops.referralEnabled && referralCode.trim()
      ? Math.round((baseTotal * Number(ops.referralRewardPercent || 0)) / 100)
      : 0;
  const durationValue = isDesk ? days : duration;
  const eligibleOffers = (p.offers || []).filter((o: any) => {
    if(o.autoApply===false)return false;
    const minD = Number(o.minDays || 0),
      maxD = Number(o.maxDays || 0);
    if (!minD && !maxD) return true;
    if (minD && durationValue < minD) return false;
    if (maxD && durationValue > maxD) return false;
    return true;
  });
  const bestOffer = eligibleOffers
    .map((o: any) => ({
      o,
      disc:
        o.type === "percent"
          ? Math.round((baseTotal * Number(o.value || 0)) / 100)
          : Math.min(baseTotal, Number(o.value || 0)),
    }))
    .sort((a, b) => b.disc - a.disc)[0];
  const offerDiscount = bestOffer?.disc || 0;
  const discount = passDays ? 0 : Math.min(
    baseTotal,
    stayDiscount +
      bulkDiscount +
      couponDiscount +
      referralDiscount +
      offerDiscount +
      wednesdayDiscount,
  );
  const printingPages=Math.max(0,Math.min(200,Math.floor(Number(addonQty.printing||0))));
  const selectedAddons = printingPages ? [{id:"printing",name:"Printing",qty:printingPages,unitPrice:5,total:printingPages*5}] : [];
  const amenities=drink?[drink]:[];
  const addonTotal = selectedAddons.reduce((n, a) => n + a.total, 0);
  const total = Math.max(0, baseTotal - discount + addonTotal);
  const minimumDue=selectedPlan?Math.ceil(total*Number(selectedPlan.minimumAdvancePercent||policy.minimumAdvancePercent||50))/100:total;
  const payingNow=Math.round((Number(tender.cash||0)+Number(tender.upi||0)+Number(tender.other||0))*100)/100;
  const paymentReady=!p.staffBooking||Boolean(p.canConfirm&&paymentVerified&&payingNow<=total&&(selectedPlan?payingNow>=minimumDue:payingNow===total)&&(!tender.upi||tender.reference.trim()));
  const valid = isDesk
    ? selected.length > 0
    : !startBusy && roomAvailable > 0 && duration <= roomAvailable;
  const openModal = () => {
    if (inventoryLoading || loadError)
      return setMessage(loadError || "Availability is still loading.");
    if (!withinAdvance)
      return setMessage(
        `Bookings can be made up to ${policy.maxAdvanceDays} days ahead.`,
      );
    if (!withinHours)
      return setMessage(`Bookings must stay within the office hours for every selected date.`);
    if (holidayDates.length)
      return setMessage(
        `Coworx Central is closed on ${holidayDates.join(", ")}${holidayDates.length === 1 ? "" : ""} (holiday). Please choose different dates.`,
      );
    if (blockedRange)
      return setMessage(
        "One or more selected resources are under maintenance.",
      );
    if (!valid)
      return setMessage(
        isDesk
          ? "Select at least one desk."
          : `Only ${roomAvailable} continuous hour${roomAvailable === 1 ? "" : "s"} is available from ${start}.`,
      );
    setMessage("");
    const savedMobile = String(
      p.myProfile?.mobile || p.phoneNumber || profile.mobile || "",
    ).trim();
    const savedProfession = String(
      p.myProfile?.profession || profile.profession || "",
    ).trim();
    if (p.staffBooking) {
      if (!selectedCustomer?.uid)
        return setMessage(
          "Choose an existing customer or save a new customer first.",
        );
      if (!p.canConfirm)
        return setMessage("This role cannot collect payments. Ask an authorised manager or receptionist to complete the walk-in booking.");
      try {
        tenderTotal(tender);
      } catch (error:any) {
        return setMessage(error.message);
      }
      if (!paymentReady)
        return setMessage(selectedPlan?`Verify at least ₹${minimumDue.toLocaleString("en-IN")} received before creating this pass.`:`Verify the full ₹${total.toLocaleString("en-IN")} advance payment before booking.`);
      setModal(false);
      void submit();
      return;
    }
    if (
      savedMobile.replace(/\D/g, "").length >= 10 &&
      savedProfession &&
      savedProfession !== "Other"
    ) {
      submit({
        mobile: savedMobile,
        gender: p.myProfile?.gender || profile.gender || "",
        dob: p.myProfile?.dob || profile.dob || "",
        profession: savedProfession,
        otherProfession: "",
      });
      return;
    }
    setProfile((x) => ({ ...x, mobile: p.phoneNumber || x.mobile }));
    setModal(true);
  };
  const submit = async (overrideProfile?: any) => {
    if (submitLock.current) return;
    if (p.staffBooking && !selectedCustomer?.uid)
      return setMessage(
        "Choose an existing customer or save a new customer first.",
      );
    const useProfile = p.staffBooking
      ? {
          mobile: selectedCustomer.phone,
          gender: selectedCustomer.gender || "",
          dob: selectedCustomer.dob || "",
          profession: selectedCustomer.profession || "",
        }
      : overrideProfile || profile;
    const phone = String(useProfile.mobile || "").trim();
    const profession =
      useProfile.profession === "Other"
        ? String(useProfile.otherProfession || "").trim()
        : String(useProfile.profession || "").trim();
    const email = String(
      p.staffBooking ? selectedCustomer.email : p.user?.email || "",
    )
      .trim()
      .toLowerCase();
    if (!validEmail(email)) return setMessage("Enter a valid customer email.");
    if (!validPhone(phone))
      return setMessage("Please enter a valid mobile number.");
    if (!profession && !p.staffBooking)
      return setMessage("Please enter your profession.");
    submitLock.current = true;
    setSubmitting(true);
    setMessage("");
    setWhatsAppUrl("");
    const waWindow = !p.staffBooking
      ? window.open("about:blank", "_blank")
      : null;
    if (waWindow) waWindow.opener = null;
    try {
      let name = p.staffBooking
        ? selectedCustomer.name
        : p.user?.displayName || email.split("@")[0];
      const existing = await getUserByEmail(email);
      if (existing?.blocked)
        throw Error("This customer is blocked from new bookings.");
      if (!p.staffBooking) {
        await saveUserProfile(p.user.uid, {
          phone,
          gender: useProfile.gender,
          dob: useProfile.dob,
          profession,
        });
        p.onProfileSaved?.({
          mobile: phone,
          gender: useProfile.gender,
          dob: useProfile.dob,
          profession,
        });
      }
      const ids = isDesk ? selected.map((id) => `desk-${id}`) : [p.space];
      const lockKeys = isDesk
        ? selected.flatMap((id) => dates.map((d) => `${d}_desk-${id}_day`))
        : dates.flatMap((d) =>
            Array.from(
              { length: duration },
              (_, i) => `${d}_${p.space}_${addHours(start, i)}`,
            ),
          );
      const created = await createBooking({
        date: dates[0],
        endDate,
        days,
        dates,
        space: p.space,
        inventoryId: ids[0],
        inventoryIds: ids,
        lockKeys,
        membershipId:selectedPlan?.id,
        label: selectedPlan ? `${selectedPlan.name} · ${selected.join(", ")}` : isDesk
          ? `${selected.length} Desk${selected.length === 1 ? "" : "s"}`
          : getTitle(p.space),
        userId: p.staffBooking ? selectedCustomer.uid : p.user.uid,
        userEmail: email,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        createdByRole: p.staffBooking ? p.role : "User",
        walkIn: !!p.staffBooking,
        start: isDesk ? undefined : start,
        end: isDesk ? undefined : end,
        durationHours: isDesk ? days : duration * days,
        base: baseTotal,
        discount,
        total,
        offerId: bestOffer?.o?.id || null,
        couponId: coupon?.id || "",
        couponCode: coupon?.code || "",
        referralCode: referralCode.trim().toUpperCase(),
        addons: selectedAddons,
        amenities,
        notes,
        checkoutChannel:p.staffBooking?"staff_manual":"whatsapp",
        status: "Pending",
      });
      if (p.staffBooking && p.canConfirm) {
        try {
          const receipt=await collectPayment(created.id,tender,0,0);
          setMessage(`Booking confirmed for ${email}. Receipt ${receipt}.`);
          setTender(emptyTender());
          setPaymentVerified(false);
          p.setSelectedSeats([]);
          p.onBooked?.();
          p.nav?.("staff-bookings");
          return;
        } catch(paymentError:any) {
          const saved=await getDoc(doc(db,"bookings",created.id));
          setPaymentBooking({id:created.id,...saved.data()});
          const error:any=new Error(`Booking ${created.id.slice(0,8).toUpperCase()} is safely held, but payment was not recorded: ${paymentError.message}`);
          error.paymentPending=true;
          throw error;
        }
      }
      if (!p.staffBooking) {
        const deskText = isDesk ? `Desk number(s): ${selected.join(", ")}` : "";
        const paymentLine=p.upi?.upiId?` Please share payment instructions for UPI ${p.upi.upiId}.`:" Please share payment instructions.";
        const text = `Hello Coworx Central, please complete booking ${created.id.slice(0,8).toUpperCase()} for ${isDesk ? `${selected.length} desk(s) — ${selected.join(", ")}` : getTitle(p.space)} from ${p.date} to ${endDate}${isDesk ? "" : ` · ${start}–${end}`}. ${deskText} Amount due: ₹${total}. Mobile: ${phone}.${paymentLine}`;
        const url = `https://wa.me/919970836509?text=${encodeURIComponent(text)}`;
        setWhatsAppUrl(url);
        if (waWindow) waWindow.location.href = url;
      }
      setModal(false);
      setMessage(
        p.staffBooking
          ? p.canConfirm
            ? `Request saved for ${email}. Collect payment to confirm.`
            : `Request saved for ${email}. A manager can confirm payment.`
          : `Request created. The slot is held for 15 minutes while payment is completed.`,
      );
      if (!p.staffBooking || !p.canConfirm) {p.setSelectedSeats([]);p.onBooked?.();}
    } catch (e: any) {
      waWindow?.close();
      const conflicts: { inventoryId: string }[] = e?.conflicts || [];
      if (conflicts.length && isDesk) {
        const conflictIds = new Set(
          conflicts.map((c) => String(c.inventoryId).replace(/^desk-/, "")),
        );
        p.setSelectedSeats(selected.filter((id) => !conflictIds.has(id)));
      }
      setMessage(
        e?.message ||
          "Booking failed. Please check availability and try again.",
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };
  return (
    <main className="page bookingPage">
      {paymentBooking&&<PaymentDialog booking={paymentBooking} canDiscount={p.canDiscount} onClose={()=>setPaymentBooking(null)} onSaved={(receipt)=>{setPaymentBooking(null);setMessage(`Booking confirmed. Receipt ${receipt}.`);p.setSelectedSeats([]);p.onBooked?.();p.nav?.("staff-bookings");}}/>}
      {whatsAppUrl && (
        <div className="inlineSuccess" role="status">
          <CheckCircle2 size={18} /> Booking requested.{" "}
          <a href={whatsAppUrl} target="_blank" rel="noreferrer">
            Open WhatsApp
          </a>
          <button className="textButton" onClick={() => p.nav?.("bookings")}>
            View booking
          </button>
        </div>
      )}
      {loadError && (
        <p className="inlineError" role="alert">
          {loadError}
        </p>
      )}
      <div className="bookingIntro">
        <div>
          <span className="eyebrow">MAKE A RESERVATION</span>
          <h2>
            {p.staffBooking ? "Book for a customer" : "Choose your workspace."}
          </h2>
          <p>
            Office hours for {p.date}: <strong>{hours.closed?hours.reason:`${hours.start}–${hours.end}`}</strong>. Daily desks end at closing time. Sundays are holidays.
          </p>
        </div>
        {p.staff && (
          <div className="staffMode">
            <span>Staff booking</span>
            <div className="staffToggle">
              <button
                className={!p.staffBooking ? "active" : ""}
                onClick={() => p.setStaffBooking(false)}
              >
                My booking
              </button>
              <button
                className={p.staffBooking ? "active" : ""}
                onClick={() => {
                  p.setStaffBooking(true);
                  setSelectedCustomer(null);
                }}
              >
                <Users size={15} /> Walk-in customer
              </button>
            </div>
          </div>
        )}
        {p.staffBooking && (
          <CustomerPicker
            users={p.users}
            selected={selectedCustomer}
            onSelect={setSelectedCustomer}
            user={p.user}
            canCreate={p.canCreateCustomer}
            disabled={submitting}
          />
        )}
      </div>
      <div className="bookingGrid">
        <section className="panel bookingPanel">
          {isDesk&&<div className="passChooser"><label>Booking type<select value={planId} onChange={e=>{setPlanId(e.target.value);setEndDate(p.date);setCouponCode("");p.setSelectedSeats([]);setPaymentVerified(false);}}><option value="">Regular desk booking · full advance</option>{plans.filter(x=>x.active!==false&&PASS_ALLOWANCES[Number(x.deskDays||x.days)]).map(x=><option key={x.id} value={x.id}>{x.name} · {Number(x.deskDays||x.days)} working days · ₹{x.price}/desk</option>)}</select></label>{selectedPlan&&<p className="noticeBox">One desk per pass · {passDays} consecutive working days, excluding Sundays and declared holidays. {PASS_ALLOWANCES[passDays]} day reschedule allowance. Partial advance permitted; extra reschedules require admin approval.</p>}</div>}
          {passDays?<div className="fieldGrid"><div className="customerDateField"><DatePicker label="Pass starts" min={localToday()} max={maxDate} value={p.date} onChange={value=>{p.setDate(value);setPaymentVerified(false);}}/></div><div><small>Last included working day</small><strong className="passEndDate">{endDate}</strong></div></div>:<DateRangePicker
            start={p.date}
            end={endDate}
            min={localToday()}
            max={maxDate}
            onChange={(s, e) => {
              p.setDate(s);
              setEndDate(e);
              setPaymentVerified(false);
            }}
            highlight={(d) =>
              holidays.some((h: any) => h.date === d)
                ? "holiday"
                : isWednesday(d)
                  ? "wednesday"
                  : undefined
            }
          />}
          <div className="rangeSummary standaloneRangeSummary">
            <CalendarDays size={17} />
            <strong>
              {days} day{days === 1 ? "" : "s"}
            </strong>
            <small>
              {days >= 5
                ? "10% discount unlocked"
                : `Advance limit: ${policy.maxAdvanceDays} days`}
            </small>
          </div>
          {wednesdayDates.length > 0 && (
            <div className="wednesdayNotice">
              <Zap size={16} />
              <div>
                <b>
                  Heads up —{" "}
                  {wednesdayDates.length > 1
                    ? "some of your dates fall"
                    : "your date falls"}{" "}
                  on a Wednesday.
                </b>
                <span>
                  MSEB may cut power in Solapur for 2–3 hours on Wednesdays and
                  Coworx Central isn't liable for those outages. As a thank-you
                  for your patience we're applying a{" "}
                  {ops.wednesdayDiscountPercent || 0}% discount automatically
                  for {wednesdayDates.length > 1 ? "those days" : "that day"}.
                </span>
              </div>
            </div>
          )}
          {holidayDates.length > 0 && (
            <div className="wednesdayNotice holidayNotice">
              <AlertCircle size={16} />
              <div>
                <b>Coworx Central is closed on {holidayDates.join(", ")}.</b>
                <span>
                  Please choose different dates — this range can't be booked.
                </span>
              </div>
            </div>
          )}
          <div className="tabs">
            {[
              { value: "desk" as Space, label: "Desks" },
              { value: "meeting" as Space, label: "Meeting Room" },
              { value: "conference" as Space, label: "Conference Room" },
              { value: "podcast" as Space, label: "Creator Studio" },
            ].map((x) => (
              <button
                key={x.value}
                className={
                  p.space === x.value ||
                  (x.value === "desk" && p.space === "cubicle")
                    ? "active"
                    : ""
                }
                onClick={() => {
                  p.setSpace(x.value);
                  p.setSelectedSeats([]);
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
          {isDesk ? (
            <DeskFloor
              selected={selected}
              booked={bookedDesks}
              prices={p.prices}
              deskPrices={p.deskPrices || {}}
              maintenance={blockedForDesk}
              onToggle={(id) => {
                if (bookedDesks.includes(`desk-${id}`) || blockedForDesk(id))
                  return;
                p.setSelectedSeats(
                  selected.includes(id)
                    ? selected.filter((x) => x !== id)
                    : passDays ? [id] : [...selected, id],
                );
              }}
            />
          ) : (
            <RoomCard
              p={p}
              officeHours={hours}
              space={p.space}
              start={start}
              duration={duration}
              available={roomAvailable}
              locks={locks}
            />
          )}
          <Extras
            qty={addonQty}
            setQty={setAddonQty}
            coupons={coupons}
            couponUses={couponUses}
            staff={p.staffBooking}
            disabled={!!passDays}
            couponCode={couponCode}
            setCouponCode={setCouponCode}
            coupon={coupon}
            referralCode={referralCode}
            setReferralCode={setReferralCode}
            reward={ops.referralRewardPercent}
            referralEnabled={ops.referralEnabled}
            drink={drink}
            setDrink={setDrink}
            notes={notes}
            setNotes={setNotes}
          />
          {p.staffBooking&&(
            <StaffPaymentPanel total={total} minimumDue={minimumDue} passDays={passDays} tender={tender} setTender={(next:any)=>{setTender(next);setPaymentVerified(false);}} verified={paymentVerified} setVerified={setPaymentVerified} canCollect={p.canConfirm}/>
          )}
        </section>
        <Summary
          officeHours={hours}
          passDays={passDays}
          staffBooking={!!p.staffBooking}
          canConfirm={p.canConfirm}
          busy={submitting || inventoryLoading}
          customerReady={
            !p.staffBooking ||
            Boolean(selectedCustomer?.uid && !selectedCustomer.blocked)
          }
          title={getTitle(p.space)}
          date={p.date}
          endDate={endDate}
          days={days}
          start={start}
          end={end}
          isDesk={isDesk}
          selected={selected}
          dailyBase={dailyBase}
          baseTotal={baseTotal}
          stayDiscount={stayDiscount}
          bulkDiscount={bulkDiscount}
          couponDiscount={couponDiscount}
          coupon={coupon}
          referralDiscount={referralDiscount}
          offerDiscount={offerDiscount}
          bestOffer={bestOffer?.o}
          wednesdayDiscount={wednesdayDiscount}
          addonTotal={addonTotal}
          total={total}
          paymentReady={paymentReady}
          payingNow={payingNow}
          withinAdvance={withinAdvance}
          maintenance={blockedRange || holidayDates.length > 0}
          roomBooked={startBusy}
          valid={valid}
          onBook={openModal}
          message={message}
          limit={policy.maxAdvanceDays}
        />
      </div>
      {modal && (
        <ProfileModal
          title={getTitle(p.space)}
          date={p.date}
          endDate={endDate}
          total={total}
          profile={profile}
          setProfile={setProfile}
          onClose={() => setModal(false)}
          onContinue={() => submit()}
          busy={submitting}
          message={message}
        />
      )}
    </main>
  );
}
function roomPrice(p: any) {
  return p.space === "meeting"
    ? Number(p.prices.meeting_hourly)
    : p.space === "conference"
      ? Number(p.prices.conference_hourly)
      : Number(p.prices.podcast_hourly);
}
function getTitle(space: Space) {
  return space === "meeting"
    ? "Meeting Room"
    : space === "conference"
      ? "Conference Room"
      : space === "podcast"
        ? "Creator Studio"
        : "Desk";
}
function DateRange({
  date,
  endDate,
  setDate,
  setEndDate,
  maxDate,
  days,
  limit,
}: any) {
  return (
    <div className="dateRangeBox">
      <label>
        <span>START DATE</span>
        <input
          type="date"
          min={localToday()}
          max={maxDate}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            if (endDate < e.target.value) setEndDate(e.target.value);
          }}
        />
      </label>
      <div className="rangeArrow">→</div>
      <label>
        <span>END DATE</span>
        <input
          type="date"
          min={date}
          max={maxDate}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </label>
      <div className="rangeSummary">
        <CalendarDays size={17} />
        <strong>
          {days} day{days === 1 ? "" : "s"}
        </strong>
        <small>
          {days >= 5 ? "10% discount unlocked" : `Advance limit: ${limit} days`}
        </small>
      </div>
    </div>
  );
}
function DeskFloor({
  selected,
  booked,
  prices,
  deskPrices,
  maintenance,
  onToggle,
}: any) {
  return (
    <>
      <div className="workingHoursBanner">
        <Clock3 /> <b>Open {officeHours.start}–{officeHours.end}</b>
        <span>22 desks · live availability · full-day booking</span>
      </div>
      <div className="panelHead">
        <div>
          <h3>22-desk floor plan</h3>
          <small>
            Available / Held / Booked. Premium desks have drawer + 🔐 lock
            marker.
          </small>
        </div>
        <b>
          ₹{prices.desk_basic} regular · ₹{prices.desk_premium} premium
        </b>
      </div>
      <div className="deskBulkNote">
        {selected.length
          ? `${selected.length} desk${selected.length === 1 ? "" : "s"} selected`
          : "Select desks"}
        {selected.length > 5 && <span>10% bulk discount</span>}
      </div>
      <div className="seatGrid redesignedDeskGrid floorPlanGrid">
        {FLOOR.map((id) =>
          id ? (
            <DeskCard
              key={id}
              id={id}
              selected={selected.includes(id)}
              booked={
                booked.includes(`desk-${id}`) || booked.includes(`seat-${id}`)
              }
              maintained={maintenance(id)}
              price={
                deskPrices[id] ??
                (MAP[id].premium ? prices.desk_premium : prices.desk_basic)
              }
              onToggle={onToggle}
            />
          ) : (
            <div className="pillarGap" key="pillar">
              <span>PILLAR</span>
            </div>
          ),
        )}
      </div>
      <div className="floorLegend">
        <span>
          <i className="legendDesk" /> Available
        </span>
        <span>
          <i className="legendHeld" /> Held
        </span>
        <span>
          <i className="legendBooked" /> Booked
        </span>
        <span>
          <i className="legendPremiumIcon">
            <KeyRound size={12} />
          </i>{" "}
          Premium
        </span>
        <span>
          <i className="legendPillar" /> Pillar / blank
        </span>
      </div>
    </>
  );
}
function DeskCard({ id, selected, booked, maintained, price, onToggle }: any) {
  const d = MAP[id];
  const premium = PREMIUM.has(d.number);
  return (
    <button
      className={`seat deskCard ${booked ? "booked" : ""} ${maintained ? "maintenance" : ""} ${selected ? "selected" : ""}`}
      disabled={booked || maintained}
      onClick={() => onToggle(id)}
    >
      <span className="deskIcons">
        <Monitor size={30} />
        {premium && <KeyRound className="premiumKeyIcon" size={22} />}
      </span>
      <strong>{d.number}</strong>
      <b>₹{price}/day</b>
      <small>
        {maintained
          ? "MAINTENANCE"
          : booked
            ? "BOOKED"
            : premium
              ? "PREMIUM · DRAWER + LOCK"
              : "AVAILABLE"}
      </small>
      {selected && (
        <span className="deskCheck">
          <CheckCircle2 />
        </span>
      )}
    </button>
  );
}
function RoomCard({ p, space, start, duration, available, locks, officeHours }: any) {
  const firstSlot=Math.ceil(minutes(officeHours.start)/15)*15;
  const starts=Array.from({length:Math.max(0,Math.floor((minutes(officeHours.end)-firstSlot-60)/15)+1)},(_,i)=>{const n=firstSlot+i*15;return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`});
  const title = getTitle(space);
  const price = roomPrice(p);
  const times = Array.from(
    new Set(
      locks
        .filter((x: any) => x.inventoryId === space && x.start && activeLock(x))
        .map((x: any) => `${x.start}–${x.end || addHours(x.start, 1)}`),
    ),
  ).sort();
  return (
    <section className="timeRoom">
      <div className="roomVisual">
        {space === "meeting" ? (
          <div className="roomFallback">
            <Users />
          </div>
        ) : (
          <img
            src={space === "conference" ? conferenceImage : podcastImage}
            alt=""
          />
        )}
        <span>
          {space === "meeting"
            ? "8 seats"
            : space === "conference"
              ? "18 seats"
              : "Creator Studio"}
        </span>
      </div>
      <div className="roomDetails">
        <div className="roomHead">
          <div>
            <span className="eyebrow">
              {space === "meeting"
                ? "8 SEATS"
                : space === "conference"
                  ? "18 SEATS"
                  : "CREATOR ROOM"}
            </span>
            <h3>{title}</h3>
            <p>
              {space === "meeting"
                ? "Multiple hours · AC · Wi-Fi · power"
                : space === "conference"
                  ? "Multiple hours · AC · Wi-Fi · power"
                  : "Hourly · lights · microphones · stands · camera not provided"}
            </p>
          </div>
          <strong>₹{price}/hour</strong>
        </div>
        <div className="workingHoursBanner">
          <Clock3 /> <b>Open {officeHours.start}–{officeHours.end}</b>
          <span>Multi-hour booking enabled.</span>
        </div>
        <div className="roomControls">
          <label>
            Start
            <select value={start} onChange={(e) => setStart(p, e.target.value)}>
              {starts.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={busy(locks, space, s) || s >= officeHours.end}
                >
                  {s}
                  {busy(locks, space, s) ? " · BOOKED" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hours
            <select
              value={duration}
              onChange={(e) => setDuration(p, Number(e.target.value))}
            >
              {Array.from({ length: Math.max(1, available) }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} hour{i === 0 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {times.length > 0 && (
          <div className="bookedTimesBox">
            <strong>Already booked</strong>
            <div>
              {times.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <small>Booking stops at the next occupied time or {officeHours.end}.</small>
          </div>
        )}
      </div>
    </section>
  );
}
function setStart(p: any, v: string) {
  if (p.space === "meeting") p.setMeeting(v);
  else if (p.space === "conference") p.setConf(v);
  else p.setPod(v);
}
function setDuration(p: any, v: number) {
  if (p.space === "meeting") p.setMeetingDuration(v);
  else if (p.space === "conference") p.setConfDuration(v);
  else p.setPodDuration(v);
}
function Extras({
  qty,
  setQty,
  coupons,
  couponUses,
  staff,
  disabled,
  couponCode,
  setCouponCode,
  coupon,
  referralCode,
  setReferralCode,
  referralEnabled,
  reward,
  drink,
  setDrink,
  notes,
  setNotes,
}: any) {
  return (
    <section className="bookingExtras panel">
      <div className="extrasHead">
        <div>
          <span className="eyebrow">EXTRAS</span>
          <h3>Optional booking extras</h3>
        </div>
        <Plus />
      </div>
      <div className="extrasGrid">
        <label>
          Coupon
          <select
            value={couponCode}
            disabled={disabled}
            onChange={(e) => setCouponCode(e.target.value)}
          >
            <option value="">No coupon</option>
            {coupons.filter((c:any)=>c.active&&(!c.expiresAt||c.expiresAt.toMillis?.()>Date.now())&&(staff||c.visibleToUsers===true)&&Number(couponUses[c.id]||0)<Number(c.maxUsesPerCustomer??c.maxUses??1)).map((c:any)=><option key={c.id} value={c.code}>{c.code} · {c.type==="percent"?`${c.value}%`:`₹${c.value}`} off{c.visibleToUsers===false?" · staff only":""}</option>)}
          </select>
          {coupon && (
            <small className="goodText">
              {coupon.value}
              {coupon.type === "percent" ? "%" : "₹"} discount ready
            </small>
          )}
          {disabled&&<small>Pass pricing is already fixed; coupons do not stack.</small>}
        </label>
        <label>
          Referral code
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="Optional"
          />
          <small>
            {referralEnabled
              ? `${reward || 0}% referral reward enabled`
              : "Referral program disabled"}
          </small>
        </label>
      </div>
      <div className="addonGrid">
        <div className="addonRow drinkChoice"><span><b>One complimentary drink</b><small>Choose coffee or tea · no charge</small></span><div className="drinkButtons"><button type="button" className={!drink?"active":""} onClick={()=>setDrink("")}>None</button><button type="button" className={drink==="Coffee"?"active":""} onClick={()=>setDrink("Coffee")}>Coffee</button><button type="button" className={drink==="Tea"?"active":""} onClick={()=>setDrink("Tea")}>Tea</button></div></div>
        <label className="addonRow">
          <span><b>Printing</b><small>₹5 per page</small></span>
          <input type="number" inputMode="numeric" min="0" max="200" step="1" aria-label="Printing pages" value={qty.printing||0} onChange={e=>setQty({...qty,printing:Math.max(0,Math.min(200,Math.floor(Number(e.target.value))))})}/>
        </label>
      </div>
      <label className="notesField">
        Booking note
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Setup or special request"
        />
      </label>
    </section>
  );
}
function StaffPaymentPanel({total,minimumDue,passDays,tender,setTender,verified,setVerified,canCollect}:any){
  const amount=Math.round((Number(tender.cash||0)+Number(tender.upi||0))*100)/100;
  const fill=(method:"cash"|"upi",value:number)=>setTender({...emptyTender(),[method]:value});
  return <section className="staffPaymentPanel panel">
    <div className="extrasHead"><div><span className="eyebrow">02 / PAYMENT</span><h3>Receive advance payment</h3></div><WalletCards/></div>
    {!canCollect?<p className="inlineError">Your role can create requests but cannot collect money. Ask an authorised teammate to complete this booking.</p>:<>
      <div className="paymentDueLine"><span>{passDays?"Minimum required now":"Full advance required"}</span><strong>₹{minimumDue.toLocaleString("en-IN")}</strong><small>Booking total ₹{total.toLocaleString("en-IN")}</small></div>
      <div className="paymentQuickButtons"><button type="button" className="ghost" onClick={()=>fill("upi",total)}>Full by UPI</button><button type="button" className="ghost" onClick={()=>fill("cash",total)}>Full by cash</button>{passDays&&minimumDue<total&&<button type="button" className="ghost" onClick={()=>fill("upi",minimumDue)}>Minimum by UPI</button>}</div>
      <div className="fieldGrid paymentFields"><label>Cash received ₹<input type="number" inputMode="decimal" min="0" step="0.01" value={tender.cash} onChange={e=>setTender({...tender,cash:Number(e.target.value)})}/></label><label>UPI received ₹<input type="number" inputMode="decimal" min="0" step="0.01" value={tender.upi} onChange={e=>setTender({...tender,upi:Number(e.target.value)})}/></label><label className="full">UPI transaction reference{Number(tender.upi)>0?" *":""}<input value={tender.reference} onChange={e=>setTender({...tender,reference:e.target.value})} placeholder="Verify in the merchant app, then enter reference"/></label></div>
      <div className={`paymentReconcile ${amount>total?"bad":""}`}><span>Receiving now</span><b>₹{amount.toLocaleString("en-IN")}</b><small>{amount>total?"Amount exceeds booking total":passDays&&amount<minimumDue?`₹${(minimumDue-amount).toLocaleString("en-IN")} more required`:!passDays&&amount!==total?`Enter exactly ₹${total.toLocaleString("en-IN")}`:`Remaining after payment: ₹${Math.max(0,total-amount).toLocaleString("en-IN")}`}</small></div>
      <label className="checkLabel paymentVerify"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>I verified the cash and/or UPI amount received. Save an immutable receipt and confirm this booking.</span></label>
    </>}
  </section>;
}
function Summary({
  officeHours,passDays,
  staffBooking,
  canConfirm,
  customerReady = true,
  busy = false,
  title,
  date,
  endDate,
  days,
  start,
  end,
  isDesk,
  selected,
  dailyBase,
  baseTotal,
  stayDiscount,
  bulkDiscount,
  couponDiscount,
  coupon,
  referralDiscount,
  offerDiscount,
  bestOffer,
  wednesdayDiscount,
  addonTotal,
  total,
  paymentReady,
  payingNow,
  withinAdvance,
  maintenance,
  roomBooked,
  valid,
  onBook,
  message,
  limit,
}: any) {
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message)
      msgRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [message]);
  return (
    <aside className="summary panel">
      <span className="eyebrow">BOOKING SUMMARY</span>
      <h3>
        {selected.length
          ? `${selected.length} Desk${selected.length === 1 ? "" : "s"} Selected`
          : title}
      </h3>
      <p>
        <CalendarDays /> {date}
        {endDate !== date ? ` → ${endDate}` : ""}
      </p>
      {!isDesk && (
        <p>
          <Clock3 /> {start}–{end}
        </p>
      )}
      {isDesk && selected.length > 0 && (
        <p>
          <Monitor /> {selected.join(", ")}
        </p>
      )}
      <p>
        <Clock3 /> Office hours: {officeHours.start}–{officeHours.end}
      </p>
      {!withinAdvance && (
        <Info text={`Max advance booking is ${limit} days.`} danger />
      )}
      {maintenance && (
        <Info
          text="One or more selected desks are under maintenance for at least one date in your range. Remove them or adjust your dates."
          danger
        />
      )}
      {!isDesk && roomBooked && (
        <Info text={`${start} is already booked.`} danger />
      )}
      {message && (
        <div ref={msgRef}>
          <Info
            text={message}
            danger={
              !message.startsWith("Request") &&
              !message.startsWith("Booking") &&
              !message.startsWith("Customer saved")
            }
          />
        </div>
      )}
      <hr />
      <Money label="Base / day" value={dailyBase} />
      <Money label={`${days} day${days === 1 ? "" : "s"}`} value={baseTotal} />
      {stayDiscount > 0 && (
        <Money label="5+ day discount" value={-stayDiscount} good />
      )}
      {bulkDiscount > 0 && (
        <Money label="6+ desk bulk discount" value={-bulkDiscount} good />
      )}
      {offerDiscount > 0 && (
        <Money
          label={bestOffer?.title || "Duration offer"}
          value={-offerDiscount}
          good
        />
      )}
      {wednesdayDiscount > 0 && (
        <Money
          label="Wednesday power-notice discount"
          value={-wednesdayDiscount}
          good
        />
      )}
      {couponDiscount > 0 && (
        <Money
          label={`Coupon ${coupon?.code || ""}`}
          value={-couponDiscount}
          good
        />
      )}
      {referralDiscount > 0 && (
        <Money label="Referral reward" value={-referralDiscount} good />
      )}
      {addonTotal > 0 && <Money label="Add-ons" value={addonTotal} />}
      <div className="money total">
        <span>Total</span>
        <strong>₹{total}</strong>
      </div>
      {!passDays && days >= 5 ? (
        <div className="multiDayPromo">
          <Percent />
          <div>
            <strong>10% multi-day discount applied</strong>
            <small>Valid for 5 or more days.</small>
          </div>
        </div>
      ) : null}
      <div className="securityNote">
        <Lock />
        <span>
          {staffBooking
            ? "Save the customer, then collect payment before confirming the booking."
            : "Online requests reserve the selected resource for 15 minutes while payment is completed."}
        </span>
      </div>
      {staffBooking&&<div className={`summaryPaymentState ${paymentReady?"ready":""}`}><span>{paymentReady?"Payment verified":"Payment required"}</span><strong>₹{Number(payingNow||0).toLocaleString("en-IN")}</strong></div>}
      <button
        className="primary bookCta"
        disabled={
          !withinAdvance || !valid || maintenance || busy || !customerReady || (staffBooking&&!paymentReady)
        }
        onClick={onBook}
      >
        {busy ? (
          "Please wait…"
        ) : staffBooking ? (
          <>
            <CheckCircle2 />{" "}
            {canConfirm ? "Receive payment & confirm" : "Payment permission required"}
          </>
        ) : (
          <>
            <MessageCircle /> Request on WhatsApp
          </>
        )}
      </button>
    </aside>
  );
}
function Money({ label, value, good = false }: any) {
  return (
    <div className={`money ${good ? "good" : ""}`}>
      <span>{label}</span>
      <b>
        {value < 0 ? "−" : ""}₹{Math.abs(value).toLocaleString("en-IN")}
      </b>
    </div>
  );
}
function Info({ text, danger = false }: any) {
  return (
    <div className={danger ? "warningBox" : "successBox"}>
      <AlertCircle />
      <span>{text}</span>
    </div>
  );
}
function ProfileModal({
  busy = false,
  title,
  date,
  endDate,
  total,
  profile,
  setProfile,
  onClose,
  onContinue,
  message,
}: any) {
  const professions = [
    "IT Professional",
    "Developer",
    "Tester",
    "Marketing Team",
    "Student",
    "Designer",
    "Consultant",
    "Business",
    "Other",
  ];
  return (
    <div className="modalBackdrop">
      <div className="profileModal modernProfileModal">
        <div className="profileModalHead">
          <div>
            <span className="eyebrow">FINAL CHECK</span>
            <h3>Customer details</h3>
            <p>
              Google name is used automatically. Add your contact and
              professional details before submitting.
            </p>
          </div>
          <button className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="profileSummary">
          <span>{title}</span>
          <b>
            {date}
            {endDate !== date ? ` → ${endDate}` : ""}
          </b>
          <strong>₹{total}</strong>
        </div>
        <div className="profileForm modernProfileForm">
          <label className="full">
            <span>
              Mobile number <em>*</em>
            </span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={profile.mobile || ""}
              onChange={(e) =>
                setProfile({ ...profile, mobile: e.target.value })
              }
            />
            <small>Used for booking contact and WhatsApp.</small>
          </label>
          <label>
            <span>Gender</span>
            <select
              value={profile.gender || ""}
              onChange={(e) =>
                setProfile({ ...profile, gender: e.target.value })
              }
            >
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
              <option>Prefer not to say</option>
            </select>
          </label>
          <div className="customerDateField">
            <DatePicker label="Date of birth" value={profile.dob||""} min="1900-01-01" max={localToday()} placeholder="Choose date of birth" onChange={dob=>setProfile({...profile,dob})}/>
          </div>
          <label>
            <span>Profession</span>
            <select
              value={profile.profession || ""}
              onChange={(e) =>
                setProfile({ ...profile, profession: e.target.value })
              }
            >
              <option value="">Select profession</option>
              {professions.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {profile.profession === "Other" && (
            <label className="full">
              <span>
                Tell us your profession <em>*</em>
              </span>
              <input
                value={profile.otherProfession || ""}
                onChange={(e) =>
                  setProfile({ ...profile, otherProfession: e.target.value })
                }
                placeholder="e.g. Architect, HR, Photographer"
              />
            </label>
          )}
        </div>
        {message && <div className="modalError">{message}</div>}
        <div className="modalFooter">
          <small>
            We use these details only to manage your Coworx Central booking.
          </small>
          <button
            className="primary modernContinue"
            disabled={busy}
            onClick={onContinue}
          >
            {busy ? "Creating booking…" : "Continue to WhatsApp"}{" "}
            <MessageCircle size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
