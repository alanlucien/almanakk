// THE NATIVE WEEK (stage 4, 10.10.2026): the schedule page. Seven days down the screen,
// his spans on top, the tour's word in each day's head, and wg | Schedule's calls on the
// lines (the week is where the schedule lives, D1). Opened from a day's figure or a week
// number in the month, or from the day sheet's "uke N", so a week that began last month
// is never out of reach (Alan, 10.10). The phone's own back button and back swipe return
// to the month; sideways is a week.
#if os(iOS)
import SwiftUI


struct WeekScreen: View {
    @ObservedObject var store: Store
    @State var monday: String
    @Binding var open: String?
    @State private var drag: CGFloat = 0

    var body: some View {
        let w = store.almanac.week(monday)
        VStack(spacing: 0) {
            GeometryReader { geo in
                let spanH: CGFloat = w.spans.isEmpty ? 0 : CGFloat(w.spans.count) * 18 + 12
                let dayMin = max(44, (geo.size.height - spanH) / 7)
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        if !w.spans.isEmpty { spanBlock(w.spans).frame(height: spanH) }
                        ForEach(Array(w.days.enumerated()), id: \.element.id) { _, day in
                            WeekDayBlock(day: day, spans: w.spans, minHeight: dayMin, open: open == day.date)
                                .contentShape(Rectangle())
                                .onTapGesture { open = day.date }
                        }
                    }
                    .background(Ink.paper)
                    .overlay(Rectangle().stroke(Ink.ink, lineWidth: 1))
                }
                .offset(x: drag)
            }
            .padding(.horizontal, 10).padding(.top, 4).padding(.bottom, 6)
        }
        .background(Ink.ground.ignoresSafeArea())
        // the week's name and dates ride in the bar beside the back button: one line, not two
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) { title }
            ToolbarItem(placement: .topBarTrailing) { todayButton }
        }
        .background {
            Group {
                Button("") { step(-1) }.keyboardShortcut(.leftArrow, modifiers: [])
                Button("") { step(1) }.keyboardShortcut(.rightArrow, modifiers: [])
            }
            .opacity(0).accessibilityHidden(true)
        }
        .gesture(DragGesture(minimumDistance: 20)
            .onChanged { v in if open == nil && abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width * 0.6 } }
            .onEnded { v in
                guard open == nil else { drag = 0; return }
                withAnimation(.easeOut(duration: 0.18)) { drag = 0 }
                if abs(v.translation.width) > 60 && abs(v.translation.width) > abs(v.translation.height) { step(v.translation.width < 0 ? 1 : -1) }
            })
    }

    private func step(_ n: Int) {
        withAnimation(.easeOut(duration: 0.15)) { monday = Day.add(monday, 7 * n) }
        // the month underneath follows, so the back button lands on this week's month
        let c = Day.greg.dateComponents([.year, .month], from: Day.date(Day.add(monday, 3)))
        if c.year! != store.year || c.month! - 1 != store.month {
            store.year = c.year!; store.month = c.month! - 1
            if store.demo { store.loadDemo() }
        }
    }

    private var title: some View {
        let sun = Day.add(monday, 6)
        let m1 = Int(monday.dropFirst(5).prefix(2))! - 1, m2 = Int(sun.dropFirst(5).prefix(2))! - 1
        let short = englishUI ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"]
        let range = m1 == m2
            ? "\(Int(monday.suffix(2))!).–\(Int(sun.suffix(2))!). \(short[m2])"
            : "\(Int(monday.suffix(2))!). \(short[m1]) – \(Int(sun.suffix(2))!). \(short[m2])"
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(T("UKE", "WEEK") + " \(Day.isoWeek(monday))").font(.system(size: (17) * Ink.scale, weight: .semibold)).tracking(1.2)
            Text(range).font(.system(size: (13) * Ink.scale)).foregroundStyle(Ink.muted)
        }
        .foregroundStyle(Ink.ink)
    }

    private var todayButton: some View {
        Button {
            withAnimation { monday = Almanac.monday(Day.today) }
            store.goToday()
        } label: {
            Text(T("I DAG", "TODAY")).font(.system(size: (12) * Ink.scale, weight: .semibold)).tracking(1.2)
        }
        .foregroundStyle(Ink.ink)
    }

    /// his spans of the week, each with its colour and its days
    private func spanBlock(_ spans: [Almanac.WeekSpan]) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(spans) { sp in
                HStack(spacing: 8) {
                    Rectangle().fill(Ink.hex(sp.color)).frame(width: 4, height: 12)
                    Text(sp.title.uppercased()).font(.system(size: (11) * Ink.scale, weight: .semibold)).tracking(0.8)
                        .foregroundStyle(sp.pencil ? Ink.muted : Ink.ink).lineLimit(1)
                    Text(shortRange(sp.start, sp.end)).font(.system(size: (11) * Ink.scale)).foregroundStyle(Ink.muted).fixedSize()
                    Spacer(minLength: 0)
                }
                .frame(height: 15)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { Rectangle().fill(Ink.rule).frame(height: 0.5) }
    }

    private func shortRange(_ a: String, _ b: String) -> String {
        let ma = Int(a.dropFirst(5).prefix(2))! - 1, mb = Int(b.dropFirst(5).prefix(2))! - 1
        let short = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"]
        return ma == mb ? "\(Int(a.suffix(2))!).–\(Int(b.suffix(2))!). \(short[mb])" : "\(Int(a.suffix(2))!). \(short[ma]) – \(Int(b.suffix(2))!). \(short[mb])"
    }
}

/// one day of the week: its head, then its lines; his spans run down the left edge
struct WeekDayBlock: View {
    let day: Almanac.WeekDay
    let spans: [Almanac.WeekSpan]
    let minHeight: CGFloat
    let open: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            head
            ForEach(day.lines) { l in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(l.time).font(.system(size: (12) * Ink.scale).monospacedDigit()).foregroundStyle(Ink.muted).frame(width: 40, alignment: .trailing)
                    Circle().fill(Ink.hex(l.color)).frame(width: 6, height: 6).alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
                    (Text(l.text) + Text(l.note ? "  ∗" : "").foregroundColor(Ink.muted))
                        .font(.system(size: (15) * Ink.scale))
                        .foregroundStyle(l.show ? Ink.red : (l.pencil ? Ink.muted : (l.ink.isEmpty ? Ink.ink : Ink.hex(l.ink))))
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.leading, CGFloat(max(spans.count, 0)) * 7 + 16).padding(.trailing, 12).padding(.bottom, 6)
        .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
        .background(open ? Ink.wash : (day.sun ? Ink.wash : Ink.paper))
        .overlay(alignment: .leading) { rules }
        .overlay(alignment: .bottom) { Rectangle().fill(day.sun ? Ink.ink : Ink.rule).frame(height: day.sun ? 1 : 0.5) }
    }

    private var head: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(day.d)").font(.system(size: (17) * Ink.scale, weight: .semibold).monospacedDigit())
            Text(WD_LONG[day.wi]).font(.system(size: (12) * Ink.scale, weight: .semibold)).tracking(1.4)
            if let m = Moon.turn(day.date) {
                Text(m.glyph).font(.system(size: (11) * Ink.scale)).foregroundStyle(day.today ? Ink.onInkSoft : Ink.soft)
                    .accessibilityLabel(m.name)
            }
            Spacer(minLength: 6)
            if !day.ctx.isEmpty {
                Text(day.ctxKind == "hn" ? day.ctx : day.ctx.uppercased())
                    .font(.system(size: (11) * Ink.scale, weight: day.ctxKind == "hn" ? .regular : .semibold)).tracking(day.ctxKind == "hn" ? 0.2 : 0.9)
                    .italic(day.ctxKind == "hn" || day.ctxTbc)
                    .foregroundStyle(day.today ? Ink.paper : (day.ctxKind == "tour" ? Ink.tourInk : Ink.red))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(day.today ? Ink.paper : ((day.red || day.show) ? Ink.red : Ink.ink))
        .padding(.top, 7).padding(.bottom, 3)
        // TODAY IS INK, as in the month (Alan's pick B)
        .background(day.today ? Ink.ink.padding(.leading, -(CGFloat(spans.count) * 7 + 16)).padding(.trailing, -12) : nil)
    }

    /// A SPAN IS SOLID ONLY ON ITS OWN DAYS (Alan, 08.10); before it begins, a faint dotted
    /// lead runs down from its name, so the eye finds where it starts
    private var rules: some View {
        HStack(spacing: 3) {
            ForEach(Array(spans.enumerated()), id: \.element.id) { i, sp in
                let c = Ink.hex(sp.color)
                if day.spanOn[i] {
                    Rectangle().fill(c).frame(width: 4)
                        .padding(.top, sp.start == day.date ? 10 : 0).padding(.bottom, sp.end == day.date ? 10 : 0)
                } else if day.date < sp.start {
                    // the dotted lead, centred in the span's lane
                    GeometryReader { g in
                        Path { p in p.move(to: CGPoint(x: 2, y: 0)); p.addLine(to: CGPoint(x: 2, y: g.size.height)) }
                            .stroke(c.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [2, 3]))
                    }
                    .frame(width: 4)
                } else {
                    Color.clear.frame(width: 4)
                }
            }
        }
        .padding(.leading, 6)
    }
}
#endif
