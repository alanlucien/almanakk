// THE ALMANAC'S RULES, IN SWIFT — the native app's engine (Alan, 09.10: the full app,
// iPhone first). A faithful port of v3/app.js: the same holidays, the same reading of a
// title, the same month rows. Where the two disagree, the web version is the reference
// until the app has caught up; every function names the one it ports.
//
// Not ported yet (stage 1b): the flight parser and the airport table. The city column
// reads tour legs and "-Roma" moves only.
import Foundation

// ---------- the almanac's own words, Norwegian or English (Alan, 11.10) ----------
// His entries are never translated; only the almanac's words: months, weekdays, buttons.
// Holiday names stay Norwegian, as on the web.
var englishUI: Bool { UserDefaults.standard.string(forKey: "almanakk.lang") == "en" }
func T(_ no: String, _ en: String) -> String { englishUI ? en : no }

// ---------- the data, as Google keeps it ----------

struct CalEvent: Codable, Identifiable, Hashable {
    var id: String
    var calId: String
    var title: String
    var start: String          // YYYY-MM-DD
    var end: String            // YYYY-MM-DD, the LAST day (inclusive), as the web app keeps it
    var time: String = ""      // HH:MM, '' = all day
    var endTime: String = ""
    var location: String = ""
    var notes: String = ""
    var colorId: String = ""
    var fromGmail: Bool = false
    var zone: String = ""       // a timed event's own time zone, as Google keeps it
    var minutes: Int = 0        // how long a timed event lasts, start to end instant (zones counted)
    var isSpan: Bool { end > start }
}

struct CalInfo: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var color: String          // #rrggbb
}

// ---------- small text tools ----------

enum RX {
    private static var cache: [String: NSRegularExpression] = [:]
    static func re(_ p: String, _ ci: Bool = false) -> NSRegularExpression {
        let key = (ci ? "i:" : "") + p
        if let r = cache[key] { return r }
        let r = try! NSRegularExpression(pattern: p, options: ci ? [.caseInsensitive] : [])
        cache[key] = r; return r
    }
    static func test(_ p: String, _ s: String, ci: Bool = false) -> Bool {
        re(p, ci).firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }
    static func groups(_ p: String, _ s: String, ci: Bool = false) -> [String]? {
        guard let m = re(p, ci).firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            Range(m.range(at: i), in: s).map { String(s[$0]) } ?? ""
        }
    }
    static func sub(_ p: String, _ s: String, _ with: String, ci: Bool = false) -> String {
        re(p, ci).stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: with)
    }
}

extension String {
    var squeezed: String { RX.sub("\\s+", self, " ").trimmingCharacters(in: .whitespaces) }
    /// deco(): Google sometimes hands titles back with HTML entities. And NO EMOJI: a wall
    /// calendar has no pictograms (Alan, 10.10: "I do NOT like the theatre mask"); a title
    /// is shown in plain words whatever another client wrote into it.
    var deco: String {
        var s = self
        for (k, v) in ["&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#039;": "'", "&apos;": "'", "&nbsp;": " "] {
            s = s.replacingOccurrences(of: k, with: v)
        }
        let plain = RX.sub("[\\p{Extended_Pictographic}\\x{FE0F}\\x{200D}\\x{20E3}]", s, "").squeezed
        return plain.isEmpty ? s : plain
    }
}

// ---------- dates (fmt, parseDate, daysInMonth, weekdayIdx, isoWeek) ----------

enum Day {
    static let greg: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = .current; return c }()
    static let iso: Calendar = { var c = Calendar(identifier: .iso8601); c.timeZone = .current; return c }()
    static func key(_ y: Int, _ m: Int, _ d: Int) -> String { String(format: "%04d-%02d-%02d", y, m + 1, d) }   // m 0-based, as JS
    static func key(_ date: Date) -> String {
        let c = greg.dateComponents([.year, .month, .day], from: date)
        return key(c.year!, c.month! - 1, c.day!)
    }
    static func date(_ key: String) -> Date {
        let p = key.split(separator: "-").compactMap { Int($0) }
        return greg.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))!
    }
    static func add(_ key: String, _ n: Int) -> String { Day.key(greg.date(byAdding: .day, value: n, to: date(key))!) }
    static func daysInMonth(_ y: Int, _ m: Int) -> Int { greg.range(of: .day, in: .month, for: date(key(y, m, 1)))!.count }
    /// 0 = Monday … 6 = Sunday
    static func weekdayIdx(_ key: String) -> Int { (greg.component(.weekday, from: date(key)) + 5) % 7 }
    static func isoWeek(_ key: String) -> Int { iso.component(.weekOfYear, from: date(key)) }
    static var today: String { key(Date()) }
}

// ---------- Norwegian holidays (easterDate, holidays) ----------

struct Holiday { var name: String; var red: Bool }

enum Holidays {
    private static var cache: [Int: [String: Holiday]] = [:]
    static func easter(_ y: Int) -> String {
        let a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4, f = (b + 8) / 25
        let g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4
        let l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451
        let mo = (h + l - 7 * m + 114) / 31, da = ((h + l - 7 * m + 114) % 31) + 1
        return Day.key(y, mo - 1, da)
    }
    static func of(_ y: Int) -> [String: Holiday] {
        let ck = y * 2 + (englishUI ? 1 : 0)
        if let c = cache[ck] { return c }
        var map: [String: Holiday] = [:]
        func put(_ k: String, _ name: String, _ red: Bool = false) { map[k] = Holiday(name: name, red: red) }
        let E = easter(y)
        put(Day.key(y, 0, 1), T("1. Nyttårsdag", "New Year's Day"), true)
        put(Day.add(E, -7), T("Palmesøndag", "Palm Sunday"), true)
        put(Day.add(E, -3), T("Skjærtorsdag", "Maundy Thursday"), true)
        put(Day.add(E, -2), T("Langfredag", "Good Friday"), true)
        put(Day.add(E, -1), T("Påskeaften", "Easter Eve"))
        put(E, T("1. Påskedag", "Easter Sunday"), true)
        put(Day.add(E, 1), T("2. Påskedag", "Easter Monday"), true)
        put(Day.key(y, 4, 1), T("1. mai", "May Day"), true)
        put(Day.key(y, 4, 17), T("17. mai", "Constitution Day"), true)
        put(Day.add(E, 39), T("Kr. himmelfart", "Ascension Day"), true)
        put(Day.add(E, 49), T("1. Pinsedag", "Whit Sunday"), true)
        put(Day.add(E, 50), T("2. Pinsedag", "Whit Monday"), true)
        put(Day.key(y, 5, 23), T("St.Hansaften", "Midsummer Eve"))
        let dec24 = Day.key(y, 11, 24)
        let advent4 = Day.add(dec24, -((Day.weekdayIdx(dec24) + 1) % 7))   // the Sunday on or before the 24th
        for n in 1...4 { put(Day.add(advent4, (n - 4) * 7), T("\(n). advent", "Advent \(n)")) }
        put(dec24, T("Julaften", "Christmas Eve"))
        put(Day.key(y, 11, 25), T("1. Juledag", "Christmas Day"), true)
        put(Day.key(y, 11, 26), T("2. Juledag", "Boxing Day"), true)
        put(Day.key(y, 11, 31), T("Nyttårsaften", "New Year's Eve"))
        cache[ck] = map
        return map
    }
}

// ---------- what a title means ----------

enum Rules {
    static let showRE = "\\b(show\\w*|prem\\w*|première|performance\\w*|forest\\w*|visning\\w*|vorstellung\\w*|matin[ée]\\w*)\\b"
    static func isShow(_ e: CalEvent) -> Bool { RX.test(showRE, RX.sub("show[\\s-]*call", e.title, "", ci: true), ci: true) }
    static func effTime(_ e: CalEvent) -> String {
        if !e.time.isEmpty { return e.time }
        guard let g = RX.groups("\\b([01]?\\d|2[0-3])[:.]([0-5]\\d)\\b", e.title) else { return "" }
        return (g[1].count == 1 ? "0" + g[1] : g[1]) + ":" + g[2]
    }
    static func isTbc(_ e: CalEvent) -> Bool { RX.test("\\btbc\\b", e.title, ci: true) || RX.test("^HOLD\\b", e.title) }
    static func isHold(_ e: CalEvent) -> Bool { RX.test("^HOLD\\b", e.title) }
    /// pencilled = a "?" ending the title (09.10); an old P line in the notes still counts
    static func isPencil(_ e: CalEvent) -> Bool { RX.test("\\s*\\?\\s*$", e.title) || RX.test("^P[ \\t]*(\\r?\\n|$)", e.notes) }

    static func stripParens(_ t: String) -> String {
        var out = RX.sub("\\s*\\([^)]*\\)", t, " ")
        out = RX.sub("\\s*\\[[^\\]]*\\]", out, " ")
        out = RX.sub("^[\\s\\-–—:·,]+|[\\s\\-–—:·,]+$", out, "").squeezed
        return RX.test("[\\p{L}\\d]", out) ? out : t
    }
    static func stripClock(_ t: String) -> String {
        var out = RX.sub("\\b([01]?\\d|2[0-3])[:.][0-5]\\d\\b", t, " ")
        out = RX.sub("^[\\s\\-–—:·]+", out, "").squeezed
        return out.isEmpty ? t : out
    }
    /// wallTitle(): a day's title loses the name of the span it sits under, and the year
    static func wallTitle(_ title: String, covers: [String]) -> String {
        let original = title.squeezed
        var t = " " + original + " "
        let noYear = RX.sub("\\b(19|20)\\d\\d\\b", t, " ")
        if !noYear.trimmingCharacters(in: .whitespaces).isEmpty { t = noYear }
        for c in covers {
            let words = c.squeezed.split(separator: " ").map(String.init)
            var k = words.count
            while k >= 1 {
                let name = words[0..<k].joined(separator: " ")
                k -= 1
                if name.count < 4 { continue }
                let p = "\\s" + NSRegularExpression.escapedPattern(for: name) + "(?=\\s|$)"
                guard RX.test(p, t, ci: true) else { continue }
                let cut = RX.sub(p, t, " ", ci: true)
                if cut.trimmingCharacters(in: .whitespaces).isEmpty { break }
                t = cut; break
            }
        }
        t = RX.sub("^[\\s\\-–—,:·+]+|[\\s\\-–—,:·]+$", t, "").squeezed
        if !RX.test("\\p{L}{2}", t) { return original }
        return t.isEmpty ? original : t
    }
    /// cityMarker(): "-Roma", "→ Roma", "14:00 -Voss", "-Roma tbc" — a move, not a span ("-8 Antigone")
    static func cityMarker(_ title: String) -> String? {
        // a dash touches its city ("-Roma"); "- A. Name" is a list item, not a move (10.10)
        guard let g = RX.groups("^\\s*(?:\\d{1,2}[:.]\\d{2}\\s+)?(?:-+>\\s*|-+(?=\\S)|→\\s*|=>\\s*)([^,(]+?)\\s*(?:\\btbc\\b.*)?$", title, ci: true),
              !g[1].isEmpty, !RX.test("^\\d", g[1]) else { return nil }
        let name = RX.sub("\\b\\d{1,2}[:.]\\d{2}\\b", g[1], " ").squeezed
        return name.isEmpty ? nil : name
    }
    /// A SHOW READS AS ITS PRODUCTION AND NUMBER (Alan, 11.10: "would it be better if it said
    /// Vildanden 1 instead of Performance 1"): a bare "Performance 3" under a project span
    /// takes the span's name without its city — "Vildanden OSLO" → "Vildanden 3". The span
    /// is the one in the show's own calendar; with none, or two, the title stays as written.
    static func showTitle(_ e: CalEvent, spans: [CalEvent]) -> String? {
        let bare = stripParens(stripClock(e.title.deco))
        guard let g = RX.groups("^(.*?)\\s*(?:performance|forestilling|show|visning|vorstellung)\\s*(\\d+)$", bare, ci: true) else { return nil }
        // the title names it itself: "Vildanden Performance 3" → "Vildanden 3"
        let own = g[1].trimmingCharacters(in: CharacterSet(charactersIn: " -–—:·"))
        if !own.isEmpty && own.count <= 24 { return own + " " + g[2] }
        let mine = spans.filter { $0.calId == e.calId }
        let pool = mine.count == 1 ? mine : (mine.isEmpty && spans.count == 1 ? spans : [])
        guard let sp = pool.first else { return nil }
        var words = RX.sub("\\btbc\\b", sp.title.deco, " ", ci: true).squeezed.split(separator: " ").map(String.init)
        while words.count > 1, Places.placeOf(words.last!) != nil || Places.placeOf(words.last!.capitalized) != nil { words.removeLast() }
        let name = words.joined(separator: " ")
        guard !name.isEmpty, name.count <= 24 else { return nil }
        return name + " " + g[2]
    }

    static func lineTitle(_ e: CalEvent, covers: [String]) -> String {
        if let mark = cityMarker(e.title) { return "→ " + mark }
        if let r = Places.route(e.title) { return r }
        if Places.hasFlightWord(e.title) {
            let named = Places.placesIn(e.title)
            if named.count == 1 { return "→ " + Places.name(named[0]) }
        }
        return stripParens(wallTitle(stripClock(e.title.deco), covers: covers))
    }

    // the tour: the robot's words (SHORT, perfNo, legWords, capsCount, legCity, legName)
    static let short: [String: String] = [
        "travel": "Travel", "get in": "Get in", "work day": "Work", "day off": "Off",
        "travel day tech": "Travel tech", "travel day performers": "Travel perf",
        "get in – tech only": "Get in tech", "get in - tech only": "Get in tech",
    ]
    static func perfNo(_ t: String) -> String? { RX.groups("^Performance\\s+(\\d+)", t, ci: true)?[1] }
    static func legWords(_ leg: CalEvent) -> [String] {
        RX.sub("\\btbc\\b", leg.title.deco, " ", ci: true).squeezed.split(separator: " ").map(String.init)
    }
    static func capsCount(_ words: [String]) -> Int {
        let no = Locale(identifier: "nb_NO")
        func shout(_ w: String) -> Bool { w.count > 1 && w == w.uppercased(with: no) && RX.test("[A-ZÆØÅ]", w) }
        var n = 0
        while n < words.count && shout(words[n]) { n += 1 }
        return n
    }
    static func legCity(_ leg: CalEvent) -> String {
        let loc = leg.location.split(whereSeparator: { $0 == "\n" || $0 == "," }).first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
        if !loc.isEmpty { return loc }
        let w = legWords(leg), caps = capsCount(w)
        return caps > 0 && caps < w.count ? w[caps...].joined(separator: " ") : ""
    }
    static func legName(_ leg: CalEvent) -> String {
        if isHold(leg) { return "HOLD" }
        let w = legWords(leg), caps = capsCount(w)
        if caps > 0 { return w[0..<caps].joined(separator: " ") }
        let city = legCity(leg), t = w.joined(separator: " ")
        return (!city.isEmpty && t.hasSuffix(city) && t.count > city.count) ? String(t.dropLast(city.count)).trimmingCharacters(in: .whitespaces) : t
    }
}

// ---------- colour: his own, per event (DUSTY, 09.10) ----------

enum Palette {
    static let dusty: [String: String] = ["11": "#A8423A", "6": "#B35A22", "5": "#94740F", "10": "#467A38",
                                          "7": "#23716F", "9": "#2F5E9E", "3": "#6A4A9C", "4": "#B0407A"]
    static let order = ["11", "6", "5", "10", "7", "9", "3", "4"]
    static let names = ["11": "Rød", "6": "Oransje", "5": "Gul", "10": "Grønn", "7": "Petrol", "9": "Blå", "3": "Lilla", "4": "Rosa"]
}

// ---------- the month (laneSpans, whereOn, monthData) ----------

struct MonthRow: Identifiable {
    struct Lane { var color: String; var a: Bool; var z: Bool; var faint = false }   // faint: a weekend inside a run
    struct Part: Identifiable { var id: String; var kind: Kind; var time = ""; var text: String; var show = false; var pencil = false; var ink = ""; var color = ""
        enum Kind { case span, allday, timed } }
    struct Info { var kind: Kind; var text: String; var tbc = false
        enum Kind { case uke, cty, hn } }
    /// open = the name stands on this row (the fallback); start = the leg's first day
    struct Tour { var id: String; var name: String; var word: String; var perf: String; var city: String; var tbc: Bool; var open: Bool; var start: Bool
        var continues = false   // the leg began last month: the 1st names it, without its city
    }
    /// THE TOUR'S HEADING, on the free row above its band (Alan, 10.10: "above tour = good")
    struct Head { var id: String; var name: String; var city: String; var tbc: Bool }
    var id: String { date }
    var date: String
    var d: Int
    var wi: Int
    var week: Int
    var hol: String
    var red: Bool
    var sun: Bool
    var today: Bool
    var lanes: [Lane?]
    var parts: [Part]
    var info: Info?
    var tour: Tour?
    var head: Head? = nil
    var city: String
    var tbc: Bool              // the city is planned, not booked
    var show: Bool
}

struct Almanac {
    var events: [CalEvent]
    var calendars: [CalInfo]
    static let maxLanes = 4

    // which calendar is whose (robotCalIds, scheduleCalIds, ownEvents, tourEvents)
    var tourCalIds: Set<String> {
        Set(calendars.filter { RX.test("\\btouring\\b", $0.name, ci: true) && !RX.test("\\(test\\)", $0.name, ci: true) }.map(\.id))
    }
    var scheduleCalIds: Set<String> { Set(calendars.filter { RX.test("\\bschedule\\b", $0.name, ci: true) }.map(\.id)) }
    var own: [CalEvent] { let out = tourCalIds.union(scheduleCalIds); return events.filter { !out.contains($0.calId) } }
    var tour: [CalEvent] { let t = tourCalIds; return events.filter { t.contains($0.calId) && $0.time.isEmpty } }

    /// TIMES FOLLOW THE CITY HE IS IN THAT DAY (CONVENTIONS 16, Alan 10.10): a timed event
    /// shows at that city's clock — dinner in Asia reads 19:00 from anywhere, a call reads
    /// at the time where he takes it. A flight keeps its ticket time (his yes). No city, or
    /// an event with no zone of its own: its own clock, as before.
    func clock(_ e: CalEvent, cityZone: String?) -> String {
        let own = Rules.effTime(e)
        guard !e.time.isEmpty, !e.zone.isEmpty, let z = cityZone, z != e.zone, Places.dest(e.title) == nil,
              let from = TimeZone(identifier: e.zone), let to = TimeZone(identifier: z) else { return own }
        let p = e.time.split(separator: ":").compactMap { Int($0) }
        var c = Day.greg.dateComponents([.year, .month, .day], from: Day.date(e.start))
        c.hour = p.first; c.minute = p.count > 1 ? p[1] : 0
        var g = Calendar(identifier: .gregorian); g.timeZone = from
        guard let instant = g.date(from: c) else { return own }
        var h = Calendar(identifier: .gregorian); h.timeZone = to
        let t = h.dateComponents([.hour, .minute], from: instant)
        return String(format: "%02d:%02d", t.hour ?? 0, t.minute ?? 0)
    }
    /// a timed event's clock `after` minutes past its start, read in another zone — a
    /// flight's departure in its origin's time and arrival in its destination's, whatever
    /// zone the event was saved in (the Cairo flight was saved in Oslo time at both ends)
    func clock(_ e: CalEvent, plus after: Int, in zoneID: String) -> String? {
        guard !e.time.isEmpty, let from = TimeZone(identifier: e.zone.isEmpty ? "Europe/Oslo" : e.zone),
              let to = TimeZone(identifier: zoneID) else { return nil }
        let p = e.time.split(separator: ":").compactMap { Int($0) }
        var c = Day.greg.dateComponents([.year, .month, .day], from: Day.date(e.start))
        c.hour = p.first; c.minute = p.count > 1 ? p[1] : 0
        var g = Calendar(identifier: .gregorian); g.timeZone = from
        guard let start = g.date(from: c) else { return nil }
        var h = Calendar(identifier: .gregorian); h.timeZone = to
        let t = h.dateComponents([.hour, .minute], from: start.addingTimeInterval(TimeInterval(after * 60)))
        return String(format: "%02d:%02d", t.hour ?? 0, t.minute ?? 0)
    }

    /// A PLAN A BOOKING HAS TAKEN OVER (Alan, 11.10: "would be great if the app just took
    /// care of it"): a pencilled or tbc move on a day that also holds a booked flight or move.
    /// The app steps it aside — off the month and the week, out of the city reckoning — and
    /// the day sheet offers to remove it. Nothing is deleted on its own.
    var replacedPlans: Set<String> {
        let marked = events.filter { !$0.fromGmail && (Rules.cityMarker($0.title) != nil || Places.dest($0.title) != nil) }
        let plans = marked.filter { Rules.isTbc($0) || Rules.isPencil($0) }
        let booked = Set(marked.filter { !(Rules.isTbc($0) || Rules.isPencil($0)) }.map(\.start))
        return Set(plans.filter { booked.contains($0.start) }.map(\.id))
    }

    /// the zone of the city he is in on a day, if the almanac knows it
    func zoneOn(_ ds: String, moves mv: [(date: String, time: String, dest: String, tbc: Bool)]) -> String? {
        whereOn(ds, moves: mv, legs: []).flatMap { Places.zones[$0.name] }
    }

    func calColor(_ e: CalEvent) -> String { calendars.first { $0.id == e.calId }?.color ?? "#26241f" }
    func color(_ e: CalEvent) -> String { Palette.dusty[e.colorId] ?? calColor(e) }
    /// the ink a title takes: red for a show, else only a colour he chose himself
    func ink(_ e: CalEvent) -> String { Rules.isShow(e) ? "red" : (Palette.dusty[e.colorId] ?? "") }

    /// HIS FLIGHTS AND MOVES (buildFlightIndex): from every calendar, never one Gmail
    /// scraped (a cc'd itinerary is often someone else's). Date first; within a day a
    /// booking outranks a plan (tbc or pencilled), then by time, so the winner sorts last.
    func moves() -> [(date: String, time: String, dest: String, tbc: Bool)] {
        let stale = replacedPlans
        return events.compactMap { e -> (date: String, time: String, dest: String, tbc: Bool)? in
            if e.fromGmail || stale.contains(e.id) { return nil }
            guard let d = Rules.cityMarker(e.title) ?? Places.dest(e.title) else { return nil }
            return (e.start, e.time.isEmpty ? "99" : e.time, Places.name(d), Rules.isTbc(e) || Rules.isPencil(e))
        }
        .sorted { a, b in
            if a.date != b.date { return a.date < b.date }
            if a.tbc != b.tbc { return a.tbc }
            return a.time < b.time
        }
    }
    func whereOn(_ ds: String, moves: [(date: String, time: String, dest: String, tbc: Bool)], legs: [CalEvent]) -> (name: String, tbc: Bool)? {
        // HIS CITY FOLLOWS ONLY HIS OWN TRAVEL (Alan, 10.10): a tour he does not join must
        // not move him to Roma. The tour's city stands in its band; his flights and moves
        // say where he is.
        _ = legs
        return moves.last { $0.date <= ds }.map { ($0.dest, $0.tbc) }
    }

    func month(_ y: Int, _ m: Int) -> (rows: [MonthRow], nLanes: Int) {
        let n = Day.daysInMonth(y, m), first = Day.key(y, m, 1), last = Day.key(y, m, n)
        let hol = Holidays.of(y), today = Day.today
        // laneSpans: his spans, each given a lane for the month. LONGEST ON THE LEFT
        // (Alan, 10.10: "they look so good when you do the longest to the left and the
        // shortest to the right"): the long runs take the inner lanes first, so a season
        // reads as one straight line and the short ones step out beside it.
        var gapDays: [String: Set<String>] = [:]
        func length(_ e: CalEvent) -> Int { Day.greg.dateComponents([.day], from: Day.date(e.start), to: Day.date(e.end)).day ?? 0 }
        var spans = Almanac.runs(own.filter { $0.isSpan && $0.start <= last && $0.end >= first }, gaps: &gapDays)
            .sorted { length($0) != length($1) ? length($0) > length($1) : $0.start < $1.start }
        var laneOf: [String: Int] = [:], inLane: [[CalEvent]] = []
        for s in spans {
            var l = 0
            while l < Almanac.maxLanes && l < inLane.count && inLane[l].contains(where: { $0.start <= s.end && $0.end >= s.start }) { l += 1 }
            if l >= Almanac.maxLanes { laneOf[s.id] = -1; continue }
            if l == inLane.count { inLane.append([s]) } else { inLane[l].append(s) }
            laneOf[s.id] = l
        }
        let laneEnd = inLane
        spans.sort { $0.start != $1.start ? $0.start < $1.start : $0.end > $1.end }
        spans = spans.filter { (laneOf[$0.id] ?? -1) >= 0 }
        let nLanes = min(Almanac.maxLanes, laneEnd.count)
        let stale = replacedPlans
        let ownDays = own.filter { !$0.isSpan && $0.start >= first && $0.start <= last && !stale.contains($0.id) }
        let legs = tour.filter(\.isSpan).sorted { $0.start > $1.start }      // innermost first
        let words = tour.filter { !$0.isSpan }
        let mv = moves()
        var rows: [MonthRow] = []
        var shownCity: String? = nil
        // EACH TAKEN ROW SENDS THE NEXT ITEM ONE ROW DOWN (Alan, 10.10): a Monday holding a
        // holiday or a tour heading gives the week number to Tuesday, and the weekly city
        // then stands on Wednesday
        var mondayYielded = false, cityLate = false
        for d in 1...n {
            let ds = Day.key(y, m, d), wi = Day.weekdayIdx(ds), h = hol[ds]
            let leg = legs.first { $0.start <= ds && $0.end >= ds }
            let covering = spans.filter { $0.start <= ds && $0.end >= ds }
            let dayOwn = ownDays.filter { $0.start == ds }
            let word = leg == nil ? nil : words.first { $0.start == ds }
            let perf = word.flatMap { Rules.perfNo($0.title) }
            let names = covering.map(\.title)
            let lanes: [MonthRow.Lane?] = (0..<nLanes).map { l in
                covering.first { laneOf[$0.id] == l }.map { MonthRow.Lane(color: color($0), a: $0.start == ds, z: $0.end == ds,
                                                                           faint: gapDays[$0.id]?.contains(ds) ?? false) }
            }
            var parts: [MonthRow.Part] = []
            for sp in spans where sp.start == ds || (d == 1 && sp.start < ds && sp.end >= ds) {
                parts.append(.init(id: sp.id, kind: .span, text: Rules.stripParens(sp.title.deco), pencil: Rules.isPencil(sp), ink: ink(sp)))
            }
            let allday = dayOwn.filter { Rules.effTime($0).isEmpty }
            let here0 = whereOn(ds, moves: mv, legs: legs)
            let dz = here0.flatMap { Places.zones[$0.name] }
            let timed = Places.joinJourneys(dayOwn.filter { !Rules.effTime($0).isEmpty }.sorted { clock($0, cityZone: dz) < clock($1, cityZone: dz) })
            for e in allday {
                parts.append(.init(id: e.id, kind: .allday, text: Rules.showTitle(e, spans: covering) ?? Rules.lineTitle(e, covers: names), show: Rules.isShow(e),
                                   pencil: Rules.isPencil(e) || Rules.isTbc(e), ink: ink(e), color: color(e)))
            }
            var lastShowName: String? = nil
            for e in timed {
                var text = Rules.showTitle(e, spans: covering) ?? Rules.lineTitle(e, covers: names)
                // a second show of the same production that day keeps only its number
                if let st = Rules.showTitle(e, spans: covering), let sp = st.lastIndex(of: " ") {
                    let name = String(st[..<sp])
                    if name == lastShowName { text = String(st[st.index(after: sp)...]) }
                    lastShowName = name
                }
                parts.append(.init(id: e.id, kind: .timed, time: clock(e, cityZone: dz), text: text, show: Rules.isShow(e),
                                   pencil: Rules.isPencil(e) || Rules.isTbc(e), ink: ink(e), color: color(e)))
            }
            let here = whereOn(ds, moves: mv, legs: legs)
            let next = Day.add(ds, 1)
            let headLeg = (leg == nil && d < n) ? legs.first { $0.start == next } : nil
            if wi == 0 { mondayYielded = false; cityLate = false }
            var info: MonthRow.Info? = nil
            if let h = h {
                info = .init(kind: .hn, text: h.name)
                if wi == 0 { mondayYielded = true }
            } else if wi == 0 && headLeg != nil {
                mondayYielded = true                     // the heading has the whole row
            } else if wi == 0 || (wi == 1 && mondayYielded) {
                info = .init(kind: .uke, text: T("uke", "week") + " \(Day.isoWeek(ds))")
                if wi == 1 { cityLate = true }
            } else if let c = here?.name, c != shownCity || (wi == 1 && !cityLate) || (wi == 2 && cityLate) || d == 1 {
                info = .init(kind: .cty, text: c, tbc: here!.tbc); shownCity = c
            }
            // The name and city go ABOVE the band, on the day before it starts, whenever that
            // row is free of tours and in this month; then every tour day keeps its word.
            // Otherwise (a leg on the 1st, or right after another) the name takes the first row.
            let prevFree = d > 1 && !legs.contains { $0.start <= Day.add(ds, -1) && $0.end >= Day.add(ds, -1) }
            let tourRow = leg.map { leg -> MonthRow.Tour in
                let w = word.map { Rules.short[$0.title.deco.trimmingCharacters(in: .whitespaces).lowercased()] ?? $0.title.deco } ?? ""
                let first = leg.start == ds
                return .init(id: leg.id, name: Rules.legName(leg), word: perf == nil ? w : "", perf: perf ?? "",
                             city: Rules.legCity(leg), tbc: Rules.isTbc(leg), open: (first && !prevFree) || d == 1, start: first || d == 1,
                             continues: d == 1 && leg.start < ds)
            }
            let head = headLeg.map { MonthRow.Head(id: $0.id, name: Rules.legName($0), city: Rules.legCity($0), tbc: Rules.isTbc($0)) }
            rows.append(MonthRow(date: ds, d: d, wi: wi, week: Day.isoWeek(ds), hol: h?.name ?? "", red: wi == 6 || (h?.red ?? false),
                                 sun: wi == 6, today: ds == today, lanes: lanes, parts: parts, info: info, tour: tourRow, head: head,
                                 city: here?.name ?? "", tbc: here?.tbc ?? false, show: dayOwn.contains(where: Rules.isShow) || perf != nil))
        }
        return (rows, nLanes)
    }

    // ---------- the week (renderWeek): the schedule page ----------

    struct WeekDay: Identifiable {
        struct Line: Identifiable { var id: String; var time: String; var text: String; var color: String; var ink: String; var show: Bool; var pencil: Bool; var note: Bool }
        var id: String { date }
        var date: String; var d: Int; var wi: Int
        var hol: String; var red: Bool; var sun: Bool; var today: Bool; var show: Bool
        var ctx: String; var ctxKind: String          // tour · perf · hn · '' ; tbc in ctxTbc
        var ctxTbc: Bool
        var lines: [Line]
        var spanOn: [Bool]                            // per span of the week: does it cover this day
    }
    struct WeekSpan: Identifiable { var id: String; var title: String; var color: String; var start: String; var end: String; var pencil: Bool }

    /// a week from its Monday: up to three of his spans on top, then seven days. The day's
    /// single things are his and the schedule's (wg | Schedule lives here, D1) — never the
    /// tour's words, which stand in the day's head instead.
    func week(_ mon: String) -> (spans: [WeekSpan], days: [WeekDay]) {
        let keys = (0..<7).map { Day.add(mon, $0) }
        let first = keys[0], last = keys[6], today = Day.today
        let tourIds = tourCalIds
        let legs = tour.filter(\.isSpan).sorted { $0.start > $1.start }
        let words = tour.filter { !$0.isSpan }
        let spans = own.filter { $0.isSpan && $0.start <= last && $0.end >= first }.sorted { $0.start < $1.start }.prefix(3)
        let stale = replacedPlans
        let singles = events.filter { !$0.isSpan && $0.start >= first && $0.start <= last && !tourIds.contains($0.calId) && !stale.contains($0.id) }
        let mv = moves()
        let wspans = spans.map { WeekSpan(id: $0.id, title: Rules.stripParens($0.title.deco), color: color($0), start: $0.start, end: $0.end, pencil: Rules.isPencil($0)) }
        let days = keys.map { ds -> WeekDay in
            let wi = Day.weekdayIdx(ds), h = Holidays.of(Int(ds.prefix(4))!)[ds]
            let leg = legs.first { $0.start <= ds && $0.end >= ds }
            let word = leg == nil ? nil : words.first { $0.start == ds }
            let perf = word.flatMap { Rules.perfNo($0.title) }
            let dayEv = singles.filter { $0.start == ds }
            let names = spans.filter { $0.start <= ds && $0.end >= ds }.map(\.title)
            let allday = dayEv.filter { Rules.effTime($0).isEmpty }
            let dz = zoneOn(ds, moves: mv)
            let timed = Places.joinJourneys(dayEv.filter { !Rules.effTime($0).isEmpty }.sorted { clock($0, cityZone: dz) < clock($1, cityZone: dz) })
            func line(_ e: CalEvent) -> WeekDay.Line {
                let t = clock(e, cityZone: dz)
                let covering = spans.filter { $0.start <= ds && $0.end >= ds }
                let text = Rules.showTitle(e, spans: Array(covering))
                    ?? (t.isEmpty ? Rules.lineTitle(e, covers: names) : Rules.stripClock(Rules.wallTitle(e.title.deco, covers: names)))
                return .init(id: e.id, time: t, text: text, color: color(e), ink: ink(e), show: Rules.isShow(e),
                             pencil: Rules.isPencil(e) || Rules.isTbc(e), note: !RX.sub("^P[ \\t]*(?:\\r?\\n(?:[ \\t]*\\r?\\n)?|$)", e.notes, "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            var ctx = "", kind = "", tbc = false
            if let leg {
                let w = perf.map { Rules.legName(leg) + " " + $0 }
                    ?? word.map { Rules.short[$0.title.deco.trimmingCharacters(in: .whitespaces).lowercased()] ?? $0.title.deco }
                    ?? Rules.legName(leg)
                let city = Rules.legCity(leg)
                ctx = w + (city.isEmpty ? "" : " · " + city); kind = perf == nil ? "tour" : "perf"; tbc = Rules.isTbc(leg)
            } else if let h { ctx = h.name; kind = "hn" }
            return WeekDay(date: ds, d: Int(ds.suffix(2))!, wi: wi, hol: h?.name ?? "", red: wi == 6 || (h?.red ?? false), sun: wi == 6,
                           today: ds == today, show: perf != nil || dayEv.contains(where: Rules.isShow), ctx: ctx, ctxKind: kind, ctxTbc: tbc,
                           lines: allday.map(line) + timed.map(line), spanOn: spans.map { $0.start <= ds && $0.end >= ds })
        }
        return (Array(wspans), days)
    }

    /// A PROJECT WITH ITS WEEKENDS OFF IS ONE RUN (Alan, 10.10: nine weeks entered without
    /// Saturdays and Sundays drew "choppy" lines, so a year ahead did not show it ran two
    /// months). Pieces with the same title and calendar, apart only by a weekend, become one
    /// span; the weekend days are noted so the line can be drawn faint there.
    static func runs(_ spans: [CalEvent], gaps: inout [String: Set<String>]) -> [CalEvent] {
        var out: [CalEvent] = []
        let groups = Dictionary(grouping: spans) { $0.calId + "\u{1}" + $0.title.deco.lowercased().squeezed }
        for (_, pieces) in groups {
            var run: CalEvent? = nil
            var gap: Set<String> = []
            for p in pieces.sorted(by: { $0.start < $1.start }) {
                if var r = run {
                    // the days between this piece and the last: all Saturday or Sunday?
                    var between: [String] = []
                    var k = Day.add(r.end, 1)
                    while k < p.start && between.count < 4 { between.append(k); k = Day.add(k, 1) }
                    if k == p.start && !between.isEmpty && between.allSatisfy({ Day.weekdayIdx($0) >= 5 }) {
                        r.end = max(r.end, p.end); gap.formUnion(between); run = r; continue
                    }
                    if !gap.isEmpty { gaps[r.id] = gap }
                    out.append(r)
                }
                run = p; gap = []
            }
            if let r = run { if !gap.isEmpty { gaps[r.id] = gap }; out.append(r) }
        }
        return out
    }

    /// the Monday of the week holding a day
    static func monday(_ ds: String) -> String { Day.add(ds, -Day.weekdayIdx(ds)) }

    /// the day sheet's list: spans, then all-day, then timed (openDay)
    func day(_ ds: String) -> [CalEvent] {
        let all = events.filter { $0.start <= ds && $0.end >= ds && !scheduleCalIds.contains($0.calId) }
        let t = tourCalIds
        func tourLast(_ a: CalEvent, _ b: CalEvent) -> Bool { (t.contains(a.calId) ? 1 : 0) < (t.contains(b.calId) ? 1 : 0) }
        let spans = all.filter(\.isSpan).sorted(by: tourLast)
        let allday = all.filter { !$0.isSpan && Rules.effTime($0).isEmpty }.sorted(by: tourLast)
        let timed = all.filter { !$0.isSpan && !Rules.effTime($0).isEmpty }.sorted { Rules.effTime($0) < Rules.effTime($1) }
        return spans + allday + timed
    }
}
