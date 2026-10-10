// The almanac's widgets — pieces of the sheet, not a list (Alan, 07.10: "make sure
// the widget does not look like calendars on iPhone"). Three of them: the day, the
// week and the month, each drawn the way the sheet draws it, from the snapshot the
// app writes (Shared/Snapshot.swift). Nothing is fetched.
import SwiftUI
import WidgetKit

// ---------- the ink and the paper ----------
extension Color {
    static let ink = Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x10 / 255)
    static let inkSoft = Color(red: 0x4a / 255, green: 0x4a / 255, blue: 0x45 / 255)
    static let muted = Color(red: 0x80 / 255, green: 0x80 / 255, blue: 0x7a / 255)
    static let paper = Color.white
    static let rule = Color(red: 0xd9 / 255, green: 0xd9 / 255, blue: 0xd4 / 255)
    static let ruleStrong = Color(red: 0x1c / 255, green: 0x1c / 255, blue: 0x1a / 255)
    static let wash = Color(red: 0xf1 / 255, green: 0xf1 / 255, blue: 0xee / 255)
    static let red = Color(red: 0xc0 / 255, green: 0x22 / 255, blue: 0x1b / 255)
    static let tour = Color(red: 0xb0 / 255, green: 0x65 / 255, blue: 0x2a / 255)
    static let tourWash = Color(red: 0xb0 / 255, green: 0x65 / 255, blue: 0x2a / 255).opacity(0.10)
    init(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces); if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { self = .muted; return }
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
    static func ink(_ p: Snapshot.Part) -> Color {
        if p.show { return .red }
        if p.pencil { return .muted }
        return p.ink.isEmpty ? .ink : Color(hex: p.ink)
    }
}

// ---------- the timeline ----------
struct Entry: TimelineEntry {
    let date: Date
    let snap: Snapshot?
    var key: String { Snapshot.key(date) }
    var day: Snapshot.Day? { snap?.day(key) }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), snap: Provider.sample) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), snap: Snapshot.read() ?? Provider.sample))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let snap = Snapshot.read()
        let now = Date(), cal = Calendar.current
        var entries = [Entry(date: now, snap: snap)]
        // today's clocks, so the day's lines move on; then every midnight the snapshot covers
        if let day = snap?.day(Snapshot.key(now)) {
            for p in day.parts where !p.time.isEmpty {
                if let t = clock(p.time, on: now), t > now { entries.append(Entry(date: t, snap: snap)) }
            }
        }
        var next = cal.startOfDay(for: now)
        for _ in 0..<62 {
            next = cal.date(byAdding: .day, value: 1, to: next)!
            guard snap?.day(Snapshot.key(next)) != nil else { break }
            entries.append(Entry(date: next, snap: snap))
        }
        entries.sort { $0.date < $1.date }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
    private func clock(_ hhmm: String, on date: Date) -> Date? {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2 else { return nil }
        return Calendar.current.date(bySettingHour: p[0], minute: p[1], second: 0, of: date)
    }
    // the sample sheet, for the gallery and for a phone that has not opened the app yet
    static let sample: Snapshot = {
        let json = """
        {"generated":"","lang":"no","months":["JANUAR","FEBRUAR","MARS","APRIL","MAI","JUNI","JULI","AUGUST","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"],"days":[]}
        """
        var s = try! JSONDecoder().decode(Snapshot.self, from: json.data(using: .utf8)!)
        let today = Snapshot.key(Date())
        let names = ["MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG", "SØNDAG"], letters = ["M", "Ti", "O", "To", "F", "L", "S"]
        let base = Snapshot.date(today)!
        let month = Calendar.current.component(.month, from: base)
        let first = Snapshot.key(Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: base))!)
        for i in -7..<40 {
            let k = Snapshot.shift(first, by: i)
            guard let d = Snapshot.date(k) else { continue }
            let wi = (Calendar.current.component(.weekday, from: d) + 5) % 7
            let dn = Calendar.current.component(.day, from: d)
            let inMonth = Calendar.current.component(.month, from: d) == month
            let legDay = inMonth && dn >= 9 && dn <= 14
            let perf = inMonth && (dn == 12 || dn == 13) ? (dn == 12 ? "15" : "16") : ""
            let words = [9: "Travel", 10: "Get in", 11: "Work", 14: "Travel"]
            var parts: [Snapshot.Part] = []
            if inMonth && dn == 2 { parts.append(.init(kind: "span", time: "", text: "Fanny og Alexander", color: "#2b4fb3", ink: "", show: false, pencil: false)) }
            if inMonth && dn == 10 { parts += [.init(kind: "timed", time: "09:00", text: "Befaring DNK", color: "#2b4fb3", ink: "", show: false, pencil: false),
                                               .init(kind: "timed", time: "13:00", text: "Tannlege", color: "#2f7d4a", ink: "", show: false, pencil: false),
                                               .init(kind: "timed", time: "21:00", text: "Kino", color: "#2f7d4a", ink: "", show: false, pencil: false)] }
            if inMonth && dn == 12 { parts.append(.init(kind: "allday", time: "", text: "Deadline søknad", color: "#2b4fb3", ink: "", show: false, pencil: false)) }
            if inMonth && dn == 18 { parts += [.init(kind: "timed", time: "07:05", text: "Oslo → Bergen", color: "#2f7d4a", ink: "", show: false, pencil: false),
                                               .init(kind: "timed", time: "14:00", text: "Kostymeprøve", color: "#2b4fb3", ink: "", show: false, pencil: false)] }
            if inMonth && dn == 20 { parts.append(.init(kind: "allday", time: "", text: "Middag hos mor", color: "#2f7d4a", ink: "", show: false, pencil: false)) }
            let lane: Snapshot.Lane = inMonth && dn >= 2 && dn <= 27 ? .init(color: "#2b4fb3", a: dn == 2, z: dn == 27) : .init(color: "", a: false, z: false)
            let week = Calendar(identifier: .iso8601).component(.weekOfYear, from: d)
            var info: Snapshot.Info? = nil
            if wi == 0 { info = .init(kind: "uke", text: "uke \(week)", tbc: false) }
            else if wi == 1 || dn == 1 { info = .init(kind: "cty", text: legDay ? "Paris" : "Oslo", tbc: false) }
            s.days.append(.init(date: k, d: dn, wi: wi, wd: names[wi], wl: letters[wi], week: week, hol: "", red: wi == 6, sun: wi == 6,
                city: legDay ? "Paris" : "Oslo", tbc: false, show: !perf.isEmpty, nLanes: 1, lanes: [lane], info: info,
                tour: legDay ? .init(name: "ANTIGONE", word: words[dn] ?? "", perf: perf, city: "Paris", tbc: false, open: dn == 9) : nil,
                parts: parts))
        }
        return s
    }()
}

// ---------- the pieces of the sheet ----------

// a day's figure and letter, as the month writes them
struct DayFigure: View {
    let day: Snapshot.Day
    var size: CGFloat = 11
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text("\(day.d)").font(.system(size: size, weight: .semibold)).monospacedDigit()
                .foregroundStyle(day.red ? Color.red : Color.ink)
                .overlay(alignment: .leading) { if day.show { Circle().fill(Color.red).frame(width: size * 0.3, height: size * 0.3).offset(x: -size * 0.45) } }
            Text(day.wl).font(.system(size: size * 0.8)).foregroundStyle(day.red ? Color.red : Color.inkSoft)
        }
    }
}

// the tour column's word, in its own ink
struct TourCell: View {
    let t: Snapshot.Tour
    var size: CGFloat = 8
    var body: some View {
        Group {
            if t.open { Text(t.name).font(.system(size: size * 0.85, weight: .bold)).tracking(0.3).foregroundStyle(Color.ink).italic(t.tbc).lineLimit(1) }
            else if !t.perf.isEmpty { Text(t.perf).font(.system(size: size * 1.2, weight: .bold)).foregroundStyle(Color.red) }
            else if !t.word.isEmpty { Text(t.word).font(.system(size: size)).foregroundStyle(Color.tour).italic(t.tbc).lineLimit(1) }
        }
    }
}

struct InfoCell: View {
    let info: Snapshot.Info?
    var size: CGFloat = 7
    var body: some View {
        if let i = info {
            switch i.kind {
            case "cty": Text(i.text.uppercased()).font(.system(size: size, weight: i.tbc ? .regular : .semibold)).tracking(0.5).foregroundStyle(Color.inkSoft).italic(i.tbc).lineLimit(1)
            case "hn": Text(i.text).font(.system(size: size)).italic().foregroundStyle(Color.red).lineLimit(1)
            default: Text(i.text).font(.system(size: size)).foregroundStyle(Color.muted).lineLimit(1)
            }
        }
    }
}

// one line of the day, as the day sheet writes it: the clock, the dot, the words
struct LineRow: View {
    let p: Snapshot.Part
    var size: CGFloat = 11
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(p.time).font(.system(size: size * 0.85)).monospacedDigit().foregroundStyle(Color.muted).frame(width: size * 2.9, alignment: .trailing)
            Circle().fill(Color(hex: p.color)).frame(width: size * 0.45, height: size * 0.45)
            Text(p.text).font(.system(size: size, weight: p.kind == "span" ? .semibold : .regular)).foregroundStyle(Color.ink(p)).lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}

// what the day's lines are at this hour: all-day things always, timed ones still ahead
func linesAhead(_ e: Entry) -> [Snapshot.Part] {
    guard let d = e.day else { return [] }
    let isToday = d.date == Snapshot.key(Date())
    let f = DateFormatter(); f.dateFormat = "HH:mm"; let now = f.string(from: Date())
    return d.parts.filter { !isToday || $0.time.isEmpty || $0.time >= now }
}

// ---------- DAG: the day sheet's head and its lines ----------
struct DayView: View {
    let e: Entry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if let d = e.day {
            let big = family != .systemSmall
            let lines = linesAhead(e)
            let room = big ? 6 : (d.tour != nil || !d.hol.isEmpty ? 3 : 4)
            VStack(alignment: .leading, spacing: 0) {
                // the head: the figure and the name; on a wide sheet the tour's word beside them
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(d.d)").font(.system(size: 22, weight: .bold)).monospacedDigit().foregroundStyle(d.red ? Color.red : Color.ink)
                    Text(d.wd).font(.system(size: 10, weight: .semibold)).tracking(1.2).foregroundStyle(d.red ? Color.red : Color.ink)
                        .lineLimit(1).fixedSize()
                    Spacer(minLength: 0)
                    if big { DayContext(d: d) }
                }
                .padding(.bottom, 4)
                Rectangle().fill(Color.ruleStrong).frame(height: 1)
                // on the small sheet the tour's word takes the first line, as the week writes it
                if !big && (d.tour != nil || !d.hol.isEmpty) {
                    HStack { Spacer(minLength: 0); DayContext(d: d) }.frame(height: 17)
                    Rectangle().fill(Color.rule).frame(height: 0.5)
                }
                ForEach(Array(lines.prefix(room).enumerated()), id: \.offset) { _, p in
                    LineRow(p: p, size: big ? 12 : 11).frame(height: big ? 19 : 17)
                    Rectangle().fill(Color.rule).frame(height: 0.5)
                }
                Spacer(minLength: 0)
                HStack {
                    Text(context(d)).font(.system(size: 8, weight: .medium)).tracking(1).foregroundStyle(Color.muted).lineLimit(1)
                    Spacer()
                    if lines.count > room { Text("+\(lines.count - room)").font(.system(size: 8)).foregroundStyle(Color.muted) }
                }
            }
            .widgetURL(dayURL(d.date))
        } else {
            Stale()
        }
    }
    private func context(_ d: Snapshot.Day) -> String {
        var parts: [String] = []
        if !d.city.isEmpty { parts.append(d.city.uppercased()) }
        parts.append("UKE \(d.week)")
        return parts.joined(separator: " · ")
    }
}

// the day's context, as the week's day header writes it: the tour's word and city, or the holiday
struct DayContext: View {
    let d: Snapshot.Day
    var body: some View {
        if let t = d.tour {
            if !t.perf.isEmpty { Text("\(t.name.capitalized) \(t.perf) · \(t.city)".uppercased()).font(.system(size: 9, weight: .bold)).tracking(0.8).foregroundStyle(Color.red).lineLimit(1) }
            else { Text(((t.word.isEmpty ? t.name : t.word) + " · " + t.city).uppercased()).font(.system(size: 9, weight: .semibold)).tracking(0.8).foregroundStyle(Color.tour).italic(t.tbc).lineLimit(1) }
        } else if !d.hol.isEmpty {
            Text(d.hol).font(.system(size: 9)).italic().foregroundStyle(Color.red).lineLimit(1)
        }
    }
}

struct Stale: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ALMANAKK").font(.system(size: 10, weight: .bold)).tracking(2).foregroundStyle(Color.ink)
            Rectangle().fill(Color.ruleStrong).frame(height: 1)
            Spacer()
            Text("Åpne appen én gang, så fylles arket.").font(.system(size: 10)).foregroundStyle(Color.muted)
        }
    }
}

// ---------- UKE: seven rows, the week's own page compressed ----------
struct WeekView: View {
    let e: Entry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if let snap = e.snap, let today = e.day {
            let days = snap.week(of: e.key)
            // LARGER TYPE (Alan, 08.10: "font on week widget is too small"): the medium
            // widget writes at 12pt, the large at 14, figures a size above
            let big = family == .systemLarge
            let f: CGFloat = big ? 14 : 12
            VStack(spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    Text("UKE \(today.week)").font(.system(size: big ? 14 : 12, weight: .bold)).tracking(1.5).foregroundStyle(Color.ink)
                    Spacer()
                    Text(monthName(snap, days)).font(.system(size: big ? 11 : 10, weight: .medium)).tracking(1).foregroundStyle(Color.muted)
                }
                .padding(.bottom, 3)
                Rectangle().fill(Color.ruleStrong).frame(height: 1)
                ForEach(0..<7, id: \.self) { i in
                    if let d = days[i] {
                        HStack(alignment: .center, spacing: 6) {
                            DayFigure(day: d, size: f + 0.5).frame(width: f * 3, alignment: .leading)
                            Text(d.parts.map { ($0.time.isEmpty ? "" : $0.time + " ") + $0.text }.joined(separator: "  ·  "))
                                .font(.system(size: f)).foregroundStyle(d.parts.first.map { Color.ink($0) } ?? .ink).lineLimit(1)
                            Spacer(minLength: 2)
                            if let t = d.tour { TourCell(t: t, size: f - 1) }
                            else if !d.hol.isEmpty { Text(d.hol).font(.system(size: f - 2)).italic().foregroundStyle(Color.red).lineLimit(1) }
                        }
                        .padding(.horizontal, 3)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(d.today ? Color.wash : (d.sun ? Color.wash.opacity(0.6) : Color.clear))
                        .overlay(alignment: .leading) { if d.today { Rectangle().fill(Color.ink).frame(width: 2) } }
                        .dayLink(d.date)
                        Rectangle().fill(d.sun ? Color.ruleStrong : Color.rule).frame(height: d.sun ? 1 : 0.5)
                    } else {
                        Spacer().frame(maxHeight: .infinity)
                    }
                }
            }
        } else { Stale() }
    }
    private func monthName(_ snap: Snapshot, _ days: [Snapshot.Day?]) -> String {
        guard let a = days.compactMap({ $0 }).first, let z = days.compactMap({ $0 }).last else { return "" }
        let ma = Int(a.date.dropFirst(5).prefix(2)) ?? 1, mz = Int(z.date.dropFirst(5).prefix(2)) ?? 1
        let n = snap.months
        return ma == mz ? n[ma - 1] : "\(n[ma - 1].prefix(3)) – \(n[mz - 1].prefix(3))"
    }
}

private extension Snapshot.Day { var today: Bool { date == Snapshot.key(Date()) } }

/// A TAP ON A DAY OPENS ITS WEEK in the app, that day marked (Alan, 11.10)
func dayURL(_ ds: String) -> URL { URL(string: "almanakk://day/\(ds)")! }
extension View {
    func dayLink(_ ds: String) -> some View {
        overlay(Link(destination: dayURL(ds)) { Rectangle().fill(Color.white.opacity(0.001)) })
    }
}

// ---------- MÅNED: the sheet itself, every row ----------
struct MonthView: View {
    let e: Entry
    var body: some View {
        if let snap = e.snap, let _ = e.day {
            let days = snap.month(of: e.key)
            let nLanes = max(1, days.first?.nLanes ?? 1)
            let m = Int(e.key.dropFirst(5).prefix(2)) ?? 1
            // EVERY ROW THE SAME HEIGHT, cut from the widget's own height — the
            // sheet's rule — so 31 rows always fit and the type follows the row
            GeometryReader { geo in
                let head: CGFloat = 13
                let rowH = (geo.size.height - head) / CGFloat(max(1, days.count))
                let f = min(7, rowH * 0.6)
                VStack(spacing: 0) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(snap.months[m - 1]).font(.system(size: 8, weight: .bold)).tracking(1.5).foregroundStyle(Color.ink)
                        Spacer()
                        Text(String(e.key.prefix(4))).font(.system(size: 7)).tracking(1).foregroundStyle(Color.muted)
                    }
                    .frame(height: head - 1, alignment: .bottom)
                    Rectangle().fill(Color.ruleStrong).frame(height: 1)
                    ForEach(days, id: \.date) { d in
                        HStack(alignment: .center, spacing: 0) {
                            DayFigure(day: d, size: f).frame(width: f * 3.4, alignment: .trailing).padding(.trailing, 2)
                            HStack(spacing: 2) {
                                ForEach(0..<nLanes, id: \.self) { l in
                                    let lane = l < d.lanes.count ? d.lanes[l] : nil
                                    Rectangle().fill(lane.map { $0.color.isEmpty ? Color.clear : Color(hex: $0.color) } ?? .clear).frame(width: 1.5)
                                        .padding(.top, lane?.a == true ? 2 : 0).padding(.bottom, lane?.z == true ? 2 : 0)
                                }
                            }
                            .padding(.horizontal, 2)
                            Text(d.parts.map { ($0.time.isEmpty ? "" : $0.time + " ") + $0.text }.joined(separator: "  "))
                                .font(.system(size: f)).foregroundStyle(d.parts.first.map { Color.ink($0) } ?? .ink).lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            if let t = d.tour {
                                TourCell(t: t, size: f).padding(.horizontal, 3)
                                    .frame(width: f * 6.5, alignment: .leading).frame(maxHeight: .infinity)
                                    .background(t.tbc ? Color.clear : Color.tourWash)
                                    .overlay(alignment: .leading) { Rectangle().fill(Color.tour).frame(width: 1.5) }
                                    .overlay(alignment: .top) { if t.open { Rectangle().fill(Color.tour).frame(height: 0.5) } }
                            }
                            InfoCell(info: d.info, size: f * 0.93).frame(width: f * 5.7, alignment: .trailing).padding(.trailing, 2)
                        }
                        .frame(height: rowH - 0.5)
                        .background(d.sun || !d.hol.isEmpty ? Color.wash : Color.clear)
                        .overlay(alignment: .leading) { if d.today { Rectangle().fill(Color.ink).frame(width: 2) } }
                        .clipped()
                        .dayLink(d.date)
                        Rectangle().fill(d.sun ? Color.ruleStrong : Color.rule).frame(height: 0.5)
                    }
                }
            }
            .padding(.horizontal, 4).padding(.top, 4).padding(.bottom, 4)
        } else { Stale().padding(12) }
    }
}

// ---------- the lock screen ----------
struct RectangularView: View {
    let e: Entry
    var body: some View {
        if let d = e.day {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text("\(d.d) \(d.wd)").font(.system(size: 13, weight: .bold))
                    if let t = d.tour { Text(t.perf.isEmpty ? t.word : "\(t.name.capitalized) \(t.perf)").font(.system(size: 12, weight: t.perf.isEmpty ? .regular : .bold)) }
                }
                Text((d.city.isEmpty ? "" : d.city.uppercased() + " · ") + "UKE \(d.week)").font(.system(size: 11)).opacity(0.8)
                if let l = linesAhead(e).first { Text(l.time.isEmpty ? l.text : "\(l.time) \(l.text)").font(.system(size: 12)).lineLimit(1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else { Text("Almanakk") }
    }
}
struct InlineView: View {
    let e: Entry
    var body: some View {
        var parts: [String] = []
        if let t = e.day?.tour { parts.append(t.perf.isEmpty ? (t.word.isEmpty ? t.name.capitalized : t.word) : "\(t.name.capitalized) \(t.perf)") }
        if let d = e.day, !d.city.isEmpty { parts.append(d.city) }
        if let l = linesAhead(e).first { parts.append(l.time.isEmpty ? l.text : "\(l.time) \(l.text)") }
        return Text(parts.isEmpty ? "Almanakk" : parts.joined(separator: " · "))
    }
}

// ---------- the three widgets ----------
struct DayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AlmanakkDay", provider: Provider()) { entry in
            DayViewSwitch(entry: entry).containerBackground(for: .widget) { Color.paper }
        }
        .configurationDisplayName("Dag")
        .description("Dagens ark: figuren, turneens ord og dagens linjer.")
        .supportedFamilies(dayFamilies)
    }
    private var dayFamilies: [WidgetFamily] {
        #if os(iOS)
        return [.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline]
        #else
        return [.systemSmall, .systemMedium]
        #endif
    }
}
struct DayViewSwitch: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry
    var body: some View {
        switch family {
        case .accessoryRectangular: RectangularView(e: entry)
        case .accessoryInline: InlineView(e: entry)
        default: DayView(e: entry)
        }
    }
}
struct WeekWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AlmanakkWeek", provider: Provider()) { entry in
            WeekView(e: entry).containerBackground(for: .widget) { Color.paper }
        }
        .configurationDisplayName("Uke")
        .description("Ukens side: sju rader, hver dags linjer og turneens ord.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
struct MonthWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AlmanakkMonth", provider: Provider()) { entry in
            MonthView(e: entry).containerBackground(for: .widget) { Color.paper }
        }
        .configurationDisplayName("Måned")
        .description("Hele månedsarket: hver dag på sin rad, båndene og turneen.")
        .supportedFamilies(monthFamilies)
        .contentMarginsDisabled()
    }
    private var monthFamilies: [WidgetFamily] {
        #if os(iOS)
        return [.systemLarge]
        #else
        return [.systemLarge, .systemExtraLarge]
        #endif
    }
}

@main
struct AlmanakkWidgetBundle: WidgetBundle {
    var body: some Widget {
        DayWidget()
        WeekWidget()
        MonthWidget()
    }
}
