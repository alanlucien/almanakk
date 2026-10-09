// The native app's data: the events and calendars the engine reads. Stage 1 runs on a
// made-up demo month (no real names, no real schedule — the repo is public); stage 2
// replaces `load()` with Google sign-in and the Calendar API.
import SwiftUI

@MainActor
final class Store: ObservableObject {
    @Published var events: [CalEvent] = []
    @Published var calendars: [CalInfo] = []
    @Published var year: Int
    @Published var month: Int          // 0-based, as the engine
    @Published var demo = true

    init() {
        let c = Day.greg.dateComponents([.year, .month], from: Date())
        year = c.year!; month = c.month! - 1
        load()
    }

    var almanac: Almanac { Almanac(events: events, calendars: calendars) }

    func step(_ n: Int) {
        var m = month + n, y = year
        while m < 0 { m += 12; y -= 1 }
        while m > 11 { m -= 12; y += 1 }
        year = y; month = m
        if demo { load() }
    }
    func goToday() {
        let c = Day.greg.dateComponents([.year, .month], from: Date())
        year = c.year!; month = c.month! - 1
        if demo { load() }
    }

    func load() {
        calendars = Demo.calendars
        events = Demo.events(year: year, month: month)
    }
}

// A month that exercises every rule the sheet draws: a tour leg with its day words and
// numbered shows, a span of his own, a pencilled entry, a coloured one, a move, a show.
enum Demo {
    static let calendars = [
        CalInfo(id: "own", name: "wg | ALAN", color: "#2b4fb3"),
        CalInfo(id: "private", name: "Privat", color: "#5a7d4a"),
        CalInfo(id: "touring", name: "wg | TOURING", color: "#b0652a"),
    ]
    static func events(year y: Int, month m: Int) -> [CalEvent] {
        func k(_ d: Int) -> String { Day.key(y, m, min(d, Day.daysInMonth(y, m))) }
        var out: [CalEvent] = []
        var n = 0
        func add(_ cal: String, _ title: String, _ s: Int, _ e: Int? = nil, time: String = "", color: String = "", location: String = "", notes: String = "") {
            n += 1
            out.append(CalEvent(id: "demo\(n)", calId: cal, title: title, start: k(s), end: k(e ?? s), time: time,
                                location: location, notes: notes, colorId: color))
        }
        // the tour: one leg, the robot's words, shows numbered on
        add("touring", "SKYGGER Bergen", 12, 18, location: "Bergen")
        let words = [12: "Travel", 13: "Get in", 14: "Work day", 15: "Performance 14", 16: "Performance 15", 17: "Day off", 18: "Travel"]
        for (d, w) in words { add("touring", w, d) }
        // his own
        add("own", "Prøver Vinterlys", 3, 9, color: "9")
        add("own", "Konseptmøte", 2, time: "10:00")
        add("own", "Lunsj med produsent", 2, time: "12:30", color: "4")
        add("own", "Kaffe?", 5, time: "09:00")
        add("own", "Leseprøve", 6, time: "11:00")
        add("private", "Tannlege", 8, time: "08:15", color: "6")
        add("own", "-Bergen", 12)
        add("own", "Premiere Vinterlys", 10, time: "19:00")
        add("own", "Middag", 16, time: "21:30", color: "10")
        add("own", "-Oslo", 18, time: "20:00")
        add("own", "Skrivedag", 21)
        add("own", "Opptak?", 23, 24)
        add("own", "Styremøte", 26, time: "14:00", color: "3", location: "Kontoret",
            notes: "Saksliste kommer.\n\nmessage://%3Cdemo%40example.com%3E")
        add("private", "Bursdag", 28, color: "11")
        return out
    }
}
