from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch target: {label}")
    return text.replace(old, new, 1)

# OperationsSuite: keep all existing operational modules, replace only enquiry tab.
ops_path = Path("src/pages/OperationsSuite.tsx")
ops = ops_path.read_text()
if 'import EnquiryCRM from "../components/EnquiryCRM";' not in ops:
    ops = replace_once(
        ops,
        'import DeskRates from "../components/DeskRates";\n',
        'import DeskRates from "../components/DeskRates";\nimport EnquiryCRM from "../components/EnquiryCRM";\n',
        "EnquiryCRM import",
    )
start = '      {tab === "enquiries" && can("enquiriesManage") && ('
end = '      {tab === "resources" && can("resourcesManage") && ('
if start in ops and end in ops:
    a = ops.index(start)
    b = ops.index(end, a)
    ops = ops[:a] + '''      {tab === "enquiries" && can("enquiriesManage") && (\n        <EnquiryCRM actorUid={uid} onFlash={onFlash} />\n      )}\n''' + ops[b:]
ops_path.write_text(ops)

# Booking: no popup placeholder, full advance for every booking, configurable Sunday copy.
booking_path = Path("src/pages/Booking.tsx")
booking = booking_path.read_text()
booking = replace_once(
    booking,
    '''    const waWindow = !p.staffBooking\n      ? window.open("about:blank", "_blank")\n      : null;\n    if (waWindow) waWindow.opener = null;\n''',
    '',
    "remove blank WhatsApp popup",
)
booking = replace_once(
    booking,
    '''        setWhatsAppUrl(url);\n        if (waWindow) waWindow.location.href = url;\n''',
    '''        // Show a direct user-clicked WhatsApp link after the booking is saved.\n        // Opening a blank window before async Firestore work caused blank tabs on some browsers.\n        setWhatsAppUrl(url);\n''',
    "WhatsApp handoff",
)
booking = booking.replace('      waWindow?.close();\n', '')
booking = replace_once(
    booking,
    '  const minimumDue=selectedPlan?Math.ceil(total*Number(selectedPlan.minimumAdvancePercent||policy.minimumAdvancePercent||50))/100:total;\n',
    '  const minimumDue=total;\n',
    "full advance minimum",
)
booking = replace_once(
    booking,
    '  const paymentReady=!p.staffBooking||Boolean(p.canConfirm&&paymentVerified&&payingNow<=total&&(selectedPlan?payingNow>=minimumDue:payingNow===total)&&(!tender.upi||tender.reference.trim()));\n',
    '  const paymentReady=!p.staffBooking||Boolean(p.canConfirm&&paymentVerified&&payingNow===total&&(!tender.upi||tender.reference.trim()));\n',
    "full advance readiness",
)
booking = booking.replace(
    'Sundays are holidays.',
    'Sunday follows the configured weekly schedule.',
)
booking = booking.replace(
    'Partial advance permitted; extra reschedules require admin approval.',
    'Full advance payment is required; extra reschedules require admin approval.',
)
booking = booking.replace(
    'Verify at least ₹${minimumDue.toLocaleString("en-IN")} received before creating this pass.',
    'Verify the full ₹${total.toLocaleString("en-IN")} advance payment before creating this pass.',
)
booking = replace_once(
    booking,
    '  const amount=Math.round((Number(tender.cash||0)+Number(tender.upi||0))*100)/100;\n',
    '  const amount=Math.round((Number(tender.cash||0)+Number(tender.upi||0)+Number(tender.other||0))*100)/100;\n',
    "staff tender total",
)
booking = booking.replace(
    '{passDays?"Minimum required now":"Full advance required"}',
    '{"Full advance required"}',
)
booking = booking.replace(
    '{passDays&&minimumDue<total&&<button type="button" className="ghost" onClick={()=>fill("upi",minimumDue)}>Minimum by UPI</button>}',
    '',
)
booking = booking.replace(
    'passDays&&amount<minimumDue?`₹${(minimumDue-amount).toLocaleString("en-IN")} more required`:!passDays&&amount!==total?',
    'amount!==total?',
)
booking_path.write_text(booking)
