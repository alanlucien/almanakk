// APPLE REMINDERS IN THE ALMANAC (stage 6, 10.10.2026; Alan: "a toggle to see reminders
// from Apple … and to add reminders? Or a to-do list … very intuitive?"). One list, kept
// where Siri, the Watch and the Mac already keep it — Apple Reminders — and given a calm
// face here: a reminder with a date stands on its day in the sheet with a ring to tick it
// off; a line in the sheet adds one to that day. Off until he switches it on; iOS asks
// once for permission. Nothing of it reaches Google.
#if os(iOS)
import EventKit
import SwiftUI

@MainActor
final class RemindersStore: ObservableObject {
    @AppStorage("almanakk.reminders") var enabled = false
    @Published var granted = false
    @Published var byDay: [String: [EKReminder]] = [:]
    private let ek = EKEventStore()

    init() {
        granted = EKEventStore.authorizationStatus(for: .reminder) == .fullAccess
        if enabled && granted { Task { await load() } }
    }

    func setEnabled(_ on: Bool) async {
        enabled = on
        guard on else { byDay = [:]; return }
        if !granted { granted = (try? await ek.requestFullAccessToReminders()) ?? false }
        if granted { await load() } else { enabled = false }
    }

    /// every open reminder with a due date, by day
    func load() async {
        guard enabled, granted else { return }
        let pred = ek.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: nil)
        let found: [EKReminder] = await withCheckedContinuation { c in
            ek.fetchReminders(matching: pred) { c.resume(returning: $0 ?? []) }
        }
        var m: [String: [EKReminder]] = [:]
        for r in found {
            guard let dc = r.dueDateComponents, let d = Day.greg.date(from: dc) else { continue }
            m[Day.key(d), default: []].append(r)
        }
        byDay = m
    }

    func complete(_ r: EKReminder) {
        r.isCompleted = true
        try? ek.save(r, commit: true)
        Task { await load() }
    }

    func add(_ title: String, on ds: String) {
        let r = EKReminder(eventStore: ek)
        r.title = title
        r.calendar = ek.defaultCalendarForNewReminders()
        r.dueDateComponents = Day.greg.dateComponents([.year, .month, .day], from: Day.date(ds))
        try? ek.save(r, commit: true)
        Task { await load() }
    }
}

/// the day's reminders, under its events in the sheet
struct DayReminders: View {
    @ObservedObject var rem: RemindersStore
    let date: String
    @State private var text = ""

    var body: some View {
        if rem.enabled {
            VStack(alignment: .leading, spacing: 8) {
                Text(T("PÅMINNELSER", "REMINDERS")).font(.system(size: (11) * Ink.scale, weight: .semibold)).tracking(1.2).foregroundStyle(Ink.muted)
                    .padding(.top, 14)
                ForEach(rem.byDay[date] ?? [], id: \.calendarItemIdentifier) { r in
                    HStack(spacing: 10) {
                        Button { rem.complete(r) } label: {
                            Circle().stroke(Ink.ink, lineWidth: 1.2).frame(width: 18, height: 18)
                        }
                        .accessibilityLabel(T("Huk av", "Tick off"))
                        Text(r.title ?? "").font(.system(size: (16) * Ink.scale)).foregroundStyle(Ink.ink)
                        Spacer()
                    }
                }
                HStack(spacing: 10) {
                    Circle().stroke(Ink.rule, lineWidth: 1.2).frame(width: 18, height: 18)
                    TextField(T("Ny påminnelse …", "New reminder …"), text: $text)
                        .font(.system(size: (16) * Ink.scale)).autocorrectionDisabled(true).submitLabel(.done)
                        .onSubmit { let t = text.trimmingCharacters(in: .whitespaces); if !t.isEmpty { rem.add(t, on: date); text = "" } }
                }
            }
        }
    }
}
#endif
