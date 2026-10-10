// THE NATIVE YEAR (stage 5, 10.10.2026), two ways of seeing it (Alan, 10.10: "I liked the
// old year view with all the little dots … but it's easier to pick months with the new
// one. Are there different year views maybe?"):
//   · MÅNEDER — twelve small months, three across: tours tinted, show days a red box with
//     a white figure (his pick C), Sundays and holidays red, today framed;
//   · PLAKAT — the poster: twelve months side by side, 31 rows, his spans as thin rules,
//     the tour as a bar, a red dot on every show — the season at a glance.
// The year in the bar is a menu of years, so two years ahead is one tap away. A tap on a
// day opens its month with that day marked, without the sheet (Alan, 10.10).
#if os(iOS)
import SwiftUI

enum Route: Hashable { case week(String), year(Int) }

struct YearScreen: View {
    @ObservedObject var store: Store
    @State var year: Int
    var pick: (String?, Int, Int) -> Void          // (day or nil, year, month): back to the month
    @AppStorage("almanakk.yearStyle") private var style = "months"
    @State private var drag: CGFloat = 0

    var body: some View {
        let data = YearData(alm: store.almanac, year: year)
        VStack(spacing: 6) {
            Picker("", selection: $style) {
                Text("Måneder").tag("months")
                Text("Plakat").tag("poster")
            }
            .pickerStyle(.segmented).padding(.horizontal, 14)
            Group {
                if style == "poster" { Poster(data: data, pick: pick) } else { MiniMonths(data: data, pick: pick) }
            }
            .offset(x: drag)
            .padding(.horizontal, 10).padding(.bottom, 6)
        }
        .background(Ink.ground.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                // QUICK JUMP: the year is a menu of years
                Menu {
                    ForEach((year - 5)...(year + 5), id: \.self) { y in
                        Button(String(y)) { withAnimation { year = y } }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(String(year)).font(.system(size: (17) * Ink.scale, weight: .semibold)).tracking(1.2)
                        Image(systemName: "chevron.down").font(.system(size: (11) * Ink.scale, weight: .semibold))
                    }
                    .foregroundStyle(Ink.ink)
                }
            }
        }
        .background {
            Group {
                Button("") { withAnimation { year -= 1 } }.keyboardShortcut(.leftArrow, modifiers: [])
                Button("") { withAnimation { year += 1 } }.keyboardShortcut(.rightArrow, modifiers: [])
            }
            .opacity(0).accessibilityHidden(true)
        }
        .gesture(DragGesture(minimumDistance: 20)
            .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.6 } }
            .onEnded { v in
                withAnimation(.easeOut(duration: 0.18)) { drag = 0 }
                if abs(v.translation.width) > 60 && abs(v.translation.width) > abs(v.translation.height) {
                    withAnimation { year += v.translation.width < 0 ? 1 : -1 }
                }
            })
        .onChange(of: year) { if store.demo { store.year = year; store.loadDemo() } }
    }
}

/// what both year pictures need, worked out once
struct YearData {
    struct Cell { var date: String; var d: Int; var wi: Int; var red: Bool; var sun: Bool; var tour: Bool; var tbc: Bool; var tourStart: Bool
        var show: Bool; var today: Bool; var rules: [String] }   // rules: colours of up to two of his spans
    let year: Int
    let months: [[Cell]]
    init(alm: Almanac, year y: Int) {
        year = y
        let hol = Holidays.of(y), today = Day.today
        let legs = alm.tour.filter(\.isSpan)
        var shows = Set(alm.own.filter { !$0.isSpan && Rules.isShow($0) }.map(\.start))
        for w in alm.tour where !w.isSpan && Rules.perfNo(w.title) != nil { shows.insert(w.start) }
        // two lanes for his spans across the year, as the old poster had them
        let spans = alm.own.filter { $0.isSpan && $0.end >= "\(y)-01-01" && $0.start <= "\(y)-12-31" }.sorted { $0.start < $1.start }
        var laneEnd = ["", ""], lane: [String: Int] = [:]
        for sp in spans { if let l = (0..<2).first(where: { laneEnd[$0] < sp.start }) { lane[sp.id] = l; laneEnd[l] = sp.end } }
        months = (0..<12).map { m in
            (1...Day.daysInMonth(y, m)).map { d in
                let ds = Day.key(y, m, d), wi = Day.weekdayIdx(ds), h = hol[ds]
                let leg = legs.first { $0.start <= ds && $0.end >= ds }
                var rules = ["", ""]
                for sp in spans where sp.start <= ds && sp.end >= ds { if let l = lane[sp.id] { rules[l] = alm.color(sp) } }
                return Cell(date: ds, d: d, wi: wi, red: wi == 6 || (h?.red ?? false), sun: wi == 6, tour: leg != nil,
                            tbc: leg.map(Rules.isTbc) ?? false, tourStart: leg?.start == ds, show: shows.contains(ds),
                            today: ds == today, rules: rules)
            }
        }
    }
}

// ---------- MÅNEDER ----------

struct MiniMonths: View {
    let data: YearData
    var pick: (String?, Int, Int) -> Void

    var body: some View {
        GeometryReader { geo in
            let colW = (geo.size.width - 16) / 3, rowH = (geo.size.height - 12) / 4
            VStack(spacing: 4) {
                ForEach(0..<4, id: \.self) { r in
                    HStack(spacing: 8) {
                        ForEach(0..<3, id: \.self) { c in mini(r * 3 + c).frame(width: colW, height: rowH) }
                    }
                }
            }
        }
    }

    private func mini(_ m: Int) -> some View {
        let cells = data.months[m]
        let lead = cells.first!.wi
        return VStack(alignment: .leading, spacing: 2) {
            Button { pick(nil, data.year, m) } label: {
                Text(MONTHS[m]).font(.system(size: (12) * Ink.scale, weight: .semibold)).tracking(1).foregroundStyle(Ink.ink)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 1) {
                ForEach(0..<7, id: \.self) { i in
                    Text(String(WD[i].prefix(1))).font(.system(size: (9) * Ink.scale)).foregroundStyle(i == 6 ? Ink.red : Ink.muted)
                }
                ForEach(0..<lead, id: \.self) { _ in Color.clear.frame(height: 18) }
                ForEach(cells, id: \.date) { c in day(c, m) }
            }
            Spacer(minLength: 0)
        }
        .padding(6)
        .background(Ink.paper)
        .overlay(Rectangle().stroke(Ink.rule, lineWidth: 0.5))
    }

    private func day(_ c: YearData.Cell, _ m: Int) -> some View {
        Text("\(c.d)")
            // as large as the cell allows (his eyesight): 12pt, not 10
            .font(.system(size: (12) * Ink.scale, weight: c.show ? .bold : .regular).monospacedDigit())
            .foregroundStyle(c.show ? Ink.paper : (c.red ? Ink.red : Ink.ink))
            .frame(maxWidth: .infinity, minHeight: 18)
            // A SHOW DAY IS A RED BOX WITH A WHITE FIGURE (his pick C, 10.10)
            .background(c.show ? Ink.red : (c.tour ? Ink.tour.opacity(c.tbc ? 0.06 : 0.16) : Color.clear))
            .overlay(c.today ? Rectangle().stroke(Ink.ink, lineWidth: 1.2) : nil)
            .contentShape(Rectangle())
            .onTapGesture { pick(c.date, data.year, m) }
    }
}

// ---------- PLAKAT ----------

struct Poster: View {
    let data: YearData
    var pick: (String?, Int, Int) -> Void

    var body: some View {
        GeometryReader { geo in
            let labelW: CGFloat = 18
            let colW = (geo.size.width - labelW) / 12
            let rowH = (geo.size.height - 16) / 31
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    Color.clear.frame(width: labelW, height: 16)
                    ForEach(0..<12, id: \.self) { m in
                        Button { pick(nil, data.year, m) } label: {
                            Text(String(MONTHS[m].prefix(3))).font(.system(size: (9) * Ink.scale, weight: .semibold)).tracking(0.5).foregroundStyle(Ink.ink)
                                .frame(width: colW, height: 16)
                        }
                    }
                }
                ForEach(1...31, id: \.self) { d in
                    HStack(spacing: 0) {
                        Text("\(d)").font(.system(size: (8) * Ink.scale).monospacedDigit()).foregroundStyle(Ink.muted).frame(width: labelW, height: rowH)
                        ForEach(0..<12, id: \.self) { m in
                            cell(m: m, d: d).frame(width: colW, height: rowH)
                        }
                    }
                }
            }
            .background(Ink.paper)
            .overlay(Rectangle().stroke(Ink.ink, lineWidth: 1))
        }
    }

    @ViewBuilder private func cell(m: Int, d: Int) -> some View {
        if d <= data.months[m].count {
            let c = data.months[m][d - 1]
            ZStack(alignment: .leading) {
                (c.sun ? Ink.wash : Ink.paper)
                if c.red && !c.sun { Ink.red.opacity(0.08) }
                if c.tour {
                    Rectangle().fill(Ink.tour.opacity(c.tbc ? 0.25 : 0.55)).frame(width: 4)
                        .padding(.top, c.tourStart ? 2 : 0)
                        .frame(maxWidth: .infinity, alignment: .trailing).padding(.trailing, 3)
                }
                HStack(spacing: 2) {
                    ForEach(0..<2, id: \.self) { l in
                        Rectangle().fill(c.rules[l].isEmpty ? Color.clear : Ink.hex(c.rules[l])).frame(width: 2)
                    }
                }
                .padding(.leading, 2)
                if c.show { Circle().fill(Ink.red).frame(width: 6, height: 6).frame(maxWidth: .infinity) }
            }
            .overlay(alignment: .bottom) { Rectangle().fill(c.sun ? Ink.ink.opacity(0.5) : Ink.rule).frame(height: c.sun ? 0.8 : 0.3) }
            .overlay(c.today ? Rectangle().stroke(Ink.ink, lineWidth: 1.2) : nil)
            .contentShape(Rectangle())
            .onTapGesture { pick(c.date, data.year, m) }
        } else {
            Ink.ground.opacity(0.6)
        }
    }
}
#endif
