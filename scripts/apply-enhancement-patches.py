from pathlib import Path

# Add editable homepage-card editor to existing Homepage Notices operations tab.
ops_path=Path("src/pages/OperationsSuite.tsx")
ops=ops_path.read_text()
if 'HomepageContentEditor' not in ops:
    ops=ops.replace('import EnquiryCRM from "../components/EnquiryCRM";\n','import EnquiryCRM from "../components/EnquiryCRM";\nimport { HomepageContentEditor } from "../components/HomepagePossibilities";\n',1)
    start='      {tab === "banners" && can("noticesManage") && ('
    end='      {tab === "comms" && can("communicationsManage") && ('
    a=ops.find(start);b=ops.find(end,a)
    if a<0 or b<0: raise SystemExit("Homepage banners block not found")
    block=ops[a:b]
    block=block.replace(start,start+'\n        <>\n          <HomepageContentEditor onFlash={onFlash} />',1)
    tail='        </section>\n      )}\n'
    pos=block.rfind(tail)
    if pos<0: raise SystemExit("Homepage banners block closing not found")
    block=block[:pos]+tail.replace('      )}','        </>\n      )}')+block[pos+len(tail):]
    ops=ops[:a]+block+ops[b:]
ops_path.write_text(ops)

# Replace the homepage workspace cards with informational detail cards, keeping fallback photos.
home_path=Path("src/pages/CustomerHome.tsx")
home=home_path.read_text()
if 'HomepagePossibilities' not in home:
    home=home.replace('import Dialog from "../components/Dialog";\n','import Dialog from "../components/Dialog";\nimport { HomepagePossibilities } from "../components/HomepagePossibilities";\n',1)
    start='      <section className="homeSpaces" id="spaces">'
    end='      <section className="homeStory">'
    a=home.find(start);b=home.find(end,a)
    if a<0 or b<0: raise SystemExit("Homepage possibilities section not found")
    replacement='''      <HomepagePossibilities fallbackImages={{desk:desksImage,meeting:meetingImage,conference:conferenceImage,podcast:studioImage}} />\n'''
    home=home[:a]+replacement+home[b:]
    user_marker='      {user ? ('
    if user_marker not in home: raise SystemExit("Homepage user marker not found")
    closure='''      {hours.closed && (\n        <div className="homeNotice closureNotice">\n          <Clock3 size={17} />\n          <div><b>Coworx Central is closed today</b><span>{hours.reason || "Office closed"}. Desks, rooms and service orders are unavailable today.</span></div>\n        </div>\n      )}\n'''
    home=home.replace(user_marker,closure+user_marker,1)
home_path.write_text(home)

# Rules: homepage content belongs to notice managers; check-in is impossible on a closed date.
rules_path=Path("firestore.rules")
rules=rules_path.read_text()
if "id == 'homeContent'" not in rules:
    rules=rules.replace("        id == 'servicePricing' && can('paymentsManage') ||\n","        id == 'servicePricing' && can('paymentsManage') ||\n        id == 'homeContent' && can('noticesManage') ||\n",1)
    rules=rules.replace("'deskPricing','deskFeatures','servicePricing','upi'","'deskPricing','deskFeatures','servicePricing','homeContent','upi'",1)
rules=rules.replace("can('checkIn') && bookingToday(b) && entryPaid(b)","can('checkIn') && bookingToday(b) && openDay(today()) && entryPaid(b)",1)
rules_path.write_text(rules)
