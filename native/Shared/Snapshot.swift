// The widget's snapshot: the month rows exactly as the web almanac draws them
// (v3/app.js → monthData → snapshot), written by the app after every sync and read
// by the widget through the App Group. The widget never lays anything out itself:
// every rule, word and colour here was decided by the sheet.
import Foundation

struct Snapshot: Codable {
    struct Lane: Codable { var color: String; var a: Bool; var z: Bool }      // '' = empty lane
    struct Info: Codable { var kind: String; var text: String; var tbc: Bool } // uke · cty · hn
    struct Tour: Codable {
        var name: String      // ANTIGONE
        var word: String      // Get in · Work · Travel … ('' on a show day or the opening row)
        var perf: String      // "15" on a show day, else ''
        var city: String
        var tbc: Bool
        var open: Bool        // the row where the leg writes its name
    }
    struct Part: Codable {
        var kind: String      // span · allday · timed
        var time: String
        var text: String
        var color: String     // the dot's colour
        var ink: String       // '' = ink; a colour he chose himself, or red for a show
        var show: Bool
        var pencil: Bool
    }
    struct Day: Codable {
        var date: String      // YYYY-MM-DD
        var d: Int
        var wi: Int           // 0 = Monday
        var wd: String        // TIRSDAG
        var wl: String        // Ti
        var week: Int
        var hol: String
        var red: Bool
        var sun: Bool
        var city: String
        var tbc: Bool
        var show: Bool
        var nLanes: Int
        var lanes: [Lane]
        var info: Info?
        var tour: Tour?
        var parts: [Part]
    }
    var generated: String
    var lang: String
    var months: [String]
    var days: [Day]

    static let group = "group.com.winterguests.almanakk"
    static let file = "snapshot.json"

    static var url: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent(file)
    }
    /// Writes the page's JSON as it came, after checking that it parses.
    @discardableResult
    static func write(_ json: String) -> Bool {
        guard let data = json.data(using: .utf8), (try? JSONDecoder().decode(Snapshot.self, from: data)) != nil,
              let url = url else { return false }
        return (try? data.write(to: url, options: .atomic)) != nil
    }
    static func read() -> Snapshot? {
        guard let url = url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    func day(_ key: String) -> Day? { days.first { $0.date == key } }
    /// the seven days of the week holding `key`, Monday first (missing days are nil)
    func week(of key: String) -> [Day?] {
        guard let d = day(key) else { return Array(repeating: nil, count: 7) }
        let mon = Snapshot.shift(key, by: -d.wi)
        return (0..<7).map { day(Snapshot.shift(mon, by: $0)) }
    }
    /// the days of the month holding `key`
    func month(of key: String) -> [Day] { days.filter { $0.date.hasPrefix(String(key.prefix(7))) } }

    static func key(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }
    static func date(_ key: String) -> Date? {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"; return f.date(from: key)
    }
    static func shift(_ key: String, by days: Int) -> String {
        guard let d = date(key), let n = Calendar.current.date(byAdding: .day, value: days, to: d) else { return key }
        return Snapshot.key(n)
    }
}
