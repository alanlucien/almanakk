// EDITING (stage 3, 10.10.2026). The sheet opens to READ (Alan: "not straight into edit
// mode"); an entry's details carry Endre / Bekreft / Slett; the add line sits quietly at
// the foot and shows how it reads what he types before anything is saved; the full form
// is laid out like Apple Calendar's (Alan, 09.10: "edit like Apple cal").
#if os(iOS)
import SwiftUI

// ---------- the add line ----------

struct AddLine: View {
    @ObservedObject var store: Store
    let date: String
    let zone: String
    var openForm: (Draft) -> Void
    @State private var text = ""
    @State private var alt = false
    @State private var moving = false
    @FocusState private var focused: Bool

    var body: some View {
        let draft = QuickAdd.read(text, day: date, zone: zone, alt: alt)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                // NO AUTOCORRECT: his titles are names — Vildanden, Taichung, YNGVAR — and the
                // keyboard "corrected" Almanakk to Almanac in the first real test (10.10)
                TextField("Ny hendelse …", text: $text)
                    .font(.system(size: (16) * Ink.scale)).focused($focused).submitLabel(.send)
                    .autocorrectionDisabled(true)
                    .onSubmit { add(draft) }
                    .onChange(of: text) { alt = false }
                if !text.isEmpty {
                    Button("Legg til") { add(draft) }.font(.system(size: (14) * Ink.scale, weight: .semibold))
                }
                // a move, picked rather than typed (CONVENTIONS 3)
                Button("Reise") { focused = false; moving = true }
                    .font(.system(size: (14) * Ink.scale))
                Button("Skjema") {
                    var d = draft ?? Draft(day: date)
                    if draft == nil { d.zone = zone }
                    text = ""; focused = false
                    openForm(d)
                }
                .font(.system(size: (14) * Ink.scale))
            }
            .foregroundStyle(Ink.ink)
            // THE READING, BEFORE SAVING (CONVENTIONS 9): one tap switches days ↔ clock
            if let d = draft, !text.isEmpty {
                Button { alt.toggle() } label: {
                    Text(d.reading + (d.pencil ? " · blyant" : "")).font(.system(size: (12) * Ink.scale)).foregroundStyle(Ink.muted)
                }
            }
        }
        .padding(.vertical, 12)
        .sheet(isPresented: $moving) {
            MoveForm(store: store, date: date, zone: zone).presentationDetents([.medium])
        }
    }

    private func add(_ d: Draft?) {
        guard var d, !d.title.isEmpty else { return }
        d.calId = store.defaultCal
        Task {
            if await store.save(d, editing: nil) { text = ""; alt = false }
        }
    }
}

// ---------- the form ----------

struct EventForm: View {
    @ObservedObject var store: Store
    @State var draft: Draft
    let editing: CalEvent?
    let cityZone: String
    let city: String
    @Environment(\.dismiss) private var dismiss
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tittel", text: $draft.title).font(.system(size: (17) * Ink.scale)).autocorrectionDisabled(true)
                    TextField("Sted", text: $draft.location).autocorrectionDisabled(true)
                }
                Section {
                    Toggle("Heldag", isOn: $draft.allDay.animation())
                        .onChange(of: draft.allDay) { if !draft.allDay && draft.time.isEmpty { draft.time = "09:00"; draft.endTime = "10:00" } }
                    DatePicker("Starter", selection: day(\.start), displayedComponents: .date)
                    if draft.allDay {
                        DatePicker("Slutter", selection: day(\.end), in: Day.date(draft.start)..., displayedComponents: .date)
                    } else {
                        DatePicker("Fra", selection: clock(\.time), displayedComponents: .hourAndMinute)
                        DatePicker("Til", selection: clock(\.endTime), displayedComponents: .hourAndMinute)
                        Picker("Tidssone", selection: $draft.zone) {
                            ForEach(zoneChoices, id: \.self) { Text(Places.zoneLabel($0, city: city)).tag($0) }
                        }
                    }
                }
                Section {
                    Picker("Kalender", selection: $draft.calId) {
                        ForEach(store.writable) { Text($0.name).tag($0.id) }
                    }
                    Toggle("Blyant", isOn: $draft.pencil)
                    swatches
                }
                Section("Notater") {
                    TextEditor(text: $draft.notes).frame(minHeight: 90)
                }
                if let e = editing {
                    Section {
                        Button("Slett hendelsen", role: .destructive) {
                            Task { await store.delete(e); dismiss() }
                        }
                    }
                }
                if let p = store.problem { Section { Text(p).foregroundStyle(Ink.red).font(.system(size: (13) * Ink.scale)) } }
            }
            .navigationTitle(editing == nil ? "Ny hendelse" : "Endre")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Lagrer …" : "Lagre") {
                        saving = true
                        Task {
                            if draft.end < draft.start { draft.end = draft.start }
                            let ok = await store.save(draft, editing: editing)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(draft.title.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
        .onAppear { if draft.calId.isEmpty { draft.calId = store.defaultCal } }
    }

    /// the day's city first (CONVENTIONS 16), then Oslo, the phone's, and the event's own
    private var zoneChoices: [String] {
        var out: [String] = []
        for z in [cityZone, "Europe/Oslo", TimeZone.current.identifier, draft.zone] where !out.contains(z) { out.append(z) }
        return out
    }

    /// his eight colours, and the calendar's own (no colour of its own)
    private var swatches: some View {
        HStack(spacing: 10) {
            Text("Farge")
            Spacer()
            swatch("", Ink.hex(store.calendars.first { $0.id == draft.calId }?.color ?? "#26241f"))
            ForEach(Palette.order, id: \.self) { swatch($0, Ink.hex(Palette.dusty[$0]!)) }
        }
    }
    private func swatch(_ id: String, _ c: Color) -> some View {
        Circle().fill(c).frame(width: 20, height: 20)
            .overlay(Circle().stroke(Ink.ink, lineWidth: draft.colorId == id ? 2 : 0).padding(-3))
            .accessibilityLabel(Palette.names[id] ?? "Kalenderens farge")
            .onTapGesture { draft.colorId = id }
    }

    private func day(_ k: WritableKeyPath<Draft, String>) -> Binding<Date> {
        Binding(get: { Day.date(draft[keyPath: k]) }, set: {
            draft[keyPath: k] = Day.key($0)
            if k == \Draft.start && draft.end < draft.start { draft.end = draft.start }
        })
    }
    private func clock(_ k: WritableKeyPath<Draft, String>) -> Binding<Date> {
        Binding(get: {
            let p = (draft[keyPath: k].isEmpty ? Draft.plusHour(draft.time) : draft[keyPath: k]).split(separator: ":").compactMap { Int($0) }
            return Day.greg.date(bySettingHour: p.first ?? 9, minute: p.count > 1 ? p[1] : 0, second: 0, of: Date()) ?? Date()
        }, set: {
            let c = Day.greg.dateComponents([.hour, .minute], from: $0)
            draft[keyPath: k] = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
        })
    }
}

// ---------- the line that says what happened ----------

struct ToastBar: View {
    @ObservedObject var store: Store
    var body: some View {
        if let t = store.toast {
            HStack(spacing: 14) {
                Text(t.text).font(.system(size: (14) * Ink.scale, weight: .medium))
                if let undo = t.undo {
                    Button("Angre") {
                        store.toast = nil
                        Task { @MainActor in await undo() }
                    }
                    .font(.system(size: (14) * Ink.scale, weight: .semibold))
                    .buttonStyle(.plain)
                }
            }
            .foregroundStyle(Ink.paper)
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(Capsule().fill(Ink.ink))
            .padding(.bottom, 12)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task(id: t.id) {
                // an interrupted wait must not clear the line (it did: "Angre" vanished)
                do { try await Task.sleep(for: .seconds(t.undo == nil ? 2.5 : 10)) } catch { return }
                if store.toast?.id == t.id { withAnimation { store.toast = nil } }
            }
        }
    }
}
#endif

#if os(iOS)
// "REISE TIL …" (CONVENTIONS 3, decided 10.10): a move picked, not typed. Writes the same
// event a typed "-Roma" did — "→ Roma", optionally at a time, "?" when pencilled — so
// subscribers and every other client read it as before.
struct MoveForm: View {
    @ObservedObject var store: Store
    let date: String
    let zone: String
    @Environment(\.dismiss) private var dismiss
    @State private var place = ""
    @State private var day = Date()
    @State private var timed = false
    @State private var at = Date()
    @State private var pencil = false

    private var suggestions: [String] {
        let q = place.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 2 else { return [] }
        let names = Set(Places.iata.values).union(Places.extra)
        return names.filter { $0.lowercased().hasPrefix(q) }.sorted().prefix(4).map { $0 }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Til (by eller sted)", text: $place).autocorrectionDisabled(true)
                    ForEach(suggestions, id: \.self) { s in
                        Button(s) { place = s }.foregroundStyle(Ink.ink)
                    }
                }
                Section {
                    DatePicker("Dag", selection: $day, displayedComponents: .date)
                    Toggle("Klokkeslett", isOn: $timed)
                    if timed { DatePicker("Kl.", selection: $at, displayedComponents: .hourAndMinute) }
                    Toggle("Blyant", isOn: $pencil)
                }
                if let p = store.problem { Section { Text(p).foregroundStyle(Ink.red).font(.system(size: 13 * Ink.scale)) } }
            }
            .navigationTitle("Reise til …").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        var d = Draft(day: Day.key(day))
                        d.title = "→ " + place.trimmingCharacters(in: .whitespaces)
                        d.pencil = pencil
                        d.calId = store.defaultCal
                        d.zone = zone
                        if timed {
                            let c = Day.greg.dateComponents([.hour, .minute], from: at)
                            d.allDay = false; d.time = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
                        }
                        Task { if await store.save(d, editing: nil) { dismiss() } }
                    }
                    .disabled(place.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .environment(\.locale, Locale(identifier: "nb_NO"))
        .onAppear { day = Day.date(date) }
    }
}
#endif
