// WRITING (stage 3 of the native app, 10.10.2026): an event as the form holds it, the
// quick-add line that reads what he types, and Google's form of the same event.
// The rules are his (CONVENTIONS.md 1, 3, 9, 16): bare numbers are days, a time carries a
// colon, "kl" or am/pm; pencilled is a "?" ending the title; a new event's clock is the
// time of the city he will be in that day.
import Foundation

struct Draft: Identifiable, Equatable {
    var id = UUID().uuidString
    var title = ""
    var start: String            // YYYY-MM-DD
    var end: String              // inclusive last day
    var allDay = true
    var time = ""                // HH:MM
    var endTime = ""
    var zone = TimeZone.current.identifier
    var location = ""
    var notes = ""
    var calId = ""
    var colorId = ""
    var pencil = false

    init(day: String) { start = day; end = day }

    /// an event, ready to edit: its pencil "?" lifted off the title into the switch
    init(_ e: CalEvent, zone z: String) {
        start = e.start; end = e.end
        let t = e.title.deco
        pencil = Rules.isPencil(e)
        title = RX.sub("\\s*\\?\\s*$", t, "")
        allDay = e.time.isEmpty
        time = e.time; endTime = e.endTime; zone = z
        location = e.location.deco
        notes = RX.sub("^P[ \\t]*(?:\\r?\\n(?:[ \\t]*\\r?\\n)?|$)", e.notes, "")
        calId = e.calId; colorId = e.colorId
    }

    var finalTitle: String {
        let t = RX.sub("\\s*\\?\\s*$", title.trimmingCharacters(in: .whitespaces), "")
        return pencil ? t + "?" : t
    }

    /// the reading shown under the add line before saving
    var reading: String {
        let months = englishUI ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                               : ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"]
        func day(_ k: String) -> String { "\(Int(k.suffix(2))!). \(months[Int(k.dropFirst(5).prefix(2))! - 1])" }
        if allDay {
            return (end > start ? "\(Int(start.suffix(2))!).–\(day(end))" : day(start)) + T(" · heldag", " · all day")
        }
        return day(start) + " · " + time + (endTime.isEmpty || endTime == time ? "" : "–" + endTime)
    }

    /// Google's event. A change from timed to all-day must clear the clock explicitly
    /// (CLAUDE.md E4: "must explicitly null dateTime when converting").
    func googleBody() -> [String: Any] {
        var b: [String: Any] = ["summary": finalTitle, "location": location, "description": notes]
        b["colorId"] = colorId.isEmpty ? NSNull() : colorId
        if allDay {
            b["start"] = ["date": start, "dateTime": NSNull(), "timeZone": NSNull()]
            b["end"] = ["date": Day.add(end, 1), "dateTime": NSNull(), "timeZone": NSNull()]
        } else {
            let endClock = endTime.isEmpty ? Draft.plusHour(time) : endTime
            let endDay = endClock < time ? Day.add(start, 1) : start      // past midnight: the next day
            b["start"] = ["dateTime": "\(start)T\(time):00", "timeZone": zone, "date": NSNull()]
            b["end"] = ["dateTime": "\(endDay)T\(endClock):00", "timeZone": zone, "date": NSNull()]
        }
        return b
    }
    static func plusHour(_ t: String) -> String {
        let p = t.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2 else { return t }
        return String(format: "%02d:%02d", (p[0] + 1) % 24, p[1])
    }
}

// ---------- the add line ----------

enum QuickAdd {
    /// What he typed on a day, read by his rules. `alt` is the other reading of bare
    /// numbers ("8-12" as 08:00–12:00 instead of the 8th to the 12th), one tap away.
    static func read(_ raw: String, day: String, zone: String, alt: Bool = false) -> Draft? {
        var text = raw.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }
        var d = Draft(day: day)
        d.zone = zone
        // "-Oslo" is saved as "→ Oslo", so it reads as a move in Google too (arrowForm)
        if let city = Rules.cityMarker(text), RX.test("^\\s*(?:\\d{1,2}[:.]\\d{2}\\s+)?-+(?!>)", text) {
            text = RX.sub("^(\\s*(?:\\d{1,2}[:.]\\d{2}\\s+)?)-+\\s*", text, "$1→ ")
            _ = city
        }
        // pencilled: a "?" ending what he typed
        if RX.test("\\?\\s*$", text) { d.pencil = true; text = RX.sub("\\s*\\?\\s*$", text, "") }

        // 1. a time with its marker: "kl 8-12", "8:00-12:00", "8am-12", "8-12pm", "19:00", "7pm"
        let timeRE = "^(?:(kl\\.?)\\s*)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?(?:\\s*[-–]\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?)?\\s+(.+)$"
        if let g = RX.groups(timeRE, text, ci: true) {
            let kl = !g[1].isEmpty, colon = !g[3].isEmpty || !g[6].isEmpty, ampm = !g[4].isEmpty || !g[7].isEmpty
            let bareRange = !kl && !colon && !ampm && !g[5].isEmpty
            if kl || colon || ampm || (bareRange && alt) {
                guard let (t1, t2) = clocks(g[2], g[3], g[4], g[5], g[6], g[7]) else { return nil }
                d.allDay = false; d.time = t1; d.endTime = t2; d.title = g[8]
                return d
            }
        }
        // 2. bare numbers are DAYS: "8-12 Prøver" = the 8th to the 12th; "25-1" rolls over
        if let g = RX.groups("^(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+(.+)$", text) {
            let y = Int(day.prefix(4))!, m = Int(day.dropFirst(5).prefix(2))! - 1
            let a = Int(g[1])!, b = Int(g[2])!
            if a >= 1, a <= Day.daysInMonth(y, m), b >= 1 {
                d.start = Day.key(y, m, a)
                if b >= a, b <= Day.daysInMonth(y, m) { d.end = Day.key(y, m, b) }
                else {
                    let ny = m == 11 ? y + 1 : y, nm = (m + 1) % 12
                    guard b < a, b <= Day.daysInMonth(ny, nm) else { d.title = text; return d }
                    d.end = Day.key(ny, nm, b)
                }
                d.title = g[3]
                return d
            }
        }
        // 3. a clock anywhere in the line ("Middag 19:30"): timed, the clock lifted out
        if let g = RX.groups("\\b([01]?\\d|2[0-3])[:.]([0-5]\\d)\\b", text) {
            d.allDay = false
            d.time = String(format: "%02d:%@", Int(g[1])!, g[2])
            d.title = RX.sub("\\s*\\b([01]?\\d|2[0-3])[:.]([0-5]\\d)\\b\\s*", text, " ").squeezed
            if d.title.isEmpty { d.title = text }
            return d
        }
        d.title = text
        return d
    }

    /// "2-5pm" = 14:00–17:00: a trailing pm also covers the start when that keeps the
    /// start first; "8-12pm" = 08:00–12:00, since 12pm is noon (Alan, 10.10)
    static func clocks(_ h1: String, _ m1: String, _ ap1: String, _ h2: String, _ m2: String, _ ap2: String) -> (String, String)? {
        func h24(_ h: Int, _ ap: String) -> Int {
            switch ap.lowercased() { case "pm": return h == 12 ? 12 : h + 12; case "am": return h == 12 ? 0 : h; default: return h }
        }
        guard let a = Int(h1) else { return nil }
        let ma = Int(m1) ?? 0
        if h2.isEmpty {
            let s = h24(a, ap1)
            guard s < 24, ma < 60 else { return nil }
            return (String(format: "%02d:%02d", s, ma), "")
        }
        guard let b = Int(h2) else { return nil }
        let mb = Int(m2) ?? 0
        let e = h24(b, ap2)
        var s = h24(a, ap1)
        if ap1.isEmpty && ap2.lowercased() == "pm" && a < 12 && a + 12 <= e { s = a + 12 }
        guard s < 24, e < 24, ma < 60, mb < 60 else { return nil }
        return (String(format: "%02d:%02d", s, ma), String(format: "%02d:%02d", e, mb))
    }
}

// ---------- the time zone of a city (CONVENTIONS.md 16) ----------

extension Places {
    /// the cities the almanac knows, by the calendar's spelling -> their zone
    static let zones: [String: String] = [
        "Oslo": "Europe/Oslo", "Bergen": "Europe/Oslo", "Trondheim": "Europe/Oslo", "Stavanger": "Europe/Oslo", "Kristiansand": "Europe/Oslo",
        "Tromsø": "Europe/Oslo", "Ålesund": "Europe/Oslo", "Bodø": "Europe/Oslo", "Lillehammer": "Europe/Oslo", "Voss": "Europe/Oslo",
        "København": "Europe/Copenhagen", "Aarhus": "Europe/Copenhagen", "Odense": "Europe/Copenhagen", "Stockholm": "Europe/Stockholm",
        "Göteborg": "Europe/Stockholm", "Malmö": "Europe/Stockholm", "Helsinki": "Europe/Helsinki", "Reykjavík": "Atlantic/Reykjavik",
        "London": "Europe/London", "Manchester": "Europe/London", "Edinburgh": "Europe/London", "Dublin": "Europe/Dublin",
        "Paris": "Europe/Paris", "Marseille": "Europe/Paris", "Nice": "Europe/Paris", "Lyon": "Europe/Paris", "Toulouse": "Europe/Paris",
        "Avignon": "Europe/Paris", "Strasbourg": "Europe/Paris", "Amsterdam": "Europe/Amsterdam", "Rotterdam": "Europe/Amsterdam",
        "Brussel": "Europe/Brussels", "Antwerpen": "Europe/Brussels", "Gent": "Europe/Brussels",
        "Berlin": "Europe/Berlin", "Frankfurt": "Europe/Berlin", "München": "Europe/Berlin", "Hamburg": "Europe/Berlin", "Köln": "Europe/Berlin",
        "Düsseldorf": "Europe/Berlin", "Stuttgart": "Europe/Berlin", "Wuppertal": "Europe/Berlin", "Mainz": "Europe/Berlin", "Leipzig": "Europe/Berlin",
        "Zürich": "Europe/Zurich", "Genève": "Europe/Zurich", "Basel": "Europe/Zurich", "Bern": "Europe/Zurich", "Lausanne": "Europe/Zurich",
        "Wien": "Europe/Vienna", "Salzburg": "Europe/Vienna", "Graz": "Europe/Vienna", "Praha": "Europe/Prague", "Warszawa": "Europe/Warsaw",
        "Kraków": "Europe/Warsaw", "Budapest": "Europe/Budapest", "Tallinn": "Europe/Tallinn", "Riga": "Europe/Riga", "Vilnius": "Europe/Vilnius",
        "Roma": "Europe/Rome", "Milano": "Europe/Rome", "Venezia": "Europe/Rome", "Napoli": "Europe/Rome", "Bologna": "Europe/Rome",
        "Firenze": "Europe/Rome", "Torino": "Europe/Rome", "Pisa": "Europe/Rome", "Athen": "Europe/Athens", "Thessaloniki": "Europe/Athens",
        "Istanbul": "Europe/Istanbul", "Madrid": "Europe/Madrid", "Barcelona": "Europe/Madrid", "Lisboa": "Europe/Lisbon", "Porto": "Europe/Lisbon",
        "New York": "America/New_York", "Boston": "America/New_York", "Washington": "America/New_York", "Miami": "America/New_York",
        "Toronto": "America/Toronto", "Montreal": "America/Toronto", "Chicago": "America/Chicago", "Los Angeles": "America/Los_Angeles",
        "San Francisco": "America/Los_Angeles", "Mexico City": "America/Mexico_City", "Bogotá": "America/Bogota", "Lima": "America/Lima",
        "Santiago": "America/Santiago", "Buenos Aires": "America/Argentina/Buenos_Aires", "São Paulo": "America/Sao_Paulo",
        "Rio de Janeiro": "America/Sao_Paulo", "Tokyo": "Asia/Tokyo", "Osaka": "Asia/Tokyo", "Nagoya": "Asia/Tokyo", "Fukuoka": "Asia/Tokyo",
        "Sapporo": "Asia/Tokyo", "Okinawa": "Asia/Tokyo", "Seoul": "Asia/Seoul", "Beijing": "Asia/Shanghai", "Shanghai": "Asia/Shanghai",
        "Hong Kong": "Asia/Hong_Kong", "Taipei": "Asia/Taipei", "Taichung": "Asia/Taipei", "Bangkok": "Asia/Bangkok", "Phuket": "Asia/Bangkok",
        "Koh Samui": "Asia/Bangkok", "Singapore": "Asia/Singapore", "Kuala Lumpur": "Asia/Kuala_Lumpur", "Jakarta": "Asia/Jakarta",
        "Bali": "Asia/Makassar", "Hanoi": "Asia/Bangkok", "Ho Chi Minh": "Asia/Ho_Chi_Minh", "Delhi": "Asia/Kolkata", "Mumbai": "Asia/Kolkata",
        "Dubai": "Asia/Dubai", "Abu Dhabi": "Asia/Dubai", "Doha": "Asia/Qatar", "Tel Aviv": "Asia/Jerusalem", "Kairo": "Africa/Cairo",
        "Johannesburg": "Africa/Johannesburg", "Cape Town": "Africa/Johannesburg", "Sydney": "Australia/Sydney", "Melbourne": "Australia/Melbourne",
        "Brisbane": "Australia/Brisbane", "Perth": "Australia/Perth", "Auckland": "Pacific/Auckland",
    ]
    /// where he will be that day -> the zone a new event takes; unknown: the phone's own
    static func zone(for city: String) -> String { zones[city] ?? TimeZone.current.identifier }
    /// "Roma-tid", for the form: the day's own city when the zone is its, else the zone's name
    static func zoneLabel(_ id: String, city: String = "") -> String {
        if !city.isEmpty, zones[city] == id { return city + T("-tid", " time") }
        if id == "Europe/Oslo" { return T("Oslo-tid", "Oslo time") }
        return (id.split(separator: "/").last.map { $0.replacingOccurrences(of: "_", with: " ") } ?? id) + T("-tid", " time")
    }
}
