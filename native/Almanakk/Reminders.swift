// GJØREMÅL — the to-do list (Alan, 11.10: "my perfect interactive to-do list replacing what
// I would use in Notes … almost its own app inside the Almanac"). Its own page, opened from
// "☐ n" in the month header, NEVER in the calendar. The engine is Apple Reminders (so Siri
// and the Watch can add to it); the face is the almanac's.
//   · headings are his lists (Reminders lists); a list made in Reminders appears here
//   · write like Notes: return gives the next line; empty lines vanish
//   · sub-points: stored as ordinary reminders linked to their parent (Apple does not let
//     other apps use Reminders' own sub-tasks), so in Apple's app they show flat
//   · "Ring Kari": the name is a link; a tap finds the contact and offers call or message
//   · a date only inside the list (red "fre"); on the day the line rises to I DAG
//   · one tap ticks off; struck through, sinks, gone the next day
//   · the order he drags is kept by the almanac (Apple does not share Reminders' order)
#if os(iOS)
import Contacts
import EventKit
import SwiftUI

@MainActor
final class TodoStore: ObservableObject {
    @Published var granted = EKEventStore.authorizationStatus(for: .reminder) == .fullAccess
    @Published var lists: [EKCalendar] = []
    @Published var items: [EKReminder] = []
    let ek = EKEventStore()
    private var order: [String] {
        get { UserDefaults.standard.stringArray(forKey: "almanakk.todoOrder") ?? [] }
        set { UserDefaults.standard.set(newValue, forKey: "almanakk.todoOrder") }
    }

    init() {
        NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: ek, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.load() }
        }
    }

    /// TEST ONLY ("-seedTodo" on a simulator): his lists by name and size, filled with
    /// placeholders, so the page is tried at its real scale. Adds what is missing, deletes
    /// nothing.
    func seedForTest() async {
        guard ProcessInfo.processInfo.arguments.contains("-seedTodo"), granted,
              let source = ek.defaultCalendarForNewReminders()?.source else { return }
        let shape: [(String, Int)] = [("Reminders", 14), ("To Do", 4), ("Shopping", 2), ("Family", 0), ("Sjopping", 0),
                                      ("Handleliste", 2), ("Film List", 9), ("Booze", 1), ("Inbox", 0), ("Julegaver", 12)]
        let have = Set(ek.calendars(for: .reminder).map(\.title))
        for (name, n) in shape where !have.contains(name) {
            let c = EKCalendar(for: .reminder, eventStore: ek); c.title = name; c.source = source
            try? ek.saveCalendar(c, commit: true)
            for i in 0..<n { let r = EKReminder(eventStore: ek); r.title = "\(name) punkt \(i + 1)"; r.calendar = c; try? ek.save(r, commit: false) }
        }
        try? ek.commit()
        await load()
    }

    func requestAccess() async {
        if !granted { granted = (try? await ek.requestFullAccessToReminders()) ?? false }
        await load()
    }

    /// LISTS HAVE A RANK (Alan, 11.10: "the lists below are as important as the main list,
    /// which is not right"; "the count is counting … my bar cabinet list 'booze'"): one main
    /// list first and open, the rest foldable; a list set aside (a bar list, a packing list)
    /// sits folded at the foot and is never counted.
    @Published var mainList: String = UserDefaults.standard.string(forKey: "almanakk.todoMain") ?? "" {
        didSet { UserDefaults.standard.set(mainList, forKey: "almanakk.todoMain") }
    }
    @Published var asideLists: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "almanakk.todoAside") ?? []) {
        didSet { UserDefaults.standard.set(Array(asideLists), forKey: "almanakk.todoAside") }
    }
    @Published var folded: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "almanakk.todoFolded") ?? []) {
        didSet { UserDefaults.standard.set(Array(folded), forKey: "almanakk.todoFolded") }
    }
    var main: EKCalendar? { lists.first { $0.calendarIdentifier == mainList } ?? ek.defaultCalendarForNewReminders().flatMap { d in lists.first { $0.calendarIdentifier == d.calendarIdentifier } } ?? lists.first }
    /// main first, then the others, then those set aside
    var orderedLists: [EKCalendar] {
        let m = main?.calendarIdentifier
        return lists.filter { $0.calendarIdentifier == m }
            + lists.filter { $0.calendarIdentifier != m && !asideLists.contains($0.calendarIdentifier) }
            + lists.filter { asideLists.contains($0.calendarIdentifier) && $0.calendarIdentifier != m }
    }
    func isFolded(_ l: EKCalendar) -> Bool {
        // ONLY THE MAIN LIST STARTS OPEN (tried at his real scale, 12 lists: all open made one
        // endless page with every list as loud as the main one); a tap flips it and is kept
        let startsOpen = l.calendarIdentifier == main?.calendarIdentifier
        return folded.contains(l.calendarIdentifier) == startsOpen
    }
    func toggleFold(_ l: EKCalendar) {
        if folded.contains(l.calendarIdentifier) { folded.remove(l.calendarIdentifier) } else { folded.insert(l.calendarIdentifier) }
    }
    var openCount: Int { items.filter { !$0.isCompleted && !asideLists.contains($0.calendar.calendarIdentifier) }.count }

    func load() async {
        guard granted else { return }
        lists = ek.calendars(for: .reminder).sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        let open = ek.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: nil)
        let done = ek.predicateForCompletedReminders(withCompletionDateStarting: Date().addingTimeInterval(-86400), ending: nil, calendars: nil)
        let a: [EKReminder] = await fetch(open), b: [EKReminder] = await fetch(done)
        items = a + b
    }
    private func fetch(_ p: NSPredicate) async -> [EKReminder] {
        await withCheckedContinuation { c in ek.fetchReminders(matching: p) { c.resume(returning: $0 ?? []) } }
    }

    // ---------- reading ----------
    func parentID(_ r: EKReminder) -> String? {
        guard let u = r.url?.absoluteString, u.hasPrefix("almanakk://parent/") else { return nil }
        return String(u.dropFirst("almanakk://parent/".count))
    }
    private func rank(_ r: EKReminder) -> Int { order.firstIndex(of: r.calendarItemIdentifier) ?? Int.max }
    private func sorted(_ rs: [EKReminder]) -> [EKReminder] {
        rs.sorted { a, b in
            if a.isCompleted != b.isCompleted { return !a.isCompleted }        // ticked off sinks
            if rank(a) != rank(b) { return rank(a) < rank(b) }
            return (a.creationDate ?? .distantPast) < (b.creationDate ?? .distantPast)
        }
    }
    /// a list's lines in reading order: each top line followed by its sub-points
    func rows(of list: EKCalendar) -> [(r: EKReminder, sub: Bool)] {
        let mine = items.filter { $0.calendar.calendarIdentifier == list.calendarIdentifier }
        let ids = Set(mine.map(\.calendarItemIdentifier))
        let tops = sorted(mine.filter { parentID($0).map { !ids.contains($0) } ?? true })
        var out: [(EKReminder, Bool)] = []
        for t in tops {
            out.append((t, false))
            for s in sorted(mine.filter { parentID($0) == t.calendarItemIdentifier }) { out.append((s, true)) }
        }
        return out
    }
    /// due today or before, not done: they stand under I DAG as well (never from a list set aside)
    var today: [EKReminder] {
        let end = Day.greg.startOfDay(for: Date()).addingTimeInterval(86400)
        return sorted(items.filter { r in
            guard !r.isCompleted, !asideLists.contains(r.calendar.calendarIdentifier), let dc = r.dueDateComponents, let d = Day.greg.date(from: dc) else { return false }
            return d < end
        })
    }
    func dueLabel(_ r: EKReminder) -> String? {
        guard let dc = r.dueDateComponents, let d = Day.greg.date(from: dc) else { return nil }
        let k = Day.key(d), t = Day.today
        if k < t { return T("forfalt", "overdue") }
        if k == t { return T("i dag", "today") }
        if k == Day.add(t, 1) { return T("i morgen", "tomorrow") }
        if k <= Day.add(t, 6) { return WD_LONG[Day.weekdayIdx(k)].prefix(3).lowercased() }
        let m = englishUI ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"]
        return "\(Int(k.suffix(2))!). \(m[Int(k.dropFirst(5).prefix(2))! - 1])"
    }

    // ---------- writing ----------
    private func commit(_ r: EKReminder) { try? ek.save(r, commit: true) }

    @discardableResult
    func add(_ title: String, to list: EKCalendar, after: EKReminder? = nil, parent: String? = nil) -> EKReminder {
        let r = EKReminder(eventStore: ek)
        r.title = title; r.calendar = list
        if let parent { r.url = URL(string: "almanakk://parent/\(parent)") }
        commit(r)
        var o = order
        if let after, let i = o.firstIndex(of: after.calendarItemIdentifier) { o.insert(r.calendarItemIdentifier, at: i + 1) }
        else { o.append(r.calendarItemIdentifier) }
        order = o
        items.append(r)
        return r
    }
    func setTitle(_ r: EKReminder, _ t: String) {
        let clean = t.trimmingCharacters(in: .whitespaces)
        if clean.isEmpty { delete(r); return }
        if r.title != clean { r.title = clean; commit(r) }
    }
    func setNote(_ r: EKReminder, _ n: String) { r.notes = n.isEmpty ? nil : n; commit(r); objectWillChange.send() }
    func toggle(_ r: EKReminder) { r.isCompleted.toggle(); commit(r); objectWillChange.send() }
    func delete(_ r: EKReminder) {
        // its sub-points go with it
        for s in items where parentID(s) == r.calendarItemIdentifier { try? ek.remove(s, commit: false) }
        try? ek.remove(r, commit: true)
        items.removeAll { $0 == r || parentID($0) == r.calendarItemIdentifier }
    }
    func setDue(_ r: EKReminder, _ d: Date?) {
        r.dueDateComponents = d.map { Day.greg.dateComponents([.year, .month, .day], from: $0) }
        commit(r); objectWillChange.send()
    }
    /// under the line above it in the same list
    func indent(_ r: EKReminder) {
        let rs = rows(of: r.calendar)
        guard let i = rs.firstIndex(where: { $0.r == r }), i > 0 else { return }
        guard let p = rs[..<i].last(where: { !$0.sub })?.r else { return }
        r.url = URL(string: "almanakk://parent/\(p.calendarItemIdentifier)"); commit(r); objectWillChange.send()
    }
    func outdent(_ r: EKReminder) { r.url = nil; commit(r); objectWillChange.send() }
    func move(in list: EKCalendar, from: IndexSet, to: Int) {
        var ids = rows(of: list).map(\.r.calendarItemIdentifier)
        ids.move(fromOffsets: from, toOffset: to)
        var o = order.filter { !ids.contains($0) }
        o.append(contentsOf: ids)
        order = o
        objectWillChange.send()
    }
    func newList(_ name: String) {
        guard let source = ek.defaultCalendarForNewReminders()?.source else { return }
        let c = EKCalendar(for: .reminder, eventStore: ek)
        c.title = name; c.source = source
        try? ek.saveCalendar(c, commit: true)
        Task { await load() }
    }
    func rename(_ list: EKCalendar, _ name: String) {
        list.title = name; try? ek.saveCalendar(list, commit: true); Task { await load() }
    }
}

// ---------- calling from a line ----------

enum CallName {
    /// "Ring Kari om lysdesigner" → ("Ring ", "Kari", " om lysdesigner")
    static func split(_ t: String) -> (String, String, String)? {
        guard let g = RX.groups("^((?:[Rr]ing|[Cc]all|[Ss]ms|[Mm]elding til)\\s+)(\\p{Lu}\\p{L}+(?:\\s\\p{Lu}\\p{L}+)?)(.*)$", t) else { return nil }
        return (g[1], g[2], g[3])
    }
    static func find(_ name: String) async -> [(String, String)] {
        let store = CNContactStore()
        guard (try? await store.requestAccess(for: .contacts)) == true else { return [] }
        let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactPhoneNumbersKey] as [CNKeyDescriptor]
        let found = (try? store.unifiedContacts(matching: CNContact.predicateForContacts(matchingName: name), keysToFetch: keys)) ?? []
        return found.flatMap { c in
            c.phoneNumbers.prefix(2).map { ("\(c.givenName) \(c.familyName)".trimmingCharacters(in: .whitespaces), $0.value.stringValue) }
        }
    }
}

// ---------- the page ----------

struct TodoView: View {
    @ObservedObject var todo: TodoStore
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: String?
    @State private var editing: String? = nil
    @State private var text = ""
    @State private var newText: [String: String] = [:]
    @State private var callName = ""
    @State private var callNumbers: [(String, String)] = []
    @State private var calling = false
    @State private var noteFor: EKReminder? = nil
    @State private var noteText = ""
    @State private var dayFor: EKReminder? = nil
    @State private var pickDate = Date()
    @State private var renaming: EKCalendar? = nil
    @State private var listName = ""
    @State private var addingList = false
    @State private var editMode: EditMode = .inactive
    @State private var quick = ""

    var body: some View {
        NavigationStack {
            Group {
                if !todo.granted {
                    VStack(spacing: 14) {
                        Text(T("Gjøremålene ligger i Påminnelser på telefonen.", "Your to-dos live in Reminders on the phone."))
                            .font(.system(size: 15 * Ink.scale)).multilineTextAlignment(.center).foregroundStyle(Ink.soft)
                        Button(T("Gi tilgang", "Allow access")) { Task { await todo.requestAccess() } }
                            .font(.system(size: 15 * Ink.scale, weight: .semibold)).foregroundStyle(Ink.ink)
                    }.padding(30)
                } else { list }
            }
            .background(Ink.paper)
            .navigationTitle(T("GJØREMÅL", "TO-DO")).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button(T("Ferdig", "Done")) { commitEdit(); dismiss() }.foregroundStyle(Ink.ink) }
                ToolbarItem(placement: .topBarLeading) {
                    Button(editMode.isEditing ? T("Ferdig", "Done") : T("Ordne", "Arrange")) {
                        commitEdit(); withAnimation { editMode = editMode.isEditing ? .inactive : .active }
                    }.foregroundStyle(Ink.ink)
                }
            }
        }
        .task { await todo.load(); await todo.seedForTest() }
        .confirmationDialog(T("Ring ", "Call ") + callName, isPresented: $calling, titleVisibility: .visible) {
            if callNumbers.isEmpty { Button(T("Fant ikke \(callName) i kontaktene", "\(callName) is not in your contacts")) {} }
            ForEach(Array(callNumbers.enumerated()), id: \.offset) { _, n in
                Button(T("Ring ", "Call ") + "\(n.0) · \(n.1)") { open("tel:", n.1) }
                Button(T("Melding til ", "Message ") + n.0) { open("sms:", n.1) }
            }
        }
        .alert(T("Notat", "Note"), isPresented: Binding(get: { noteFor != nil }, set: { if !$0 { noteFor = nil } })) {
            TextField(T("Notat", "Note"), text: $noteText)
            Button(T("Lagre", "Save")) { if let r = noteFor { todo.setNote(r, noteText) } }
            Button(T("Avbryt", "Cancel"), role: .cancel) {}
        }
        .alert(T("Ny liste", "New list"), isPresented: $addingList) {
            TextField(T("Navn", "Name"), text: $listName)
            Button(T("Lagre", "Save")) { if !listName.isEmpty { todo.newList(listName) } }
            Button(T("Avbryt", "Cancel"), role: .cancel) {}
        }
        .alert(T("Gi listen nytt navn", "Rename list"), isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField(T("Navn", "Name"), text: $listName)
            Button(T("Lagre", "Save")) { if let l = renaming, !listName.isEmpty { todo.rename(l, listName) } }
            Button(T("Avbryt", "Cancel"), role: .cancel) {}
        }
        .sheet(isPresented: Binding(get: { dayFor != nil }, set: { if !$0 { dayFor = nil } })) {
            NavigationStack {
                DatePicker("", selection: $pickDate, displayedComponents: .date).datePickerStyle(.graphical).padding()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) { Button(T("Lagre", "Save")) { if let r = dayFor { todo.setDue(r, pickDate) }; dayFor = nil } }
                        ToolbarItem(placement: .cancellationAction) { Button(T("Ingen dag", "No date")) { if let r = dayFor { todo.setDue(r, nil) }; dayFor = nil } }
                    }
            }
            .presentationDetents([.medium])
            .environment(\.locale, Locale(identifier: englishUI ? "en_GB" : "nb_NO"))
        }
    }

    private var list: some View {
        VStack(spacing: 0) {
            quickEntry
            Rectangle().fill(Ink.ink).frame(height: 1)
            listBody
        }
    }

    /// QUICK ENTRY, always at the top (Alan, 11.10: "quick entry is hard"): type, return,
    /// and it is in the main list; the field stays ready for the next one
    private var quickEntry: some View {
        HStack(spacing: 10) {
            Image(systemName: "plus").font(.system(size: 15 * Ink.scale, weight: .semibold)).foregroundStyle(Ink.soft)
            TextField(T("Nytt gjøremål …", "New to-do …"), text: $quick)
                .font(.system(size: 17 * Ink.scale)).autocorrectionDisabled(true)
                .focused($focus, equals: "quick").submitLabel(.return)
                .onSubmit {
                    let t = quick.trimmingCharacters(in: .whitespaces)
                    if !t.isEmpty, let m = todo.main { todo.add(t, to: m); quick = "" }
                    focus = "quick"
                }
            if let m = todo.main {
                Text(m.title).font(.system(size: 12 * Ink.scale)).foregroundStyle(Ink.muted).lineLimit(1)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(Ink.paper)
    }

    private var listBody: some View {
        List {
            if !todo.today.isEmpty {
                Section {
                    head(T("I DAG", "TODAY"), todo.today.count).listRowBackground(Ink.paper)
                    ForEach(todo.today, id: \.calendarItemIdentifier) { r in row(r, sub: false, inToday: true) }
                }
            }
            ForEach(todo.orderedLists, id: \.calendarIdentifier) { l in
                let rows = todo.rows(of: l)
                let aside = todo.asideLists.contains(l.calendarIdentifier)
                let isMain = l.calendarIdentifier == todo.main?.calendarIdentifier
                Section {
                    // the heading is an ordinary line, so a folded list takes one line
                    Button { withAnimation(.easeOut(duration: 0.15)) { todo.toggleFold(l) } } label: {
                        head(l.title.uppercased(), aside ? nil : rows.filter { !$0.r.isCompleted }.count,
                             folded: todo.isFolded(l), main: isMain, aside: aside)
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Ink.paper)
                    .moveDisabled(true)
                    .contextMenu {
                        if !isMain { Button(T("Gjør til hovedliste", "Make main list")) { todo.mainList = l.calendarIdentifier } }
                        if aside { Button(T("Ta med i gjøremål", "Count as to-dos")) { todo.asideLists.remove(l.calendarIdentifier) } }
                        else if !isMain { Button(T("Sett til side (telles ikke)", "Set aside (not counted)")) { todo.asideLists.insert(l.calendarIdentifier) } }
                        Button(T("Gi nytt navn", "Rename")) { listName = l.title; renaming = l }
                    }
                    if !todo.isFolded(l) {
                        ForEach(rows, id: \.r.calendarItemIdentifier) { x in row(x.r, sub: x.sub, inToday: false) }
                            .onMove { todo.move(in: l, from: $0, to: $1) }
                        newLine(l)
                    }
                }
            }
            Section {
                Button(T("+ Ny liste", "+ New list")) { listName = ""; addingList = true }
                    .font(.system(size: 14 * Ink.scale)).foregroundStyle(Ink.soft)
                    .listRowBackground(Ink.paper)
            }
        }
        .listStyle(.plain)
        .listSectionSpacing(.compact)
        .environment(\.editMode, $editMode)
        .scrollContentBackground(.hidden)
        .background(Ink.paper)
    }

    /// HEADINGS AT READING SIZE (Alan, 11.10: "headlines are too small"); the main list the
    /// largest, a list set aside quiet
    private func head(_ t: String, _ n: Int?, folded: Bool = false, main: Bool = true, aside: Bool = false) -> some View {
        HStack(spacing: 8) {
            Image(systemName: folded ? "chevron.right" : "chevron.down")
                .font(.system(size: 11 * Ink.scale, weight: .semibold)).foregroundStyle(Ink.muted).frame(width: 12)
            Text(t).font(.system(size: (main ? 17 : 15) * Ink.scale, weight: .semibold)).tracking(1.2)
                .foregroundStyle(aside ? Ink.muted : Ink.ink)
            Spacer()
            if let n, n > 0 { Text("\(n)").font(.system(size: 13 * Ink.scale, weight: .medium)).foregroundStyle(Ink.soft) }
        }
        .padding(.top, main ? 10 : 2).padding(.bottom, 2)
        .contentShape(Rectangle())
    }

    @ViewBuilder private func row(_ r: EKReminder, sub: Bool, inToday: Bool) -> some View {
        let id = r.calendarItemIdentifier
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 10) {
                Button { commitEdit(); todo.toggle(r) } label: {
                    ZStack {
                        Circle().stroke(Ink.ink, lineWidth: 1.3)
                        if r.isCompleted {
                            Circle().fill(Ink.ink)
                            Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(Ink.paper)
                        }
                    }
                    .frame(width: sub ? 14 : 18, height: sub ? 14 : 18)
                }
                .buttonStyle(.plain).accessibilityLabel(T("Huk av", "Tick off"))
                if editing == id && !inToday {
                    TextField("", text: $text)
                        .font(.system(size: (sub ? 15 : 16) * Ink.scale)).autocorrectionDisabled(true)
                        .focused($focus, equals: id).submitLabel(.return)
                        .onSubmit {
                            // RETURN GIVES THE NEXT LINE, at the same level (like Notes)
                            let parent = sub ? todo.parentID(r) : nil
                            todo.setTitle(r, text)
                            let n = todo.add("", to: r.calendar, after: r, parent: parent)
                            editing = n.calendarItemIdentifier; text = ""; focus = n.calendarItemIdentifier
                        }
                } else {
                    title(r, sub: sub)
                        .contentShape(Rectangle())
                        .onTapGesture { if !inToday { commitEdit(); editing = id; text = r.title ?? ""; focus = id } }
                }
                Spacer(minLength: 4)
                if let d = todo.dueLabel(r), !r.isCompleted {
                    Text(d).font(.system(size: 11 * Ink.scale, weight: .semibold)).foregroundStyle(Ink.red)
                }
            }
            if let n = r.notes, !n.isEmpty {
                Text(n).font(.system(size: 12 * Ink.scale)).foregroundStyle(Ink.muted).lineLimit(2).padding(.leading, sub ? 24 : 28)
            }
        }
        .padding(.leading, sub ? 24 : 0)
        .listRowBackground(Ink.paper)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) { todo.delete(r) } label: { Text(T("Slett", "Delete")) }
            Button { pickDate = Date(); dayFor = r } label: { Text(T("Velg dag", "Pick day")) }.tint(Ink.muted)
            Button { todo.setDue(r, Day.greg.date(byAdding: .day, value: 1, to: Date())) } label: { Text(T("I morgen", "Tomorrow")) }.tint(Ink.soft)
            Button { todo.setDue(r, Date()) } label: { Text(T("I dag", "Today")) }.tint(Ink.ink)
        }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if sub { Button { todo.outdent(r) } label: { Text(T("Ut", "Out")) }.tint(Ink.soft) }
            else { Button { todo.indent(r) } label: { Text(T("Underpunkt", "Sub-point")) }.tint(Ink.soft) }
        }
        .contextMenu {
            Button(T("Notat …", "Note …")) { noteText = r.notes ?? ""; noteFor = r }
            if sub { Button(T("Ikke underpunkt", "Not a sub-point")) { todo.outdent(r) } }
            else { Button(T("Gjør til underpunkt", "Make sub-point")) { todo.indent(r) } }
            Button(T("Velg dag …", "Pick day …")) { pickDate = Date(); dayFor = r }
        }
    }

    /// the title; "Ring Kari …" with the name as a link
    @ViewBuilder private func title(_ r: EKReminder, sub: Bool) -> some View {
        let t = r.title ?? ""
        let f = Font.system(size: (sub ? 15 : 16) * Ink.scale)
        let c: Color = r.isCompleted ? Ink.muted : Ink.ink
        if let parts = CallName.split(t), !r.isCompleted {
            HStack(spacing: 0) {
                Text(parts.0).font(f).foregroundStyle(c)
                Button {
                    Task { callName = parts.1; callNumbers = await CallName.find(parts.1); calling = true }
                } label: {
                    Text(parts.1).font(f).underline(true, color: Ink.muted).foregroundStyle(c)
                }
                .buttonStyle(.plain)
                Text(parts.2).font(f).foregroundStyle(c).lineLimit(1)
            }
        } else {
            Text(t).font(f).strikethrough(r.isCompleted).foregroundStyle(c)
        }
    }

    /// the empty line at the foot of a list: type, return, and the next one is ready
    private func newLine(_ l: EKCalendar) -> some View {
        let key = l.calendarIdentifier
        return HStack(spacing: 10) {
            Circle().stroke(Ink.rule, lineWidth: 1.3).frame(width: 18, height: 18)
            TextField(T("Ny …", "New …"), text: Binding(get: { newText[key] ?? "" }, set: { newText[key] = $0 }))
                .font(.system(size: 16 * Ink.scale)).autocorrectionDisabled(true)
                .focused($focus, equals: "new-" + key).submitLabel(.return)
                .onSubmit {
                    let t = (newText[key] ?? "").trimmingCharacters(in: .whitespaces)
                    if !t.isEmpty { todo.add(t, to: l); newText[key] = ""; focus = "new-" + key }
                }
        }
        .listRowBackground(Ink.paper)
        .moveDisabled(true)
    }

    private func commitEdit() {
        if let id = editing, let r = todo.items.first(where: { $0.calendarItemIdentifier == id }) { todo.setTitle(r, text) }
        editing = nil
    }
    private func open(_ scheme: String, _ number: String) {
        let digits = number.filter { "+0123456789".contains($0) }
        if let u = URL(string: scheme + digits) { UIApplication.shared.open(u) }
    }
}
#endif
