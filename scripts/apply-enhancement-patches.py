from pathlib import Path

path = Path("src/pages/OperationsSuite.tsx")
text = path.read_text()

banner_bad = '''            {!banners.length && <p className="opsNote">No banners yet.</p>}\n          </div>\n        </section>\n      )}\n      {tab === "wednesday" && can("pricingManage") && ('''
banner_good = '''            {!banners.length && <p className="opsNote">No banners yet.</p>}\n          </div>\n        </section>\n        </>\n      )}\n      {tab === "wednesday" && can("pricingManage") && ('''

wednesday_bad = '''        </section>\n        </>\n      )}\n      {tab === "enquiries" && can("enquiriesManage") && ('''
wednesday_good = '''        </section>\n      )}\n      {tab === "enquiries" && can("enquiriesManage") && ('''

if banner_bad not in text:
    raise SystemExit("Expected banner fragment boundary was not found")
if wednesday_bad not in text:
    raise SystemExit("Expected misplaced Wednesday fragment close was not found")

text = text.replace(banner_bad, banner_good, 1)
text = text.replace(wednesday_bad, wednesday_good, 1)
path.write_text(text)
