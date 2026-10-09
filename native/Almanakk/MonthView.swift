// THE NATIVE MONTH (stage 1 of the full iPhone app, 09.10.2026). The phone month as the
// sheet draws it — one row per day, the whole month on one screen — but drawn by SwiftUI,
// so the swipe, the sheet and the scrolling are the phone's own. Rows come from the
// engine (Shared/Engine.swift), the same rows the web month and the widget read.
#if os(iOS)
import SwiftUI
import UIKit

// ---------- ink and paper (the widget's, so the two read as one object) ----------
enum Ink {
    static let ink = Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x10 / 255)
    static let soft = Color(red: 0x4a / 255, green: 0x4a / 255, blue: 0x45 / 255)
    static let muted = Color(red: 0x80 / 255, green: 0x80 / 255, blue: 0x7a / 255)
    static let paper = Color.white
    static let ground = Color(red: 0xeb / 255, green: 0xeb / 255, blue: 0xe7 / 255)
    static let rule = Color(red: 0xd9 / 255, green: 0xd9 / 255, blue: 0xd4 / 255)
    static let wash = Color(red: 0xf1 / 255, green: 0xf1 / 255, blue: 0xee / 255)
    static let red = Color(red: 0xc0 / 255, green: 0x22 / 255, blue: 0x1b / 255)
    static let tour = Color(red: 0xb0 / 255, green: 0x65 / 255, blue: 0x2a / 255)
    static func hex(_ h: String) -> Color {
        if h == "red" { return red }
        var s = h; if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return muted }
        return Color(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

let MONTHS = ["JANUAR", "FEBRUAR", "MARS", "APRIL", "MAI", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"]
let WD = ["M", "Ti", "O", "To", "F", "L", "S"]
let WD_LONG = ["MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG", "SØNDAG"]

struct NativeRoot: View {
    @StateObject private var store = Store()
    @State private var open: String? = nil
    @State private var detent: PresentationDetent = .medium

    var body: some View {
        // ONE SHEET, ITS PAGE TURNED: tapping another day changes the day inside the
        // sheet that is already up, so it keeps its height instead of being re-presented
        MonthScreen(store: store, open: $open)
            .sheet(isPresented: Binding(get: { open != nil }, set: { if !$0 { open = nil } }),
                   onDismiss: { detent = .medium }) {
                DaySheet(store: store, date: open ?? Day.today)
                    .presentationDetents([.medium, .large], selection: $detent)
                    .presentationDragIndicator(.visible)
                    .presentationBackground(Ink.paper)
                    // the month stays live under a half sheet: tap another day and the
                    // sheet turns to it, as a page under the hand
                    .presentationBackgroundInteraction(.enabled(upThrough: .medium))
            }
    }
}

struct MonthScreen: View {
    @ObservedObject var store: Store
    @Binding var open: String?
    @State private var drag: CGFloat = 0

    var body: some View {
        let data = store.almanac.month(store.year, store.month)
        let hasTour = data.rows.contains { $0.tour != nil }
        VStack(spacing: 0) {
            header
            GeometryReader { geo in
                let rowH = geo.size.height / CGFloat(data.rows.count)
                VStack(spacing: 0) {
                    ForEach(data.rows) { r in
                        DayRow(row: r, nLanes: data.nLanes, hasTour: hasTour, height: rowH, open: open == r.date)
                            .contentShape(Rectangle())
                            .onTapGesture { open = r.date }
                    }
                }
                .background(Ink.paper)
                .overlay(Rectangle().stroke(Ink.ink, lineWidth: 1))
                .offset(x: drag)
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 6)
        }
        .background(Ink.ground.ignoresSafeArea())
        // A SIDEWAYS SWIPE IS A MONTH, the phone's own gesture: the page follows the
        // finger and lets go into the next month or back
        .gesture(DragGesture(minimumDistance: 20)
            .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.6 } }
            .onEnded { v in
                let dx = v.translation.width, dy = v.translation.height
                withAnimation(.easeOut(duration: 0.18)) { drag = 0 }
                if abs(dx) > 60 && abs(dx) > abs(dy) { store.step(dx < 0 ? 1 : -1) }
                else if abs(dy) > 90 && abs(dy) > 2 * abs(dx) { store.step(dy < 0 ? 12 : -12) }   // up and down is a year
            })
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(MONTHS[store.month]).font(.system(size: 26, weight: .semibold)).tracking(1.5).foregroundStyle(Ink.ink)
            Text(String(store.year)).font(.system(size: 15, weight: .regular)).tracking(1).foregroundStyle(Ink.muted)
            Spacer()
            Button { withAnimation { store.goToday() } } label: {
                Text("I DAG").font(.system(size: 12, weight: .semibold)).tracking(1.2)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(Ink.ink, lineWidth: 1))
            }
            .foregroundStyle(Ink.ink)
        }
        .padding(.horizontal, 14).padding(.top, 6).padding(.bottom, 8)
    }
}

// ---------- one day ----------

struct DayRow: View {
    let row: MonthRow
    let nLanes: Int
    let hasTour: Bool
    let height: CGFloat
    let open: Bool

    var body: some View {
        HStack(spacing: 0) {
            figure.frame(width: 28, alignment: .trailing)
            Text(WD[row.wi]).font(.system(size: 10)).foregroundStyle(row.red ? Ink.red : Ink.muted)
                .frame(width: 20, alignment: .leading).padding(.leading, 4)
            gutter
            DayLine(parts: row.parts).frame(maxWidth: .infinity, alignment: .leading).padding(.leading, 4)
            if hasTour { tourCell.frame(width: 70) }
            info.frame(width: 58, alignment: .trailing).padding(.trailing, 6)
        }
        .frame(height: height)
        .background(open ? Ink.wash : (row.sun || !row.hol.isEmpty ? Ink.wash : Ink.paper))
        .overlay(alignment: .bottom) {
            Rectangle().fill(row.sun ? Ink.ink : Ink.rule).frame(height: row.sun ? 1 : 0.5)
        }
    }

    private var figure: some View {
        Text("\(row.d)")
            .font(.system(size: 13, weight: .medium).monospacedDigit())
            .foregroundStyle(row.today ? Ink.paper : (row.red ? Ink.red : Ink.ink))
            .padding(.horizontal, row.today ? 3 : 0)
            .background(row.today ? RoundedRectangle(cornerRadius: 3).fill(Ink.ink) : nil)
    }

    private var gutter: some View {
        HStack(spacing: 3) {
            ForEach(0..<nLanes, id: \.self) { l in
                if let lane = row.lanes[l] {
                    Rectangle().fill(Ink.hex(lane.color)).frame(width: 2)
                        .padding(.top, lane.a ? 3 : 0).padding(.bottom, lane.z ? 3 : 0)
                } else { Color.clear.frame(width: 2) }
            }
        }
        .padding(.horizontal, nLanes > 0 ? 2 : 0)
    }

    @ViewBuilder private var tourCell: some View {
        if let t = row.tour {
            ZStack(alignment: .leading) {
                Ink.tour.opacity(t.tbc ? 0 : 0.10)
                Rectangle().fill(Ink.tour).frame(width: 2)
                Group {
                    if t.open { Text(t.name).font(.system(size: 10, weight: .bold)).tracking(0.4).foregroundStyle(Ink.ink) }
                    else if !t.perf.isEmpty { Text(t.perf).font(.system(size: 13, weight: .bold)).foregroundStyle(Ink.red) }
                    else if !t.word.isEmpty { Text(t.word).font(.system(size: 10)).foregroundStyle(Ink.soft) }
                }
                .italic(t.tbc).lineLimit(1).padding(.leading, 6)
            }
            .overlay(alignment: .top) { if t.open { Rectangle().fill(Ink.tour).frame(height: 1) } }
        } else { Color.clear }
    }

    @ViewBuilder private var info: some View {
        if let i = row.info {
            switch i.kind {
            case .uke: Text(i.text).font(.system(size: 10)).tracking(0.4).foregroundStyle(Ink.muted)
            case .hn: Text(i.text).font(.system(size: i.text.count > 9 ? 9 : 10)).italic().foregroundStyle(row.red ? Ink.red : Ink.soft)
            case .cty: Text(i.text.uppercased()).font(.system(size: i.text.count > 6 ? 9 : 10, weight: i.tbc ? .regular : .semibold))
                    .italic(i.tbc).tracking(0.8).foregroundStyle(Ink.soft)
            }
        } else { Color.clear }   // an empty cell keeps its width, or the tour column slides
    }
}

// WHOLE ENTRIES, THEN +n (clipLines): the first entry always stands, cut short if it must
struct DayLine: View {
    let parts: [MonthRow.Part]

    var body: some View {
        GeometryReader { geo in
            let (shown, hidden) = fit(width: geo.size.width)
            HStack(spacing: 8) {
                ForEach(Array(parts.prefix(shown).enumerated()), id: \.offset) { i, p in
                    entry(p).lineLimit(1).layoutPriority(i == 0 ? 0 : 1).fixedSize(horizontal: i > 0, vertical: false)
                }
                if hidden > 0 { Text("+\(hidden)").font(.system(size: 11)).foregroundStyle(Ink.muted).fixedSize() }
            }
            .frame(height: geo.size.height)
        }
    }

    private func entry(_ p: MonthRow.Part) -> Text {
        let colour: Color = p.show ? Ink.red : (p.pencil ? Ink.muted : (p.ink.isEmpty ? Ink.ink : Ink.hex(p.ink)))
        let clock = p.kind == .timed ? Text(p.time + " ").font(.system(size: 10)).foregroundColor(Ink.muted) : Text("")
        if p.kind == .span {
            return Text(p.text.uppercased()).font(.system(size: 10.5, weight: .semibold)).tracking(0.8).foregroundColor(colour)
        }
        return clock + Text(p.text).font(.system(size: 12)).foregroundColor(colour)
    }

    private func measure(_ p: MonthRow.Part) -> CGFloat {
        func w(_ s: String, _ f: UIFont, _ k: CGFloat = 0) -> CGFloat {
            (s as NSString).size(withAttributes: [.font: f, .kern: k]).width
        }
        switch p.kind {
        case .span: return w(p.text.uppercased(), .systemFont(ofSize: 10.5, weight: .semibold), 0.8)
        case .timed: return w(p.time + " ", .systemFont(ofSize: 10)) + w(p.text, .systemFont(ofSize: 12))
        case .allday: return w(p.text, .systemFont(ofSize: 12))
        }
    }

    private func fit(width: CGFloat) -> (Int, Int) {
        guard parts.count > 1 else { return (parts.count, 0) }
        var used: CGFloat = 0, shown = 0
        for (i, p) in parts.enumerated() {
            let room: CGFloat = i < parts.count - 1 ? 26 : 0
            used += measure(p) + (i > 0 ? 8 : 0)
            if i > 0 && used > width - room { break }
            shown += 1
        }
        return (shown, parts.count - shown)
    }
}

// ---------- the day sheet: the phone's own sheet, read first (stage 1: reading only) ----------

struct DaySheet: View {
    @ObservedObject var store: Store
    let date: String
    @State private var viewing: String? = nil

    var body: some View {
        content.onChange(of: date) { viewing = nil }
    }

    @ViewBuilder private var content: some View {
        let alm = store.almanac
        let wi = Day.weekdayIdx(date)
        let hol = Holidays.of(Int(date.prefix(4))!)[date]
        let row = alm.month(Int(date.prefix(4))!, Int(date.dropFirst(5).prefix(2))! - 1).rows.first { $0.date == date }
        let list = alm.day(date)
        let tour = alm.tourCalIds
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(Int(date.suffix(2))!)").font(.system(size: 44, weight: .semibold)).foregroundStyle(wi == 6 || (hol?.red ?? false) ? Ink.red : Ink.ink)
                    Text(WD_LONG[wi]).font(.system(size: 13, weight: .semibold)).tracking(2).foregroundStyle(Ink.ink)
                    Spacer()
                    if let c = row?.city, !c.isEmpty { Text(c.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(1.2).foregroundStyle(Ink.soft) }
                    if let h = hol { Text(h.name).font(.system(size: 12)).italic().foregroundStyle(h.red ? Ink.red : Ink.soft) }
                    Text("uke \(Day.isoWeek(date))").font(.system(size: 12)).foregroundStyle(Ink.muted)
                }
                .padding(.top, 22).padding(.bottom, 10)
                Rectangle().fill(Ink.ink).frame(height: 1)
                if list.isEmpty {
                    Text("Ingenting denne dagen.").font(.system(size: 14)).foregroundStyle(Ink.muted).padding(.vertical, 16)
                }
                ForEach(list) { e in
                    eventRow(e, alm: alm, wg: tour.contains(e.calId))
                    Rectangle().fill(Ink.rule).frame(height: 0.5)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    @ViewBuilder private func eventRow(_ e: CalEvent, alm: Almanac, wg: Bool) -> some View {
        let t = Rules.effTime(e)
        let pencil = Rules.isPencil(e) || Rules.isTbc(e)
        let colour: Color = Rules.isShow(e) ? Ink.red : (pencil ? Ink.muted : Ink.ink)
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(t).font(.system(size: 12).monospacedDigit()).foregroundStyle(Ink.muted).frame(width: 40, alignment: .leading)
                Circle().fill(Ink.hex(alm.color(e))).frame(width: 7, height: 7)
                Text(t.isEmpty ? e.title.deco : Rules.stripClock(e.title.deco)).font(.system(size: 17)).foregroundStyle(colour)
                Spacer(minLength: 4)
                Text(e.isSpan ? range(e) : (alm.calendars.first { $0.id == e.calId }?.name ?? ""))
                    .font(.system(size: 11)).foregroundStyle(Ink.muted)
            }
            if viewing == e.id { details(e, alm: alm).padding(.leading, 48) }
        }
        .padding(.vertical, 12)
        .opacity(wg ? 0.75 : 1)
        .contentShape(Rectangle())
        .onTapGesture { withAnimation(.easeOut(duration: 0.15)) { viewing = viewing == e.id ? nil : e.id } }
    }

    @ViewBuilder private func details(_ e: CalEvent, alm: Almanac) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !e.location.isEmpty { Text(e.location).font(.system(size: 14)).foregroundStyle(Ink.soft) }
            let notes = RX.sub("^P[ \\t]*(?:\\r?\\n(?:[ \\t]*\\r?\\n)?|$)", e.notes, "")
            if !notes.isEmpty { NoteText(raw: notes) }
            Text(alm.calendars.first { $0.id == e.calId }?.name ?? "").font(.system(size: 12)).foregroundStyle(Ink.muted)
        }
    }

    private func range(_ e: CalEvent) -> String {
        let a = Int(e.start.suffix(2))!, b = Int(e.end.suffix(2))!
        return "\(a)–\(b)"
    }
}

// A note's links are links, and a mail link reads "✉ Åpne e-posten" and opens Mail (linkify)
struct NoteText: View {
    let raw: String
    var body: some View {
        var s = RX.sub("<a\\b[^>]*href\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>[\\s\\S]*?</a>", raw, " $1 ", ci: true)
        s = RX.sub("<br\\s*/?>|</p>|</div>", s, "\n", ci: true)
        s = RX.sub("<[^>]+>", s, "").deco
        var out = AttributedString()
        let re = RX.re("(https?://[^\\s<>\"]+|message:/{0,2}[^\\s\"]+|mailto:[^\\s<>\"]+|tel:[+\\d][\\d\\s-]*\\d)", true)
        var last = s.startIndex
        for m in re.matches(in: s, range: NSRange(s.startIndex..., in: s)) {
            guard let r = Range(m.range, in: s) else { continue }
            out += AttributedString(String(s[last..<r.lowerBound]))
            let url = String(s[r])
            let mail = url.lowercased().hasPrefix("message:") || RX.test("^https?://(mail\\.google\\.com|outlook\\.(live|office|office365)\\.com/mail|www\\.icloud\\.com/mail)", url, ci: true)
            var a = AttributedString(mail ? "✉ Åpne e-posten" : (url.hasPrefix("http") ? (URL(string: url)?.host ?? url) + " ↗" : url))
            a.link = URL(string: url)
            out += a
            last = r.upperBound
        }
        out += AttributedString(String(s[last...]))
        return Text(out).font(.system(size: 14)).foregroundStyle(Ink.ink).tint(Ink.ink)
    }
}
#endif
