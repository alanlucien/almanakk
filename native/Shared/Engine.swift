// THE ALMANAC'S RULES, IN SWIFT — the native app's engine (Alan, 09.10: the full app,
// iPhone first). A faithful port of v3/app.js: the same holidays, the same reading of a
// title, the same month rows. Where the two disagree, the web version is the reference
// until the app has caught up; every function names the one it ports.
//
// Not ported yet (stage 1b): the flight parser and the airport table. The city column
// reads tour legs and "-Roma" moves only.
import Foundation

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
    /// deco(): Google sometimes hands titles back with HTML entities
    var deco: String {
        var s = self
        for (k, v) in ["&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#039;": "'", "&apos;": "'", "&nbsp;": " "] {
            s = s.replacingOccurrences(of: k, with: v)
        }
        return s
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
        if let c = cache[y] { return c }
        var map: [String: Holiday] = [:]
        func put(_ k: String, _ name: String, _ red: Bool = false) { map[k] = Holiday(name: name, red: red) }
        let E = easter(y)
        put(Day.key(y, 0, 1), "1. Nyttårsdag", true)
        put(Day.add(E, -7), "Palmesøndag", true)
        put(Day.add(E, -3), "Skjærtorsdag", true)
        put(Day.add(E, -2), "Langfredag", true)
        put(Day.add(E, -1), "Påskeaften")
        put(E, "1. Påskedag", true)
        put(Day.add(E, 1), "2. Påskedag", true)
        put(Day.key(y, 4, 1), "1. mai", true)
        put(Day.key(y, 4, 17), "17. mai", true)
        put(Day.add(E, 39), "Kr. himmelfart", true)
        put(Day.add(E, 49), "1. Pinsedag", true)
        put(Day.add(E, 50), "2. Pinsedag", true)
        put(Day.key(y, 5, 23), "St.Hansaften")
        let dec24 = Day.key(y, 11, 24)
        let advent4 = Day.add(dec24, -((Day.weekdayIdx(dec24) + 1) % 7))   // the Sunday on or before the 24th
        for n in 1...4 { put(Day.add(advent4, (n - 4) * 7), "\(n). advent") }
        put(dec24, "Julaften")
        put(Day.key(y, 11, 25), "1. Juledag", true)
        put(Day.key(y, 11, 26), "2. Juledag", true)
        put(Day.key(y, 11, 31), "Nyttårsaften")
        cache[y] = map
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
        guard let g = RX.groups("^\\s*(?:\\d{1,2}[:.]\\d{2}\\s+)?(?:-+\\s*>?|→|=>)\\s*([^,(]+?)\\s*(?:\\btbc\\b.*)?$", title, ci: true),
              !g[1].isEmpty, !RX.test("^\\d", g[1]) else { return nil }
        let name = RX.sub("\\b\\d{1,2}[:.]\\d{2}\\b", g[1], " ").squeezed
        return name.isEmpty ? nil : name
    }
    static func lineTitle(_ e: CalEvent, covers: [String]) -> String {
        if let mark = cityMarker(e.title) { return "→ " + mark }
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
    struct Lane { var color: String; var a: Bool; var z: Bool }
    struct Part: Identifiable { var id: String; var kind: Kind; var time = ""; var text: String; var show = false; var pencil = false; var ink = ""; var color = ""
        enum Kind { case span, allday, timed } }
    struct Info { var kind: Kind; var text: String; var tbc = false
        enum Kind { case uke, cty, hn } }
    struct Tour { var id: String; var name: String; var word: String; var perf: String; var city: String; var tbc: Bool; var open: Bool }
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
    var city: String
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

    func calColor(_ e: CalEvent) -> String { calendars.first { $0.id == e.calId }?.color ?? "#26241f" }
    func color(_ e: CalEvent) -> String { Palette.dusty[e.colorId] ?? calColor(e) }
    /// the ink a title takes: red for a show, else only a colour he chose himself
    func ink(_ e: CalEvent) -> String { Rules.isShow(e) ? "red" : (Palette.dusty[e.colorId] ?? "") }

    /// the moves he typed ("-Roma"), date first; a booked flight will join these in stage 1b
    func moves() -> [(date: String, time: String, dest: String, tbc: Bool)] {
        own.compactMap { e in Rules.cityMarker(e.title).map { (e.start, Rules.effTime(e).isEmpty ? "99" : Rules.effTime(e), $0, Rules.isTbc(e)) } }
            .sorted { ($0.date, $0.time) < ($1.date, $1.time) }
    }
    func whereOn(_ ds: String, moves: [(date: String, time: String, dest: String, tbc: Bool)], legs: [CalEvent]) -> (name: String, tbc: Bool)? {
        let last = moves.last { $0.date <= ds }
        if let l = last, l.date == ds { return (l.dest, l.tbc) }
        if let leg = legs.first(where: { $0.start <= ds && $0.end >= ds && !Rules.isHold($0) && !Rules.legCity($0).isEmpty }) {
            return (Rules.legCity(leg), Rules.isTbc(leg))
        }
        return last.map { ($0.dest, $0.tbc) }
    }

    func month(_ y: Int, _ m: Int) -> (rows: [MonthRow], nLanes: Int) {
        let n = Day.daysInMonth(y, m), first = Day.key(y, m, 1), last = Day.key(y, m, n)
        let hol = Holidays.of(y), today = Day.today
        // laneSpans: his spans, each given a lane for the month
        var spans = own.filter { $0.isSpan && $0.start <= last && $0.end >= first }
            .sorted { $0.start != $1.start ? $0.start < $1.start : $0.end > $1.end }
        var laneOf: [String: Int] = [:], laneEnd: [String] = []
        for s in spans {
            var l = 0
            while l < Almanac.maxLanes && l < laneEnd.count && laneEnd[l] >= s.start { l += 1 }
            if l >= Almanac.maxLanes { laneOf[s.id] = -1; continue }
            if l == laneEnd.count { laneEnd.append(s.end) } else { laneEnd[l] = s.end }
            laneOf[s.id] = l
        }
        spans = spans.filter { (laneOf[$0.id] ?? -1) >= 0 }
        let nLanes = min(Almanac.maxLanes, laneEnd.count)
        let ownDays = own.filter { !$0.isSpan && $0.start >= first && $0.start <= last }
        let legs = tour.filter(\.isSpan).sorted { $0.start > $1.start }      // innermost first
        let words = tour.filter { !$0.isSpan }
        let mv = moves()
        var rows: [MonthRow] = []
        var shownCity: String? = nil, ukeOn: String? = nil
        for d in 1...n {
            let ds = Day.key(y, m, d), wi = Day.weekdayIdx(ds), h = hol[ds]
            let leg = legs.first { $0.start <= ds && $0.end >= ds }
            let covering = spans.filter { $0.start <= ds && $0.end >= ds }
            let dayOwn = ownDays.filter { $0.start == ds }
            let word = leg == nil ? nil : words.first { $0.start == ds }
            let perf = word.flatMap { Rules.perfNo($0.title) }
            let names = covering.map(\.title)
            let lanes: [MonthRow.Lane?] = (0..<nLanes).map { l in
                covering.first { laneOf[$0.id] == l }.map { MonthRow.Lane(color: color($0), a: $0.start == ds, z: $0.end == ds) }
            }
            var parts: [MonthRow.Part] = []
            for sp in spans where sp.start == ds || (d == 1 && sp.start < ds && sp.end >= ds) {
                parts.append(.init(id: sp.id, kind: .span, text: Rules.stripParens(sp.title.deco), pencil: Rules.isPencil(sp), ink: ink(sp)))
            }
            let allday = dayOwn.filter { Rules.effTime($0).isEmpty }
            let timed = dayOwn.filter { !Rules.effTime($0).isEmpty }.sorted { Rules.effTime($0) < Rules.effTime($1) }
            for e in allday {
                parts.append(.init(id: e.id, kind: .allday, text: Rules.lineTitle(e, covers: names), show: Rules.isShow(e),
                                   pencil: Rules.isPencil(e) || Rules.isTbc(e), ink: ink(e), color: color(e)))
            }
            for e in timed {
                parts.append(.init(id: e.id, kind: .timed, time: Rules.effTime(e), text: Rules.lineTitle(e, covers: names), show: Rules.isShow(e),
                                   pencil: Rules.isPencil(e) || Rules.isTbc(e), ink: ink(e), color: color(e)))
            }
            let here = whereOn(ds, moves: mv, legs: legs)
            var info: MonthRow.Info? = nil
            if let h = h { info = .init(kind: .hn, text: h.name) }
            else if wi == 0 || (ukeOn == nil && wi == 1 && hol[Day.add(ds, -1)] != nil) {
                info = .init(kind: .uke, text: "uke \(Day.isoWeek(ds))"); ukeOn = ds
            } else if let c = here?.name, c != shownCity || wi == 1 || d == 1 {
                info = .init(kind: .cty, text: c, tbc: here!.tbc); shownCity = c
            }
            let tourRow = leg.map { leg -> MonthRow.Tour in
                let w = word.map { Rules.short[$0.title.deco.trimmingCharacters(in: .whitespaces).lowercased()] ?? $0.title.deco } ?? ""
                return .init(id: leg.id, name: Rules.legName(leg), word: perf == nil ? w : "", perf: perf ?? "",
                             city: Rules.legCity(leg), tbc: Rules.isTbc(leg), open: leg.start == ds || d == 1)
            }
            rows.append(MonthRow(date: ds, d: d, wi: wi, week: Day.isoWeek(ds), hol: h?.name ?? "", red: wi == 6 || (h?.red ?? false),
                                 sun: wi == 6, today: ds == today, lanes: lanes, parts: parts, info: info, tour: tourRow,
                                 city: here?.name ?? "", show: dayOwn.contains(where: Rules.isShow) || perf != nil))
        }
        return (rows, nLanes)
    }

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
