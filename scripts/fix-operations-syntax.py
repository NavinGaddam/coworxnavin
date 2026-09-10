from pathlib import Path
p=Path('src/pages/OperationsSuite.tsx')
s=p.read_text()
old='''      {tab === "banners" && can("noticesManage") && (\n        <>\n          <HomepageContentEditor onFlash={onFlash} />\n        <section className="opsPanel">'''
new='''      {tab === "banners" && can("noticesManage") && (\n        <div className="homepageAdminStack">\n          <HomepageContentEditor onFlash={onFlash} />\n          <section className="opsPanel">'''
if old not in s:
    raise SystemExit('opening banners block target not found')
s=s.replace(old,new,1)
old2='''        </section>\n        </>\n      )}\n      {tab === "wednesday"'''
new2='''          </section>\n        </div>\n      )}\n      {tab === "wednesday"'''
if old2 not in s:
    raise SystemExit('closing banners block target not found')
s=s.replace(old2,new2,1)
p.write_text(s)
