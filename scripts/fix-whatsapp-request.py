from pathlib import Path

p = Path('src/pages/Booking.tsx')
s = p.read_text()
old = '''        const url = `https://wa.me/919970836509?text=${encodeURIComponent(text)}`;
        // Show a direct user-clicked WhatsApp link after the booking is saved.
        // Opening a blank window before async Firestore work caused blank tabs on some browsers.
        setWhatsAppUrl(url);'''
new = '''        const url = `https://wa.me/919970836509?text=${encodeURIComponent(text)}`;
        // Keep a visible fallback link, but navigate this same tab directly to WhatsApp.
        // Same-tab navigation avoids popup blockers and blank tabs after async Firestore work.
        setWhatsAppUrl(url);
        if (typeof window !== "undefined") window.location.assign(url);'''
if old not in s:
    raise SystemExit('WhatsApp booking target not found')
s = s.replace(old, new, 1)
p.write_text(s)
