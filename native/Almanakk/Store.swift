// The native app's data: the events and calendars the engine reads. Signed in, they come
// from Google (Google.swift) and are kept on the phone so the next start is instant;
// signed out, a made-up demo month (no real names, no real schedule — the repo is public).
// After every load the app writes the widgets' snapshot, the job the web page did before.
import SwiftUI
import WidgetKit

@MainActor
final class Store: ObservableObject {
    @Published var events: [CalEvent] = [] { didSet { cachedAlmanac = nil } }
    @Published var calendars: [CalInfo] = [] { didSet { cachedAlmanac = nil } }
    @Published var year: Int
    @Published var month: Int          // 0-based, as the engine
    @Published var demo = true
    @Published var loading = false
    @Published var problem: String? = nil
    @Published var pendingCount = Outbox.count     // changes waiting for the network
    /// the line at the foot of the screen after a write: what happened, and how to undo it
    @Published var toast: Toast? = nil
    struct Toast: Identifiable { let id = UUID(); var text: String; var undo: (() async -> Void)? = nil }
    /// THE PHONE'S OWN UNDO (Alan, 11.10: "I like shake undo … and the three fingers"): every
    /// change registers its opposite with the window's undo manager, so a shake ("Angre …?")
    /// or a three-finger swipe left undoes it and right redoes it. The inverse of an undo is
    /// registered in turn, which is what makes redo work.
    weak var undo: UndoManager?
    private func registerUndo(_ name: String, _ action: @escaping @MainActor (Store) async -> Void) {
        guard let u = undo else { return }
        u.registerUndo(withTarget: self) { store in Task { @MainActor in await action(store) } }
        u.setActionName(name)
    }

    init() {
        let c = Day.greg.dateComponents([.year, .month], from: Date())
        year = c.year!; month = c.month! - 1
        #if os(iOS)
        if GoogleAuth.shared.hasAccount, let cached = Cache.read() {
            demo = false; calendars = cached.calendars; events = cached.events
        } else if GoogleAuth.shared.hasAccount {
            demo = false
        } else if Store.demoWanted { loadDemo() }
        #else
        loadDemo()
        #endif
    }

    /// one Almanac per state of the calendar, so its remembered months and weeks survive
    /// between screens; a change to events or calendars makes a fresh one
    private var cachedAlmanac: Almanac?
    var almanac: Almanac {
        if let a = cachedAlmanac { return a }
        let a = Almanac(events: events, calendars: calendars); cachedAlmanac = a; return a
    }

    /// SIGNED OUT IS EMPTY, WITH ONE BUTTON (Alan, 10.10: "do we need 'eksempeldata'? just
    /// log in"). The demo month is only for testing, started with the "-demo" argument.
    static var demoWanted: Bool { ProcessInfo.processInfo.arguments.contains("-demo") }

    func step(_ n: Int) {
        var m = month + n, y = year
        while m < 0 { m += 12; y -= 1 }
        while m > 11 { m -= 12; y += 1 }
        year = y; month = m
        if demo { loadDemo() }
    }
    func goToday() {
        let c = Day.greg.dateComponents([.year, .month], from: Date())
        year = c.year!; month = c.month! - 1
        if demo { loadDemo() }
    }

    func loadDemo() {
        guard Store.demoWanted else { calendars = []; events = []; return }
        calendars = Demo.calendars
        events = Demo.events(year: year, month: month)
    }

    #if os(iOS)
    func signIn() async {
        problem = nil
        do {
            try await GoogleAuth.shared.signIn()
            demo = false
            await refresh()
        } catch GoogleError.cancelled {
        } catch { problem = error.localizedDescription }
    }

    func signOut() {
        GoogleAuth.shared.signOut()
        Cache.clear()
        demo = true
        loadDemo()
    }

    /// FIVE YEARS BACK AND FIVE AHEAD (Alan, 10.10), all visible calendars at once.
    func refresh() async {
        guard !demo, !loading else { return }
        if Outbox.count > 0 { await flushOutbox() }
        loading = true; defer { loading = false }
        let now = Day.greg.component(.year, from: Date())
        let from = "\(now - 5)-01-01", to = "\(now + 5)-12-31"
        do {
            let cals = try await GCal.calendars()
            let all = try await withThrowingTaskGroup(of: [CalEvent].self) { group in
                for c in cals { group.addTask { try await GCal.events(cal: c.id, from: from, to: to) } }
                var out: [CalEvent] = []
                for try await chunk in group { out += chunk }
                return out
            }
            calendars = cals; events = all; problem = nil
            Cache.write(.init(calendars: cals, events: all))
            writeSnapshot()
        } catch GoogleError.noToken {
            demo = true; loadDemo()
        } catch {
            // the last good copy stays on screen; the reason is said, not swallowed
            problem = "Kunne ikke oppdatere: " + error.localizedDescription
        }
    }

    // ---------- writing (stage 3) ----------
    // Every write is checked: Google's answer replaces the local copy, an error is said in
    // red and nothing is shown as saved. Signed out (the demo), writes stay on the phone.

    /// the calendars he may write to: never the robot's tour, never the schedule
    var writable: [CalInfo] {
        let alm = almanac
        return calendars.filter { !alm.tourCalIds.contains($0.id) && !alm.scheduleCalIds.contains($0.id) }
    }
    var defaultCal: String {
        writable.first { $0.name.lowercased() == "wg | alan" }?.id ?? writable.first?.id ?? ""
    }

    @discardableResult
    func save(_ d: Draft, editing old: CalEvent?) async -> Bool {
        problem = nil
        if demo {
            var e = localEvent(d, id: old?.id ?? "demo-" + d.id)
            if e.calId.isEmpty { e.calId = "own" }
            events.removeAll { $0.id == old?.id }
            events.append(e)
            toast = .init(text: old == nil ? T("Lagt til", "Added") : T("Lagret", "Saved"))
            registerInverse(of: old, saved: e)
            return true
        }
        do {
            let cal = d.calId.isEmpty ? defaultCal : d.calId
            var saved: CalEvent?
            if let old {
                var target = old
                if cal != old.calId, let moved = try await GCal.move(old, to: cal) { target = moved }
                saved = try await GCal.patch(target, body: d.googleBody())
            } else {
                saved = try await GCal.insert(cal: cal, body: d.googleBody())
            }
            guard let e = saved else { problem = "Google svarte uten hendelsen. Sjekk i Google Kalender."; return false }
            events.removeAll { $0.id == old?.id }
            events.append(e)
            Cache.write(.init(calendars: calendars, events: events)); writeSnapshot()
            toast = .init(text: old == nil ? T("Lagt til i", "Added to") + " \(calendars.first { $0.id == cal }?.name ?? T("kalenderen", "the calendar"))" : T("Lagret", "Saved"))
            registerInverse(of: old, saved: e)
            return true
        } catch where Store.offline(error) {
            // NO NETWORK: kept on the phone and sent when it is back (Alan, 11.10)
            let cal = d.calId.isEmpty ? defaultCal : d.calId
            var e = localEvent(d, id: old?.id ?? "local-" + d.id)
            e.calId = old?.calId ?? cal
            if let old, old.id.hasPrefix("local-") {
                Outbox.replace(insertFor: old.id, cal: cal, body: d.googleBody())
            } else if let old {
                Outbox.add(.init(kind: "patch", cal: old.calId, eventId: old.id, localId: nil, body: d.googleBody()))
            } else {
                Outbox.add(.init(kind: "insert", cal: cal, eventId: nil, localId: e.id, body: d.googleBody()))
            }
            events.removeAll { $0.id == old?.id }
            events.append(e)
            Cache.write(.init(calendars: calendars, events: events)); writeSnapshot()
            pendingCount = Outbox.count
            toast = .init(text: T("Lagret på telefonen – sendes når du er på nett", "Saved on the phone – sent when you are online"))
            return true
        } catch {
            problem = T("Ble ikke lagret: ", "Not saved: ") + error.localizedDescription
            return false
        }
    }

    private func localEvent(_ d: Draft, id: String) -> CalEvent {
        CalEvent(id: id, calId: d.calId.isEmpty ? defaultCal : d.calId, title: d.finalTitle,
                 start: d.start, end: d.allDay ? max(d.end, d.start) : d.start, time: d.allDay ? "" : d.time,
                 endTime: d.allDay ? "" : d.endTime, location: d.location, notes: d.notes, colorId: d.colorId,
                 zone: d.allDay ? "" : d.zone)
    }

    static func offline(_ error: Error) -> Bool {
        guard let u = error as? URLError else { return false }
        return [.notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost, .cannotConnectToHost, .dataNotAllowed, .internationalRoamingOff].contains(u.code)
    }

    /// what waits in the outbox is sent in order; a step that still has no network stops
    /// the run and keeps the rest. Called on refresh, i.e. on opening and coming forward.
    func flushOutbox() async {
        guard !demo else { return }
        for op in Outbox.all {
            do {
                let body = op.bodyDict
                switch op.kind {
                case "insert": _ = try await GCal.send("POST", GCal.path(op.cal) + "/events", body: body)
                case "patch":
                    if let id = op.eventId { _ = try await GCal.send("PATCH", GCal.path(op.cal) + "/events/" + String(id.dropFirst(op.cal.count + 1)), body: body) }
                case "delete":
                    if let id = op.eventId { _ = try await GCal.send("DELETE", GCal.path(op.cal) + "/events/" + String(id.dropFirst(op.cal.count + 1))) }
                default: break
                }
                Outbox.remove(op.id)
            } catch where Store.offline(error) {
                pendingCount = Outbox.count
                return                                   // still no network: keep the rest, in order
            } catch {
                // Google refused it: said, and dropped, so one bad step cannot block the rest
                problem = T("En endring fra da du var uten nett ble avvist: ", "A change made offline was refused: ") + error.localizedDescription
                Outbox.remove(op.id)
            }
        }
        pendingCount = Outbox.count
    }

    /// a new event's opposite is its deletion; an edit's is the event as it was
    private func registerInverse(of old: CalEvent?, saved e: CalEvent) {
        let name = e.title.deco
        if let old {
            let back = Draft(old, zone: old.zone.isEmpty ? TimeZone.current.identifier : old.zone)
            registerUndo("endring av \(name)") { store in _ = await store.save(back, editing: store.events.first { $0.id == e.id } ?? e) }
        } else {
            registerUndo("ny hendelse \(name)") { store in await store.delete(store.events.first { $0.id == e.id } ?? e, quiet: true) }
        }
    }

    /// deleted, with T("Angre", "Undo") for a moment: undo writes it back as it was
    func delete(_ e: CalEvent, quiet: Bool = false) async {
        problem = nil
        let back = Draft(e, zone: TimeZone.current.identifier)
        if !demo {
            do { try await GCal.delete(e) }
            catch where Store.offline(error) {
                if e.id.hasPrefix("local-") { Outbox.dropInsert(e.id) }
                else { Outbox.add(.init(kind: "delete", cal: e.calId, eventId: e.id, localId: nil, body: nil)) }
                pendingCount = Outbox.count
            }
            catch { problem = T("Ble ikke slettet: ", "Not deleted: ") + error.localizedDescription; return }
        }
        events.removeAll { $0.id == e.id }
        if !demo { Cache.write(.init(calendars: calendars, events: events)); writeSnapshot() }
        var restore = back; restore.calId = e.calId
        registerUndo("sletting av \(e.title.deco)") { store in _ = await store.save(restore, editing: nil) }
        if quiet { toast = .init(text: T("Angret", "Undone")); return }
        toast = .init(text: T("Slettet", "Deleted")) { [weak self] in
            guard let self else { return }
            // the line's T("Angre", "Undo") is the same undo a shake gives, so the two cannot both restore it
            if let u = self.undo, u.canUndo { u.undo() } else { _ = await self.save(restore, editing: nil) }
            self.toast = .init(text: T("Gjenopprettet", "Restored"))
        }
    }

    /// a pencilled event made firm: the "?" comes off the title, an old P line off the notes
    func confirm(_ e: CalEvent) async {
        var d = Draft(e, zone: e.time.isEmpty ? TimeZone.current.identifier : (zoneOf(e) ?? TimeZone.current.identifier))
        d.pencil = false
        if await save(d, editing: e) { toast = .init(text: T("Bekreftet", "Confirmed")) }
    }
    /// the zone a timed event was written in (kept on the event since stage 2)
    func zoneOf(_ e: CalEvent) -> String? { e.zone.isEmpty ? nil : e.zone }

    /// THE WIDGETS ARE FED (snapshot() in v3/app.js): a week back to two months ahead,
    /// the month rows exactly as drawn, the schedule's calls joining each day's lines.
    func writeSnapshot() {
        let alm = almanac
        let now = Date()
        let comps = Day.greg.dateComponents([.year, .month], from: now)
        let from = Day.add(Day.key(comps.year!, comps.month! - 1, 1), -7)
        let to = Day.key(Day.greg.date(byAdding: .day, value: 62, to: now)!)
        let sched = alm.scheduleCalIds
        func hex(_ c: String) -> String { RX.test("^#[0-9a-fA-F]{6}$", c) ? c : "" }
        var days: [Snapshot.Day] = []
        var y = Int(from.prefix(4))!, m = Int(from.dropFirst(5).prefix(2))! - 1
        while Day.key(y, m, 1) <= to {
            let (rows, nLanes) = alm.month(y, m)
            for r in rows where r.date >= from && r.date <= to {
                let calls = alm.events.filter { !$0.isSpan && $0.start == r.date && sched.contains($0.calId) }.map {
                    Snapshot.Part(kind: "timed", time: Rules.effTime($0), text: Rules.stripClock($0.title.deco), color: hex(alm.color($0)),
                                  ink: "", show: Rules.isShow($0), pencil: false)
                }
                let parts = r.parts.map { p -> Snapshot.Part in
                    let kind = p.kind == .span ? "span" : (p.kind == .allday ? "allday" : "timed")
                    return Snapshot.Part(kind: kind, time: p.time, text: p.text, color: hex(p.color), ink: hex(p.ink), show: p.show, pencil: p.pencil)
                } + calls
                let sorted = parts.enumerated().sorted { a, b in
                    let ta = a.element.kind == "timed" ? 1 : 0, tb = b.element.kind == "timed" ? 1 : 0
                    if ta != tb { return ta < tb }
                    if a.element.time != b.element.time { return a.element.time < b.element.time }
                    return a.offset < b.offset
                }.map(\.element)
                let info = r.info.map { i -> Snapshot.Info in
                    Snapshot.Info(kind: i.kind == .uke ? "uke" : (i.kind == .cty ? "cty" : "hn"), text: i.text, tbc: i.tbc)
                }
                // the widget keeps its own rule: the name on the leg's first day
                let tour = r.tour.map { Snapshot.Tour(name: $0.name, word: $0.start ? "" : $0.word, perf: $0.start ? "" : $0.perf, city: $0.city, tbc: $0.tbc, open: $0.start) }
                days.append(Snapshot.Day(date: r.date, d: r.d, wi: r.wi, wd: WD_LONG_ALL[r.wi], wl: WD_ALL[r.wi], week: r.week, hol: r.hol,
                                         red: r.red, sun: r.sun, city: r.city, tbc: r.tbc, show: r.show, nLanes: nLanes,
                                         lanes: r.lanes.map { $0.map { Snapshot.Lane(color: $0.color, a: $0.a, z: $0.z) } ?? Snapshot.Lane(color: "", a: false, z: false) },
                                         info: info, tour: tour, parts: sorted))
            }
            m += 1; if m > 11 { m = 0; y += 1 }
        }
        let snap = Snapshot(generated: ISO8601DateFormatter().string(from: now), lang: "no", months: MONTHS_ALL, days: days)
        guard let data = try? JSONEncoder().encode(snap), let json = String(data: data, encoding: .utf8) else { return }
        if Snapshot.write(json) { WidgetCenter.shared.reloadAllTimelines() }
    }
    #endif
}

let MONTHS_ALL = ["JANUAR", "FEBRUAR", "MARS", "APRIL", "MAI", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"]
let WD_ALL = ["M", "Ti", "O", "To", "F", "L", "S"]
let WD_LONG_ALL = ["MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG", "SØNDAG"]

// The last good copy of the calendars, on the phone only (Application Support).
enum Cache {
    struct Body: Codable { var calendars: [CalInfo]; var events: [CalEvent] }
    static var url: URL? {
        try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("calendar-cache.json")
    }
    static func read() -> Body? { url.flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONDecoder().decode(Body.self, from: $0) } }
    static func write(_ b: Body) { if let u = url, let d = try? JSONEncoder().encode(b) { try? d.write(to: u, options: [.atomic, .completeFileProtection]) } }
    static func clear() { if let u = url { try? FileManager.default.removeItem(at: u) } }
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
        add("own", "Vinterlys sesong", 1, 29, color: "10")
        add("private", "Kurs", 20, 22, color: "4")
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

// THE OUTBOX: changes made without network, kept on the phone in order until they are sent.
struct PendingOp: Codable, Identifiable {
    var id = UUID().uuidString
    var kind: String          // insert · patch · delete
    var cal: String
    var eventId: String?
    var localId: String?
    var body: Data?
    init(kind: String, cal: String, eventId: String?, localId: String?, body: [String: Any]?) {
        self.kind = kind; self.cal = cal; self.eventId = eventId; self.localId = localId
        self.body = body.flatMap { try? JSONSerialization.data(withJSONObject: $0) }
    }
    var bodyDict: [String: Any]? { body.flatMap { (try? JSONSerialization.jsonObject(with: $0)) as? [String: Any] } }
}
enum Outbox {
    static var url: URL? {
        try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("outbox.json")
    }
    static var all: [PendingOp] { url.flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONDecoder().decode([PendingOp].self, from: $0) } ?? [] }
    static var count: Int { all.count }
    static func save(_ ops: [PendingOp]) { if let u = url, let d = try? JSONEncoder().encode(ops) { try? d.write(to: u, options: [.atomic, .completeFileProtection]) } }
    static func add(_ op: PendingOp) { save(all + [op]) }
    static func remove(_ id: String) { save(all.filter { $0.id != id }) }
    static func dropInsert(_ localId: String) { save(all.filter { $0.localId != localId }) }
    static func replace(insertFor localId: String, cal: String, body: [String: Any]) {
        save(all.map { op in op.localId == localId ? PendingOp(kind: "insert", cal: cal, eventId: nil, localId: localId, body: body) : op })
    }
}
