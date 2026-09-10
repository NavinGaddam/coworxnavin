from pathlib import Path
p=Path('tests/firestore.rules.test.ts')
s=p.read_text()
repls={
'phone: "4575757575",':'phone: "6575757575",',
'.rejects.toThrow("full advance")':'.rejects.toThrow("Full advance")',
'it("records allowed pass instalments and blocks a disabled collection capability",async()=>{\n    const created=await passBooking();auth("reception");\n    await expect(collectPayment(created.id,{cash:499,upi:0,other:0,reference:""})).rejects.toThrow("at least");\n    await collectPayment(created.id,{cash:500,upi:0,other:0,reference:""});\n    let b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;\n    expect(b.passDays).toBe(10);expect(b.dates).toHaveLength(10);expect(b.rescheduleAllowance).toBe(1);expect(b.paymentStatus).toBe("Partially Paid");\n    await seed("settings/permissions",{Receptionist:{paymentsCollect:false}});\n    await assertFails(collectPayment(created.id,{cash:500,upi:0,other:0,reference:""}));\n    auth("manager");await collectPayment(created.id,{cash:0,upi:500,other:0,reference:"FINAL-1"});\n    b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;expect(b.paymentStatus).toBe("Paid");\n    expect((await getDocs(collection(session.db,"payments"))).size).toBe(2);\n  });':'it("requires full advance for passes and blocks a disabled collection capability",async()=>{\n    const created=await passBooking();auth("reception");\n    await expect(collectPayment(created.id,{cash:999,upi:0,other:0,reference:""})).rejects.toThrow("Full advance");\n    await seed("settings/permissions",{Receptionist:{paymentsCollect:false}});\n    await assertFails(collectPayment(created.id,{cash:1000,upi:0,other:0,reference:""}));\n    auth("manager");await collectPayment(created.id,{cash:500,upi:500,other:0,reference:"FINAL-1"});\n    const b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;\n    expect(b.passDays).toBe(10);expect(b.dates).toHaveLength(10);expect(b.rescheduleAllowance).toBe(1);expect(b.paymentStatus).toBe("Paid");\n    expect((await getDocs(collection(session.db,"payments"))).size).toBe(1);\n  });',
'const created=await passBooking();auth("manager");await collectPayment(created.id,{cash:500,upi:0,other:0,reference:""});':'const created=await passBooking();auth("manager");await collectPayment(created.id,{cash:1000,upi:0,other:0,reference:""});'
}
for old,new in repls.items():
    if old not in s:
        raise SystemExit('missing test patch target: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s)
# trigger one-time test migration workflow
