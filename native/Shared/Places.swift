// WHERE HE IS: the flight reader, ported from v3/app.js ("cities") with the same tables
// and the same test cases. A title moves his city only when it plainly is a flight or a
// move; anything else ("Meet Ellen - afternoon") is never a place. The full airport table
// (airports.json, from the open mwgg/Airports set) is a fallback for codes written in
// capitals; the curated names here always win (Tromsø, not Tromso).
import Foundation

enum Places {
    /// Airport and metro codes -> the calendar's own city names (IATA_CITIES)
    static let iata: [String: String] = [
        "OSL": "Oslo", "BGO": "Bergen", "TRD": "Trondheim", "SVG": "Stavanger", "KRS": "Kristiansand", "TOS": "Tromsø", "AES": "Ålesund", "BOO": "Bodø",
        "CPH": "København", "ARN": "Stockholm", "STO": "Stockholm", "GOT": "Göteborg", "HEL": "Helsinki", "KEF": "Reykjavík",
        "LHR": "London", "LGW": "London", "STN": "London", "LCY": "London", "LTN": "London", "LON": "London",
        "CDG": "Paris", "ORY": "Paris", "PAR": "Paris", "AMS": "Amsterdam", "BRU": "Brussel",
        "FRA": "Frankfurt", "MUC": "München", "DUS": "Düsseldorf", "BER": "Berlin", "TXL": "Berlin", "HAM": "Hamburg", "CGN": "Köln", "STR": "Stuttgart",
        "ZRH": "Zürich", "GVA": "Genève", "VIE": "Wien", "PRG": "Praha", "WAW": "Warszawa", "BUD": "Budapest", "KRK": "Kraków",
        "MXP": "Milano", "LIN": "Milano", "MIL": "Milano", "FCO": "Roma", "CIA": "Roma", "ROM": "Roma", "VCE": "Venezia", "NAP": "Napoli", "BLQ": "Bologna", "FLR": "Firenze", "TRN": "Torino", "PSA": "Pisa",
        "ATH": "Athen", "SKG": "Thessaloniki", "IST": "Istanbul", "MAD": "Madrid", "BCN": "Barcelona", "LIS": "Lisboa", "OPO": "Porto",
        "DUB": "Dublin", "EDI": "Edinburgh", "MAN": "Manchester", "MRS": "Marseille", "NCE": "Nice", "LYS": "Lyon", "TLS": "Toulouse",
        "JFK": "New York", "EWR": "New York", "LGA": "New York", "NYC": "New York", "BOS": "Boston", "IAD": "Washington", "DCA": "Washington",
        "ORD": "Chicago", "LAX": "Los Angeles", "SFO": "San Francisco", "MIA": "Miami", "YYZ": "Toronto", "YUL": "Montreal",
        "EZE": "Buenos Aires", "AEP": "Buenos Aires", "GRU": "São Paulo", "GIG": "Rio de Janeiro", "SCL": "Santiago", "BOG": "Bogotá", "MEX": "Mexico City", "LIM": "Lima",
        "NRT": "Tokyo", "HND": "Tokyo", "TYO": "Tokyo", "KIX": "Osaka", "ITM": "Osaka", "OSA": "Osaka", "NGO": "Nagoya", "FUK": "Fukuoka", "CTS": "Sapporo", "OKA": "Okinawa",
        "ICN": "Seoul", "GMP": "Seoul", "PEK": "Beijing", "PKX": "Beijing", "PVG": "Shanghai", "SHA": "Shanghai",
        "HKG": "Hong Kong", "HGK": "Hong Kong", "TPE": "Taipei", "BKK": "Bangkok", "DMK": "Bangkok", "USM": "Koh Samui", "HKT": "Phuket",
        "SIN": "Singapore", "KUL": "Kuala Lumpur", "CGK": "Jakarta", "DPS": "Bali", "HAN": "Hanoi", "SGN": "Ho Chi Minh",
        "DEL": "Delhi", "BOM": "Mumbai", "DXB": "Dubai", "DOH": "Doha", "AUH": "Abu Dhabi", "TLV": "Tel Aviv", "CAI": "Kairo",
        "JNB": "Johannesburg", "CPT": "Cape Town", "SYD": "Sydney", "MEL": "Melbourne", "BNE": "Brisbane", "PER": "Perth", "AKL": "Auckland",
    ]
    /// Places with no airport code of their own (EXTRA_PLACES): add as he hits them
    static let extra = [
        "Wuppertal", "Mainz", "Essen", "Bochum", "Dortmund", "Leipzig", "Dresden", "Hannover",
        "Nürnberg", "Bremen", "Freiburg", "Karlsruhe", "Mannheim", "Wiesbaden", "Bonn", "Münster",
        "Kassel", "Heidelberg", "Darmstadt", "Aachen", "Augsburg", "Weimar", "Halle",
        "Avignon", "Aix-en-Provence", "Montpellier", "Grenoble", "Nantes", "Rennes", "Strasbourg",
        "Lausanne", "Bern", "Basel", "Luzern", "Salzburg", "Graz", "Linz", "Innsbruck",
        "Bergamo", "Brescia", "Modena", "Parma", "Ferrara", "Ravenna", "Perugia", "Siena",
        "Lillehammer", "Hamar", "Tønsberg", "Sandefjord", "Fredrikstad", "Drammen", "Larvik",
        "Skien", "Arendal", "Molde", "Røros", "Voss", "Geilo", "Hemsedal", "Lofoten",
        "Gent", "Antwerpen", "Brugge", "Rotterdam", "Utrecht", "Groningen", "Maastricht",
        "Aarhus", "Odense", "Malmö", "Uppsala", "Tampere", "Turku", "Tallinn", "Riga", "Vilnius",
    ]
    /// English spellings that resolve to the calendar's own (EXONYM_EN, read both ways)
    static let exonym: [String: String] = [
        "København": "Copenhagen", "Göteborg": "Gothenburg", "Wien": "Vienna", "Praha": "Prague",
        "Warszawa": "Warsaw", "München": "Munich", "Köln": "Cologne", "Roma": "Rome",
        "Milano": "Milan", "Napoli": "Naples", "Firenze": "Florence", "Venezia": "Venice",
        "Torino": "Turin", "Lisboa": "Lisbon", "Athen": "Athens", "Moskva": "Moscow",
        "Genève": "Geneva", "Zürich": "Zurich", "Brussel": "Brussels", "Kairo": "Cairo",
        "Kraków": "Krakow",
    ]
    static let byName: [String: String] = {
        var m: [String: String] = [:]
        for n in iata.values { m[n.lowercased()] = n }
        for n in extra { m[n.lowercased()] = n }
        for (no, en) in exonym { m[en.lowercased()] = no; m[no.lowercased()] = no }
        return m
    }()
    static let airports: [String: String] = {
        guard let url = Bundle.main.url(forResource: "airports", withExtension: "json"),
              let d = try? Data(contentsOf: url), let m = try? JSONDecoder().decode([String: String].self, from: d) else { return [:] }
        return m
    }()

    /// a code or a name -> the city as the calendar spells it (cityName)
    static func name(_ place: String) -> String {
        let n = iata[place] ?? airports[place] ?? place
        return englishUI ? (exonym[n] ?? n) : n          // Roma / Rome, as the language reads
    }

    /// placeOf: a 3-letter code (any case, curated), a code in capitals (full table), or a known name
    static func placeOf(_ s: String) -> String? {
        if s.isEmpty { return nil }
        if RX.test("^[A-Za-zÆØÅæøå]{3}$", s), iata[s.uppercased()] != nil { return s.uppercased() }
        if RX.test("^[A-Z]{3}$", s), airports[s] != nil { return s }
        return byName[s.lowercased()]
    }
    /// cleanLeg: times, flight numbers, brackets and a leading "Fly" go
    static func cleanLeg(_ s: String) -> String {
        var t = RX.sub("\\([^)]*\\)", s, " ")
        t = RX.sub("\\b\\d{1,2}[:.]\\d{2}\\b", t, " ")
        t = RX.sub("\\b[A-Z]{2}\\s?\\d{1,4}\\b", t, " ")
        t = t.squeezed
        return RX.sub("^(?:fly|flight|reise|tog|train)\\s+", t, "", ci: true).trimmingCharacters(in: .whitespaces)
    }
    /// legPlace: allows a booking reference glued to the name ("YLHNAI Oslo")
    static func legPlace(_ part: String) -> String? {
        let s = cleanLeg(part)
        if let p = placeOf(s) { return p }
        if let g = RX.groups("^[A-Z][A-Z0-9]{4,7}\\s+(.+)$", s) { return placeOf(g[1]) }
        return nil
    }
    /// flightLegs: the longest run of legs that all resolve; a comma ends a route (10.10)
    static func legs(_ title: String) -> [String] {
        let bare = RX.sub("\\btbc\\b", title, " ", ci: true).trimmingCharacters(in: .whitespaces)
        var best: [String] = []
        for piece in bare.components(separatedBy: CharacterSet(charactersIn: ",;")) {
            var run: [String] = []
            let parts = RX.re("\\s*(?:[-–—]+|[>→]+)\\s*").stringByReplacingMatches(
                in: piece, range: NSRange(piece.startIndex..., in: piece), withTemplate: "\u{1}").components(separatedBy: "\u{1}")
            for part in parts {
                if let p = legPlace(part) { run.append(p); if run.count > best.count { best = run } } else { run = [] }
            }
        }
        return best.count >= 2 ? best : []
    }
    /// placesIn: every place named anywhere in the title, two-word names first
    static func placesIn(_ title: String) -> [String] {
        let words = RX.sub("[()\\[\\],.;:]", title, " ").split(separator: " ").map(String.init)
        var found: [String] = []
        var i = 0
        while i < words.count {
            if i + 1 < words.count, let two = placeOf(words[i] + " " + words[i + 1]) { found.append(two); i += 2; continue }
            if let one = placeOf(words[i]) { found.append(one) }
            i += 1
        }
        return found
    }
    static func hasFlightWord(_ t: String) -> Bool { RX.test("\\b(?:fly|flight)\\b", t, ci: true) }

    /// flightDest: where a flight title ends up, or nil when it is no flight
    static func dest(_ title: String) -> String? {
        let l = legs(title)
        if let last = l.last { return last }
        if hasFlightWord(title) {
            let named = placesIn(title)
            if named.count >= 2 { return named.last }
        }
        if let g = RX.groups("\\b(?:fly|flight)\\b[^.,;]*?\\b(?:til|to)\\s+([A-ZÆØÅa-zæøå][A-Za-zæøåÆØÅ]{2,})", title, ci: true) {
            return placeOf(g[1]) ?? g[1]
        }
        if let g = RX.groups("\\b(?:fly|flight)\\s+([A-ZÆØÅa-zæøå][A-Za-zæøåÆØÅ]{2,})", title, ci: true),
           !RX.test("^(?:til|to|fra|from)$", g[1], ci: true) {
            return placeOf(g[1]) ?? g[1]
        }
        return nil
    }
    /// flightRoute: how a flight reads on the day line. EVERY CITY STAYS ON THE LINE (Alan,
    /// 11.10: "oslo-x-amsterdam"), so a stop is seen, not hidden: "Oslo → Roma → Amsterdam"
    static func route(_ title: String) -> String? {
        var l = legs(title)
        if l.count < 2 && hasFlightWord(title) { l = placesIn(title) }
        guard l.count >= 2 else { return nil }
        var names: [String] = []
        for c in l.map(name) where names.last != c { names.append(c) }
        return names.joined(separator: " → ")
    }

    /// A DAY'S FLIGHTS THAT MEET ARE ONE JOURNEY: "OSL-CAI" at 08:00 and "CAI-AMS" at 15:00
    /// read "Oslo → Roma → Amsterdam" at 08:00 (collapseJourneys, with every city kept).
    /// The day sheet keeps each flight as it is.
    static func joinJourneys(_ timed: [CalEvent]) -> [CalEvent] {
        var out: [CalEvent] = []
        var lastLegs: [String] = []
        for e in timed {
            let l = legs(e.title)
            if l.count >= 2, var prev = out.last, lastLegs.count >= 2, lastLegs.last == l.first {
                lastLegs += l.dropFirst()
                prev.title = "Flight " + lastLegs.joined(separator: "-")
                out[out.count - 1] = prev
                continue
            }
            out.append(e)
            lastLegs = l
        }
        return out
    }
    /// nightFlight: a flight leaving 00:00–03:29 belongs to the evening before
    static func nightFlight(_ title: String, time: String) -> Bool {
        let p = time.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2, p[0] * 60 + p[1] < 3 * 60 + 30 else { return false }
        return dest(title) != nil
    }
}

// ---------- check-in (CONVENTIONS 18) ----------

/// A flight's check-in: the booking reference (the first line of the notes, by the
/// add-flight form) and the airline's check-in page. iOS opens the airline's app instead
/// of the page when it is installed and claims the link.
enum CheckIn {
    struct Airline { var name: String; var codes: [String]; var url: String }
    // check-in pages as of 10.10.2026, not yet each tried on his phone (STATUS)
    static let airlines = [
        Airline(name: "SAS", codes: ["SK"], url: "https://www.flysas.com/en/check-in/"),
        Airline(name: "Norwegian", codes: ["DY", "D8"], url: "https://www.norwegian.com/en/travel-info/check-in/"),
        Airline(name: "Widerøe", codes: ["WF"], url: "https://www.wideroe.no/en/check-in"),
        Airline(name: "KLM", codes: ["KL"], url: "https://www.klm.com/check-in"),
        Airline(name: "Air France", codes: ["AF"], url: "https://www.airfrance.com/check-in"),
        Airline(name: "Lufthansa", codes: ["LH"], url: "https://www.lufthansa.com/online-check-in"),
        Airline(name: "Transavia", codes: ["TO", "HV"], url: "https://www.transavia.com/en-EU/service/check-in/"),
    ]
    /// the booking reference: 5–8 capitals and digits leading the notes ("ABC123 · SURNAME/NAME")
    static func reference(_ notes: String) -> String? {
        let plain = RX.sub("<[^>]+>", notes, " ")
        for line in plain.split(whereSeparator: \.isNewline).prefix(3) {
            if let g = RX.groups("^\\s*([A-Z0-9]{5,8})\\b", String(line)), RX.test("[A-Z]", g[1]) { return g[1] }
        }
        // the older form: "ref ABC123" anywhere
        return RX.groups("\\bref\\.?\\s*([A-Z0-9]{5,8})\\b", plain, ci: true)?[1].uppercased()
    }
    static func airline(_ e: CalEvent) -> Airline? {
        let text = e.title + "\n" + e.notes
        for a in airlines where RX.test("\\b" + NSRegularExpression.escapedPattern(for: a.name) + "\\b", text, ci: true) { return a }
        for a in airlines { for c in a.codes where RX.test("\\b\(c)\\s?\\d{2,4}\\b", text) { return a } }
        return nil
    }
}
