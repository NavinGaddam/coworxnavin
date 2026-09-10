import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, PASS_ALLOWANCES, bookingOn, cancellationQuote, consecutiveDates, officeHours, paymentAccessError, rescheduleError, sessionHours, timeAt, validatePolicy } from "../src/lib/business";
import { attendanceError } from "../src/lib/booking-pass";

describe("consecutive office passes",()=>{
  it("counts 10/20/30 open working days, skips default Sundays and declared holidays",()=>{
    for(const count of [10,20,30]) {
      const dates=consecutiveDates("2026-09-12",count,DEFAULT_POLICY,[{date:"2026-09-14",active:true}]);
      expect(dates).toHaveLength(count);
      expect(dates).not.toContain("2026-09-13");expect(dates).not.toContain("2026-09-14");
      expect(new Set(dates).size).toBe(count);
      expect(dates.every(d=>!officeHours(d).closed)).toBe(true);
    }
    expect(PASS_ALLOWANCES).toEqual({10:1,20:2,30:3});
  });
  it("honours seasonal dates and one-day exceptions, with Sunday closed by default",()=>{
    const p={...DEFAULT_POLICY,seasons:[{from:"2026-11-01",to:"2027-02-28",start:"10:30",end:"18:45"}],exceptions:[{date:"2026-11-02",start:"11:15",end:"16:20"}]};
    expect(officeHours("2026-10-31",p).start).toBe("09:00");
    expect(officeHours("2026-11-03",p).start).toBe("10:30");
    expect(officeHours("2026-11-02",p)).toMatchObject({start:"11:15",end:"16:20"});
    expect(officeHours("2026-11-01",p).closed).toBe(true);
    expect(()=>validatePolicy({...DEFAULT_POLICY,businessStart:"19:00",businessEnd:"09:00"})).toThrow();
  });
  it("uses exact included dates and rejects exhausted, late and closed-day reschedules",()=>{
    const dates=consecutiveDates("2026-09-10",10),b={status:"Confirmed",passDays:10,date:dates[0],endDate:dates.at(-1),originalEndDate:dates.at(-1),dates,rescheduleAllowance:1,rescheduleUsed:0};
    const now=timeAt("2026-09-09","12:00");
    expect(bookingOn(b,"2026-09-13")).toBe(false);
    expect(rescheduleError(b,dates[0],"2026-09-23",DEFAULT_POLICY,[],now)).toBe("");
    expect(rescheduleError({...b,rescheduleUsed:1},dates[0],"2026-09-23",DEFAULT_POLICY,[],now)).toContain("allowance");
    expect(rescheduleError(b,dates[0],"2026-09-27",DEFAULT_POLICY,[],now)).toContain("holiday");
    expect(rescheduleError(b,dates[0],"2026-09-23",DEFAULT_POLICY,[],timeAt(dates[0],"09:00"))).toContain("before");
  });
});
describe("advance payments and daily sessions",()=>{
  const b={status:"Confirmed",date:"2026-09-09",endDate:"2026-09-09",dates:["2026-09-09"],total:1000,paymentReceived:1000,sessions:{"2026-09-09":{start:"08:15",end:"18:45"}}};
  it("requires full advance for regular bookings and passes",()=>{
    expect(paymentAccessError({...b,paymentReceived:500})).toContain("Full advance");
    expect(paymentAccessError({...b,passDays:10,minimumAdvance:500,paymentReceived:500,balanceDueDate:"2026-09-10"},"2026-09-10")).toContain("Full advance");
    expect(paymentAccessError({...b,passDays:10,minimumAdvance:500,paymentReceived:1000,balanceDueDate:"2026-09-10"},"2026-09-11")).toBe("");
  });
  it("permits same-day re-entry but not early or after-close admission",()=>{
    const left={...b,attendanceDate:b.date,checkedInAt:1,checkedOutAt:2};
    expect(attendanceError(left,b.date,"in",timeAt(b.date,"10:00"))).toBe("");
    expect(attendanceError(left,b.date,"in",timeAt(b.date,"08:14"))).toContain("only during");
    expect(attendanceError(left,b.date,"in",timeAt(b.date,"18:45"))).toContain("only during");
    expect(sessionHours(b,b.date)).toEqual({start:"08:15",end:"18:45"});
  });
  it("quotes the snapshotted cancellation policy before and after cutoff",()=>{
    const paid={...b,cancellationPolicy:{hours:24,refundPercent:80}};
    expect(cancellationQuote(paid,timeAt("2026-09-08","08:00")).refund).toBe(800);
    expect(cancellationQuote(paid,timeAt("2026-09-08","08:16")).refund).toBe(0);
  });
});
