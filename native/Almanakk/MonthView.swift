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
    static let tourInk = Color(red: 0x8a / 255, green: 0x4a / 255, blue: 0x1c / 255)  // the tour's colour, dark enough to read
    static let onInkSoft = Color(red: 0xc8 / 255, green: 0xc8 / 255, blue: 0xc2 / 255)   // muted words on today's ink
    static let onInkRed = Color(red: 0xff / 255, green: 0x8a / 255, blue: 0x7a / 255)    // red that reads on ink
    /// READING GLASSES (Alan, 10.10; backlog L2): one switch, every word a size larger
    static var scale: CGFloat { UserDefaults.standard.bool(forKey: "almanakk.large") ? 1.2 : 1.0 }
    static func hex(_ h: String) -> Color {
        if h == "red" { return red }
        var s = h; if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return muted }
        return Color(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

var MONTHS: [String] { englishUI ? ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
                                  : ["JANUAR", "FEBRUAR", "MARS", "APRIL", "MAI", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"] }
var WD: [String] { englishUI ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] : ["M", "Ti", "O", "To", "F", "L", "S"] }
var WD_LONG: [String] { englishUI ? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
                                  : ["MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG", "SØNDAG"] }

struct NativeRoot: View {
    @StateObject private var store = Store()
    @StateObject private var rem = TodoStore()
    @State private var showTodo = false
    @AppStorage("almanakk.large") private var large = false
    @AppStorage("almanakk.lang") private var lang = "no"
    @Environment(\.undoManager) private var undoManager
    @Environment(\.scenePhase) private var phase
    @State private var open: String? = nil
    @State private var detent: PresentationDetent = .medium
    @State private var path: [Route] = []
    @State private var selected: String? = nil      // a day picked in the year: marked, no sheet
    @State private var weekPick: String? = nil      // a day picked in a widget: marked in its week

    /// to a day's week, from anywhere: the sheet steps aside, the week slides in
    private func toWeek(_ ds: String) {
        open = nil
        path = [.week(Almanac.monday(ds))]
    }
    private func toYear() { open = nil; path = [.year(store.year)] }
    /// a tap on a day in a widget: that day's week, the day marked (Alan, 11.10)
    private func openURL(_ url: URL) {
        guard url.scheme == "almanakk", url.host == "day" else { return }
        let ds = url.lastPathComponent
        guard ds.count == 10 else { return }
        let c = Day.greg.dateComponents([.year, .month], from: Day.date(ds))
        store.year = c.year!; store.month = c.month! - 1
        open = nil; weekPick = ds
        path = [.week(Almanac.monday(ds))]
    }
    /// from the year back to a month, with the tapped day marked (Alan, 10.10: "I land on
    /// September 19 … highlighted as a selected day … not the drawer open")
    private func pick(_ day: String?, _ y: Int, _ m: Int) {
        store.year = y; store.month = m
        if store.demo { store.loadDemo() }
        selected = day
        path = []
    }

    var body: some View {
        // THE MONTH IS HOME; THE WEEK IS PUSHED ON IT, with the phone's own back button and
        // back swipe, "‹ Oktober" (Alan, 10.10: "opening a week from month view has no back")
        NavigationStack(path: $path) {
            MonthScreen(store: store, rem: rem, open: $open, selected: $selected, showTodo: $showTodo, toWeek: toWeek, toYear: toYear)
                .id("\(large)\(lang)")   // either switch redraws the whole almanac
                .toolbar(.hidden, for: .navigationBar)
                .navigationTitle(MONTHS[store.month].capitalized)
                .navigationDestination(for: Route.self) { r in
                    switch r {
                    case .week(let mon): WeekScreen(store: store, monday: mon, open: $open, picked: weekPick, toMonth: { path = [] })
                    case .year(let y): YearScreen(store: store, year: y, pick: pick)
                    }
                }
        }
        // ONE SHEET, ITS PAGE TURNED: tapping another day changes the day inside the
        // sheet that is already up, so it keeps its height instead of being re-presented
            .sheet(isPresented: Binding(get: { open != nil }, set: { if !$0 { open = nil } }),
                   onDismiss: { detent = .medium }) {
                DaySheet(store: store, rem: rem, date: open ?? Day.today, toWeek: toWeek)
                    .presentationDetents([.medium, .large], selection: $detent)
                    .presentationDragIndicator(.visible)
                    .presentationBackground(Ink.paper)
                    // the month stays live under a half sheet: tap another day and the
                    // sheet turns to it, as a page under the hand
                    .presentationBackgroundInteraction(.enabled(upThrough: .medium))
            }
            // fresh from Google when the app opens and whenever it comes forward again
            .onOpenURL(perform: openURL)
            // GJØREMÅL: its own page over the almanac
            .fullScreenCover(isPresented: $showTodo) { TodoView(todo: rem) }
            .task { await rem.load() }
            .task { store.undo = undoManager; await store.refresh() }
            .onChange(of: undoManager) { store.undo = undoManager }
            .onChange(of: phase) { if phase == .active { Task { await store.refresh(); await rem.load() } } }
    }
}

struct MonthScreen: View {
    @ObservedObject var store: Store
    @ObservedObject var rem: TodoStore
    @Binding var open: String?
    @Binding var selected: String?
    @Binding var showTodo: Bool
    var toWeek: (String) -> Void = { _ in }
    var toYear: () -> Void = {}
    @State private var drag: CGFloat = 0
    @State private var scrub: Int? = nil            // the row under a held thumb

    var body: some View {
        let data = store.almanac.month(store.year, store.month)
        let hasTour = data.rows.contains { $0.tour != nil }
        VStack(spacing: 0) {
            header
            GeometryReader { geo in
                let rowH = geo.size.height / CGFloat(data.rows.count)
                VStack(spacing: 0) {
                    ForEach(data.rows) { r in
                        DayRow(row: r, nLanes: data.nLanes, hasTour: hasTour, height: rowH, open: open == r.date, toWeek: toWeek)
                            // A DAY PICKED IN THE YEAR is outlined in ink, unmistakable, no sheet
                            .overlay(selected == r.date ? Rectangle().stroke(Ink.ink, lineWidth: 2).padding(1) : nil)
                            .contentShape(Rectangle())
                            // THE RIGHT FIFTH OF A ROW OPENS ITS WEEK (Alan, 11.10, his sketch: the
                            // strip over the right-hand column, top to bottom); the rest opens the day
                            .onTapGesture(coordinateSpace: .local) { loc in
                                if loc.x > geo.size.width * 0.8 { toWeek(r.date) } else { selected = nil; open = r.date }
                            }
                    }
                }
                .background(Ink.paper)
                .overlay(Rectangle().stroke(Ink.ink, lineWidth: 1))
                // THE MAGNIFIER (Alan, 10.10: "holding my thumb and then making the day I am
                // selecting bigger"): hold, the row under the thumb lifts out at half again
                // its size above the finger; slide to the right day; let go and it opens.
                // A plain tap still opens at once; this is for the half-fingertip rows.
                .overlay(alignment: .topLeading) {
                    if let i = scrub, data.rows.indices.contains(i) {
                        let r = data.rows[i]
                        // drawn at two thirds of the width, then enlarged from its left edge, so
                        // at half again the size it fills the width exactly: the date stays in view
                        DayRow(row: r, nLanes: data.nLanes, hasTour: hasTour, height: rowH, open: true)
                            .frame(width: geo.size.width / 1.5)
                            .background(Ink.paper)
                            .overlay(Rectangle().stroke(Ink.ink, lineWidth: 1))
                            .scaleEffect(1.5, anchor: .topLeading)
                            .shadow(color: .black.opacity(0.25), radius: 8, y: 3)
                            .offset(y: max(0, CGFloat(i) * rowH - rowH * 2.4))
                            .allowsHitTesting(false)
                    }
                }
                .gesture(LongPressGesture(minimumDuration: 0.35)
                    .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .local))
                    .onChanged { v in
                        if case .second(true, let d?) = v {
                            let i = min(data.rows.count - 1, max(0, Int(d.location.y / rowH)))
                            if i != scrub { scrub = i; UISelectionFeedbackGenerator().selectionChanged() }
                        } else if case .second(true, nil) = v, scrub == nil {
                            scrub = 0
                        }
                    }
                    .onEnded { _ in
                        if let i = scrub, data.rows.indices.contains(i) { selected = nil; open = data.rows[i].date }
                        scrub = nil
                    })
                .offset(x: drag)
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 6)
        }
        .background(Ink.ground.ignoresSafeArea())
        // ARROW KEYS, for a keyboard and for iPhone Mirroring on the Mac, where there is no
        // swipe (Alan, 10.10): left and right are a month, up and down a year
        .background {
            Group {
                Button("") { withAnimation { store.step(-1) } }.keyboardShortcut(.leftArrow, modifiers: [])
                Button("") { withAnimation { store.step(1) } }.keyboardShortcut(.rightArrow, modifiers: [])
                Button("") { withAnimation { store.step(-12) } }.keyboardShortcut(.upArrow, modifiers: [])
                Button("") { withAnimation { store.step(12) } }.keyboardShortcut(.downArrow, modifiers: [])
            }
            .opacity(0).accessibilityHidden(true)
        }
        // A SIDEWAYS SWIPE IS A MONTH. The page no longer follows the finger (Alan, 11.10:
        // "a bounce effect … and the border around the month glitches after"): the swipe
        // is read when it ends and the next month is simply there
        .gesture(DragGesture(minimumDistance: 20)
            // while a sheet is up its own drags belong to it: closing it must not step the month
            .onEnded { v in
                guard open == nil else { drag = 0; return }
                let dx = v.translation.width, dy = v.translation.height
                                if abs(dx) > 60 && abs(dx) > abs(dy) { store.step(dx < 0 ? 1 : -1) }
                else if abs(dy) > 90 && abs(dy) > 2 * abs(dx) { store.step(dy < 0 ? 12 : -12) }   // up and down is a year
            })
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(MONTHS[store.month]).font(.system(size: (26) * Ink.scale, weight: .semibold)).tracking(1.5).foregroundStyle(Ink.ink)
                    // the year opens the year
                Button { toYear() } label: {
                    Text(String(store.year)).font(.system(size: (15) * Ink.scale, weight: .regular)).tracking(1).foregroundStyle(Ink.muted)
                }
                if store.loading { ProgressView().controlSize(.mini) }
                if store.pendingCount > 0 {
                    Text(T("\(store.pendingCount) venter på nett", "\(store.pendingCount) waiting for network"))
                        .font(.system(size: (11) * Ink.scale)).foregroundStyle(Ink.muted)
                }
                Spacer()
                // ☐ n — the to-do list, its own page (Alan, 11.10)
                Button { open = nil; showTodo = true } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "square").font(.system(size: (13) * Ink.scale, weight: .medium))
                        if rem.granted && rem.openCount > 0 { Text("\(rem.openCount)").font(.system(size: (13) * Ink.scale, weight: .medium).monospacedDigit()) }
                    }
                    .foregroundStyle(Ink.ink).frame(minWidth: 34, minHeight: 30).contentShape(Rectangle())
                }
                .accessibilityLabel(T("Gjøremål", "To-do"))
                // the quiet menu: the few switches, out of the way (L3)
                Menu {
                    Toggle("English", isOn: Binding(get: { englishUI }, set: { UserDefaults.standard.set($0 ? "en" : "no", forKey: "almanakk.lang") }))
                    Toggle(T("Større tekst", "Larger text"), isOn: Binding(get: { UserDefaults.standard.bool(forKey: "almanakk.large") },
                                                          set: { UserDefaults.standard.set($0, forKey: "almanakk.large") }))
                    if !store.demo { Button(T("Logg ut av Google", "Sign out of Google"), role: .destructive) { store.signOut() } }
                } label: {
                    Image(systemName: "ellipsis").font(.system(size: (17) * Ink.scale, weight: .semibold)).foregroundStyle(Ink.ink)
                        .frame(width: 34, height: 30).contentShape(Rectangle())
                }
                .accessibilityLabel(T("Mer", "More"))
                Button { withAnimation { store.goToday() } } label: {
                    Text(T("I DAG", "TODAY")).font(.system(size: (12) * Ink.scale, weight: .semibold)).tracking(1.2)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .overlay(RoundedRectangle(cornerRadius: 5).stroke(Ink.ink, lineWidth: 1))
                }
                .foregroundStyle(Ink.ink)
            }
            // SIGNED OUT: ONE BUTTON, nothing else (Alan, 10.10)
            if store.demo && !Store.demoWanted {
                Button { Task { await store.signIn() } } label: {
                    Text(T("Logg inn med Google", "Sign in with Google")).font(.system(size: (15) * Ink.scale, weight: .semibold))
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Ink.ink, lineWidth: 1))
                }
                .foregroundStyle(Ink.ink).padding(.top, 6)
            }
            if let p = store.problem {
                Text(p).font(.system(size: (12) * Ink.scale)).foregroundStyle(Ink.red).lineLimit(2)
            }
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
    var toWeek: (String) -> Void = { _ in }

    var body: some View {
        HStack(spacing: 0) {
            // THE DAY'S FIGURE OPENS ITS WEEK (as in the web month, 08.10); the rest of the row opens the day
            HStack(spacing: 0) {
                figure.frame(width: 28, alignment: .trailing)
                Text(WD[row.wi]).font(.system(size: (10) * Ink.scale)).foregroundStyle(row.today ? Ink.onInkSoft : (row.red ? Ink.red : Ink.muted))
                    .frame(width: 24, alignment: .leading).padding(.leading, 4)
                    // THE MOON on the day it turns (Alan, 11.10), small, at the letter's side
                    .overlay(alignment: .trailing) {
                        if let m = Moon.turn(row.date) {
                            Text(m.glyph).font(.system(size: (7) * Ink.scale)).foregroundStyle(row.today ? Ink.onInkSoft : Ink.soft)
                                .accessibilityLabel(m.name)
                        }
                    }
            }
            .frame(maxHeight: .infinity).contentShape(Rectangle())
            .onTapGesture { toWeek(row.date) }
            gutter
            DayLine(parts: row.parts, inverted: row.today).frame(maxWidth: .infinity, alignment: .leading).padding(.leading, 4)
            // a day outside any tour gives the tour column to its line (.day.notour in the web)
            if hasTour && (row.tour != nil || row.head != nil) { tourCell.frame(width: 96).background(row.today && row.tour != nil ? Ink.paper : .clear) }
            info.frame(width: 52, alignment: .trailing).padding(.trailing, 6)
        }
        .frame(height: height)
        // TODAY IS THE WHOLE ROW IN INK (Alan's pick B, 10.10: the box round the figure
        // was not enough)
        .background(row.today ? Ink.ink : (open ? Ink.wash : (row.sun || !row.hol.isEmpty ? Ink.wash : Ink.paper)))
        .overlay(alignment: .bottom) {
            Rectangle().fill(row.sun ? Ink.ink : Ink.rule).frame(height: row.sun ? 1 : 0.5)
        }
    }

    private var figure: some View {
        Text("\(row.d)")
            .font(.system(size: (14) * Ink.scale, weight: .medium).monospacedDigit())
            .foregroundStyle(row.today ? (row.red ? Ink.onInkRed : Ink.paper) : (row.red ? Ink.red : Ink.ink))
    }

    private var gutter: some View {
        // FOUR POINTS, SIX APART, SQUARE ENDS (Alan's pick, 10.10: the 2pt lines were too
        // thin and too close to tell apart on the phone)
        // THE LINE STARTS AFTER THE LAST LANE IN USE THAT DAY (Alan, 10.10: Vildanden's
        // title stood far from its line, wedged off by an empty lane for a span that only
        // began on the 14th). Empty lanes to the right of the last one are not drawn.
        let used = (row.lanes.lastIndex { $0 != nil } ?? -1) + 1
        return HStack(spacing: 6) {
            ForEach(0..<used, id: \.self) { l in
                if let lane = row.lanes[l] {
                    Rectangle().fill(Ink.hex(lane.color).opacity(lane.faint ? 0.35 : 1)).frame(width: 4)
                        .padding(.top, lane.a ? 3 : 0).padding(.bottom, lane.z ? 3 : 0)
                } else { Color.clear.frame(width: 4) }
            }
        }
        .padding(.horizontal, used > 0 ? 2 : 0)
    }

    @ViewBuilder private var tourCell: some View {
        if let t = row.tour {
            ZStack(alignment: .leading) {
                Ink.tour.opacity(t.tbc ? 0 : 0.10)
                Rectangle().fill(Ink.tour).frame(width: 2)
                Group {
                    // a tour running on from last month: its name only; his own city column says the rest
                    if t.open { nameAndCity(t.name, t.continues ? "" : t.city) }
                    else if !t.perf.isEmpty { Text(t.perf).font(.system(size: (13) * Ink.scale, weight: .bold)).foregroundStyle(Ink.red) }
                    else if !t.word.isEmpty { Text(t.word).font(.system(size: (10) * Ink.scale)).foregroundStyle(Ink.soft) }
                }
                .italic(t.tbc).lineLimit(1).padding(.leading, 6)
            }
            .overlay(alignment: .top) { if t.open { Rectangle().fill(Ink.tour).frame(height: 1) } }
        } else if let h = row.head {
            // THE HEADING (Alan's option 2, 10.10): the day keeps its own ground — the band
            // does not start here — and the name and city stand in the tour's colour. Full size, never shrunk (his eyesight): a
            // long name runs on to the right over an empty cell; with something there, the
            // city is cut before the name.
            // (Alan, 10.10, second look: no underline — it only ran under half the words —
            // but the band's own left rule climbs into the heading row, with no tint, so
            // the name hangs on the band without claiming the day)
            Color.clear
                .overlay(alignment: .leading) { Rectangle().fill(Ink.tour).frame(width: 2) }
                .overlay(alignment: .bottomLeading) {
                    let free = row.info == nil
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(h.name).font(.system(size: (11) * Ink.scale, weight: .bold)).tracking(0.4).fixedSize()
                        if !h.city.isEmpty {
                            Text(h.city).font(.system(size: (11) * Ink.scale)).lineLimit(1)
                                .fixedSize(horizontal: free, vertical: false)
                        }
                    }
                    .italic(h.tbc)
                    // BLACK INK (Alan, 10.10): the brown read as red beside the shows, and black
                    // reads better; the climbing rule already ties it to its band
                    .foregroundStyle(Ink.ink)
                    .padding(.leading, 6).padding(.bottom, 4)
                    .frame(width: free ? nil : 96, alignment: .leading)
                }
        } else { Color.clear }
    }

    /// THE NAME AND ITS CITY side by side (Alan, 10.10: "city name next to title")
    private func nameAndCity(_ name: String, _ city: String) -> some View {
        (Text(name).font(.system(size: (10) * Ink.scale, weight: .bold)).tracking(0.4)
         + Text(city.isEmpty ? "" : " " + city).font(.system(size: (10) * Ink.scale)))
            .foregroundStyle(Ink.ink).truncationMode(.tail)
    }

    private var info: some View {
        // ONE LINE, ALWAYS: a long city shrinks a little rather than break ("FRANKFU / RT")
        infoText.lineLimit(1).minimumScaleFactor(0.7)
    }
    @ViewBuilder private var infoText: some View {
        if let i = row.info {
            switch i.kind {
            case .uke: Text(i.text).font(.system(size: (10) * Ink.scale)).tracking(0.4).foregroundStyle(row.today ? Ink.onInkSoft : Ink.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing).contentShape(Rectangle())
                    .onTapGesture { toWeek(row.date) }   // THE WEEK NUMBER IS THE WEEK'S HANDLE
            case .hn: Text(i.text).font(.system(size: (i.text.count > 9 ? 9 : 10) * Ink.scale)).italic().foregroundStyle(row.today ? Ink.onInkSoft : (row.red ? Ink.red : Ink.soft))
            case .cty: Text(i.text.uppercased()).font(.system(size: (i.text.count > 6 ? 9 : 10) * Ink.scale, weight: i.tbc ? .regular : .semibold))
                    .italic(i.tbc).tracking(0.8).foregroundStyle(row.today ? Ink.paper : Ink.soft)
            }
        } else { Color.clear }   // an empty cell keeps its width, or the tour column slides
    }
}

// WHOLE ENTRIES, THEN +n (clipLines): the first entry always stands, cut short if it must
struct DayLine: View {
    let parts: [MonthRow.Part]
    var inverted = false       // today's row: words in paper on ink

    var body: some View {
        GeometryReader { geo in
            let (shown, hidden) = fit(width: geo.size.width)
            HStack(spacing: 8) {
                ForEach(Array(parts.prefix(shown).enumerated()), id: \.offset) { i, p in
                    entry(p).lineLimit(1).layoutPriority(i == 0 ? 0 : 1).fixedSize(horizontal: i > 0, vertical: false)
                }
                if hidden > 0 { Text("+\(hidden)").font(.system(size: (11) * Ink.scale)).foregroundStyle(inverted ? Ink.onInkSoft : Ink.muted).fixedSize() }
            }
            .frame(height: geo.size.height)
        }
    }

    private func entry(_ p: MonthRow.Part) -> Text {
        let colour: Color = inverted ? (p.show ? Ink.onInkRed : (p.pencil ? Ink.onInkSoft : Ink.paper))
            : (p.show ? Ink.red : (p.pencil ? Ink.muted : (p.ink.isEmpty ? Ink.ink : Ink.hex(p.ink))))
        let clock = p.kind == .timed ? Text(p.time + " ").font(.system(size: (10.5) * Ink.scale)).foregroundColor(inverted ? Ink.onInkSoft : Ink.muted) : Text("")
        if p.kind == .span {
            return Text(p.text.uppercased()).font(.system(size: (11) * Ink.scale, weight: .semibold)).tracking(0.8).foregroundColor(colour)
        }
        return clock + Text(p.text).font(.system(size: (13) * Ink.scale)).foregroundColor(colour)
    }

    private func measure(_ p: MonthRow.Part) -> CGFloat {
        func w(_ s: String, _ f: UIFont, _ k: CGFloat = 0) -> CGFloat {
            (s as NSString).size(withAttributes: [.font: f, .kern: k]).width
        }
        switch p.kind {
        case .span: return w(p.text.uppercased(), .systemFont(ofSize: 11 * Ink.scale, weight: .semibold), 0.8)
        case .timed: return w(p.time + " ", .systemFont(ofSize: 10.5 * Ink.scale)) + w(p.text, .systemFont(ofSize: 13 * Ink.scale))
        case .allday: return w(p.text, .systemFont(ofSize: 13 * Ink.scale))
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

// ---------- the day sheet: the phone's own sheet, read first, written from ----------

struct DaySheet: View {
    @ObservedObject var store: Store
    @ObservedObject var rem: TodoStore
    let date: String
    var toWeek: (String) -> Void = { _ in }
    @State private var viewing: String? = nil
    /// the form's job travels as ONE value, so the event being edited cannot be lost
    /// between two state changes (it was: T("Endre", "Edit") opened as T("Ny hendelse", "New event"))
    struct FormJob: Identifiable { let id = UUID(); var draft: Draft; var editing: CalEvent? }
    @State private var form: FormJob? = nil
    @Environment(\.dismiss) private var dismissSheet

    var body: some View {
        content
            .onChange(of: date) { viewing = nil }
            .overlay(alignment: .bottom) { ToastBar(store: store) }
            .sheet(item: $form) { job in
                EventForm(store: store, draft: job.draft, editing: job.editing, cityZone: cityZone, city: city)
                    .presentationDetents([.large])
                    .environment(\.locale, Locale(identifier: "nb_NO"))
            }
    }

    private var row: MonthRow? {
        store.almanac.month(Int(date.prefix(4))!, Int(date.dropFirst(5).prefix(2))! - 1).rows.first { $0.date == date }
    }
    private var city: String { row?.city ?? "" }
    /// a new event's clock is the time where he will be that day (CONVENTIONS 16)
    private var cityZone: String { Places.zone(for: city) }

    @ViewBuilder private var content: some View {
        let alm = store.almanac
        let wi = Day.weekdayIdx(date)
        let hol = Holidays.of(Int(date.prefix(4))!)[date]
        let row = self.row
        let list = alm.day(date)
        let tour = alm.tourCalIds
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(Int(date.suffix(2))!)").font(.system(size: (44) * Ink.scale, weight: .semibold)).foregroundStyle(wi == 6 || (hol?.red ?? false) ? Ink.red : Ink.ink)
                    Text(WD_LONG[wi]).font(.system(size: (13) * Ink.scale, weight: .semibold)).tracking(2).foregroundStyle(Ink.ink)
                    if let m = Moon.turn(date) {
                        Text("\(m.glyph) \(m.name.lowercased())").font(.system(size: (11) * Ink.scale)).foregroundStyle(Ink.muted)
                    }
                    Spacer()
                    if let c = row?.city, !c.isEmpty { Text(c.uppercased()).font(.system(size: (12) * Ink.scale, weight: .semibold)).tracking(1.2).foregroundStyle(Ink.soft) }
                    if let h = hol { Text(h.name).font(.system(size: (12) * Ink.scale)).italic().foregroundStyle(h.red ? Ink.red : Ink.soft) }
                    // the sheet's week number opens that day's week: any day, also a week that
                    // began last month and has no "uke" cell in this one (Alan, 10.10)
                    Button { toWeek(date) } label: {
                        Text(T("uke", "week") + " \(Day.isoWeek(date)) ›").font(.system(size: (12) * Ink.scale)).foregroundStyle(Ink.soft)
                    }
                }
                .padding(.top, 22).padding(.bottom, 10)
                // A TAP ON THE TOP CLOSES THE SHEET (Alan, 09.10; native 11.10); the week
                // number's own button still opens the week
                .contentShape(Rectangle())
                .onTapGesture { dismissSheet() }
                Rectangle().fill(Ink.ink).frame(height: 1)
                if list.isEmpty {
                    Text(T("Ingenting denne dagen.", "Nothing this day.")).font(.system(size: (14) * Ink.scale)).foregroundStyle(Ink.muted).padding(.vertical, 16)
                }
                ForEach(list) { e in
                    eventRow(e, alm: alm, wg: tour.contains(e.calId))
                    Rectangle().fill(Ink.rule).frame(height: 0.5)
                }
                if let p = store.problem { Text(p).font(.system(size: (13) * Ink.scale)).foregroundStyle(Ink.red).padding(.top, 10) }
                // THE ADD LINE, quiet at the foot: the keyboard comes only when it is tapped
                AddLine(store: store, date: date, zone: cityZone) { d in
                    var d = d; if d.calId.isEmpty { d.calId = store.defaultCal }
                    form = FormJob(draft: d, editing: nil)
                }
                Color.clear.frame(height: 40)
            }
            .padding(.horizontal, 20)
        }
    }

    @ViewBuilder private func eventRow(_ e: CalEvent, alm: Almanac, wg: Bool) -> some View {
        let t = alm.clock(e, cityZone: Places.zones[city])
        let ownT = Rules.effTime(e)
        let pencil = Rules.isPencil(e) || Rules.isTbc(e)
        let colour: Color = Rules.isShow(e) ? Ink.red : (pencil ? Ink.muted : Ink.ink)
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                // START AND END (Alan, 10.10: "I wanted to know how long the flight was and had
                // to click edit to see it"): the end stands under the start
                VStack(alignment: .leading, spacing: 1) {
                    Text(t).font(.system(size: (11) * Ink.scale, weight: .medium).monospacedDigit()).foregroundStyle(Ink.soft)
                    let endShown: String = {
                        if e.minutes > 0, let r = Places.route(e.title), let z = Places.zones[r.components(separatedBy: " → ").last ?? ""],
                           let c = alm.clock(e, plus: e.minutes, in: z) { return c }
                        if e.minutes > 0, let z = Places.zones[city], let c = alm.clock(e, plus: e.minutes, in: z), t != ownT { return c }
                        return e.endTime
                    }()
                    if !endShown.isEmpty && endShown != t {
                        Text(endShown).font(.system(size: (10) * Ink.scale, weight: .medium).monospacedDigit()).foregroundStyle(Ink.soft.opacity(0.75))
                    }
                }
                .frame(width: 40, alignment: .leading)
                Circle().fill(Ink.hex(alm.color(e))).frame(width: 7, height: 7)
                Text(t.isEmpty ? e.title.deco : Rules.stripClock(e.title.deco)).font(.system(size: (17) * Ink.scale)).foregroundStyle(colour)
                Spacer(minLength: 4)
                Text(e.isSpan ? range(e) : (alm.calendars.first { $0.id == e.calId }?.name ?? ""))
                    .font(.system(size: (11) * Ink.scale)).foregroundStyle(Ink.muted)
            }
            // a flight says how long it is, and where each clock belongs
            if e.minutes > 0, let r = Places.route(e.title) {
                let parts = r.components(separatedBy: " → ")
                let a = parts.first ?? "", b = parts.last ?? ""
                let dep = Places.zones[a].flatMap { alm.clock(e, plus: 0, in: $0) } ?? ownT
                let arr = Places.zones[b].flatMap { alm.clock(e, plus: e.minutes, in: $0) } ?? e.endTime
                Text("\(a) \(dep) → \(b) \(arr) · \(e.minutes / 60) \(T("t", "h")) \(String(format: "%02d", e.minutes % 60)) min")
                    .font(.system(size: (12) * Ink.scale)).foregroundStyle(Ink.soft).padding(.leading, 48)
            }
            // shown in the day's city time: the event's own clock is named beneath it
            if t != ownT && !ownT.isEmpty {
                Text("\(ownT) \(Places.zoneLabel(e.zone))").font(.system(size: (11) * Ink.scale)).foregroundStyle(Ink.muted).padding(.leading, 48)
            }
            // a plan a booking has taken over: said, and one tap away from gone
            if alm.replacedPlans.contains(e.id) {
                HStack(spacing: 12) {
                    Text(T("erstattet av fly", "replaced by flight")).font(.system(size: (12) * Ink.scale)).italic().foregroundStyle(Ink.muted)
                    if store.writable.contains(where: { $0.id == e.calId }) {
                        Button(T("Fjern", "Remove")) { Task { await store.delete(e) } }
                            .font(.system(size: (13) * Ink.scale, weight: .semibold)).foregroundStyle(Ink.ink)
                    }
                }
                .padding(.leading, 48)
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
            if !e.location.isEmpty { Text(e.location).font(.system(size: (14) * Ink.scale)).foregroundStyle(Ink.soft) }
            // A FLIGHT: the booking reference large, a tap copies it; "Sjekk inn" copies it and
            // opens the airline's check-in (CONVENTIONS 18)
            if Places.dest(e.title) != nil, let ref = CheckIn.reference(e.notes) {
                HStack(spacing: 14) {
                    Button { UIPasteboard.general.string = ref; store.toast = .init(text: "\(ref) " + T("kopiert", "copied")) } label: {
                        Text(ref).font(.system(size: (16) * Ink.scale, weight: .semibold).monospaced()).tracking(1).foregroundStyle(Ink.ink)
                    }
                    if let a = CheckIn.airline(e), let url = URL(string: a.url) {
                        Button {
                            UIPasteboard.general.string = ref
                            UIApplication.shared.open(url)
                        } label: {
                            Text(T("Sjekk inn", "Check in") + " · \(a.name)").font(.system(size: (14) * Ink.scale, weight: .semibold))
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Ink.ink, lineWidth: 1))
                        }
                        .foregroundStyle(Ink.ink)
                    }
                }
                .padding(.vertical, 2)
            }
            let notes = RX.sub("^P[ \\t]*(?:\\r?\\n(?:[ \\t]*\\r?\\n)?|$)", e.notes, "")
            if !notes.isEmpty { NoteText(raw: notes) }
            Text(alm.calendars.first { $0.id == e.calId }?.name ?? "").font(.system(size: (12) * Ink.scale)).foregroundStyle(Ink.muted)
            // the robot's tour and the schedule are read here, never written
            if store.writable.contains(where: { $0.id == e.calId }) {
                HStack(spacing: 18) {
                    Button(T("Endre", "Edit")) {
                        form = FormJob(draft: Draft(e, zone: e.zone.isEmpty ? cityZone : e.zone), editing: e)
                    }
                    if Rules.isPencil(e) { Button(T("Bekreft", "Confirm")) { Task { await store.confirm(e) } } }
                    Button(T("Slett", "Delete"), role: .destructive) { Task { await store.delete(e); viewing = nil } }
                }
                .font(.system(size: (15) * Ink.scale, weight: .semibold)).foregroundStyle(Ink.ink)
                .padding(.top, 6)
            }
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
        return Text(out).font(.system(size: (14) * Ink.scale)).foregroundStyle(Ink.ink).tint(Ink.ink)
    }
}
#endif
