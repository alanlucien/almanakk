// GOOGLE, NATIVELY (stage 2 of the full iPhone app, 10.10.2026). Sign-in is the phone's
// own web-authentication sheet with PKCE — Google's flow for iOS apps, no client secret
// (an iOS client has none). The refresh token lives in the Keychain; the access token
// only in memory. The Calendar REST API is read and written directly, the same calls the
// web almanac makes through gcal.js.
#if os(iOS)
import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit

enum GoogleConfig {
    /// The iOS OAuth client from Google Cloud project ALMANAKK. Public by design: an iOS
    /// client has no secret. Created by Alan 10.10.2026 ("Almanakk iPhone").
    static let clientID = "293526338095-onhqma25jugs5tvncuhccvi2mgfjuls9.apps.googleusercontent.com"
    static var redirectScheme: String {
        "com.googleusercontent.apps." + clientID.replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
    }
    static var redirectURI: String { redirectScheme + ":/oauth2redirect" }
    static let scope = "https://www.googleapis.com/auth/calendar"
    static var configured: Bool { !clientID.isEmpty }
}

enum GoogleError: LocalizedError {
    case notConfigured, cancelled, http(Int, String), noToken
    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Google-innlogging er ikke satt opp ennå."
        case .cancelled: return "Innloggingen ble avbrutt."
        case .http(let c, let m): return "Google svarte \(c): \(m)"
        case .noToken: return "Ikke logget inn."
        }
    }
}

// ---------- the refresh token, in the Keychain ----------
enum Keychain {
    static let service = "com.winterguests.almanakk.google"
    static func save(_ s: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
        SecItemDelete(q as CFDictionary)
        var add = q; add[kSecValueData as String] = Data(s.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
    static func load() -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    static func clear() {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary)
    }
}

@MainActor
final class GoogleAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = GoogleAuth()
    private var access: String?
    private var expires = Date.distantPast
    private var session: ASWebAuthenticationSession?

    var hasAccount: Bool { Keychain.load() != nil }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }

    /// The sign-in sheet: Google's page, then back into the app with a code.
    func signIn() async throws {
        guard GoogleConfig.configured else { throw GoogleError.notConfigured }
        let verifier = Self.randomURLSafe(32)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        var c = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        c.queryItems = [
            .init(name: "client_id", value: GoogleConfig.clientID),
            .init(name: "redirect_uri", value: GoogleConfig.redirectURI),
            .init(name: "response_type", value: "code"),
            .init(name: "scope", value: GoogleConfig.scope),
            .init(name: "code_challenge", value: challenge),
            .init(name: "code_challenge_method", value: "S256"),
        ]
        let callback: URL = try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: c.url!, callbackURLScheme: GoogleConfig.redirectScheme) { url, err in
                if let url { cont.resume(returning: url) }
                else if let e = err as? ASWebAuthenticationSessionError, e.code == .canceledLogin { cont.resume(throwing: GoogleError.cancelled) }
                else { cont.resume(throwing: err ?? GoogleError.cancelled) }
            }
            s.presentationContextProvider = self
            session = s
            s.start()
        }
        guard let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value
        else { throw GoogleError.cancelled }
        let tok = try await tokenRequest(["code": code, "client_id": GoogleConfig.clientID, "redirect_uri": GoogleConfig.redirectURI,
                                          "grant_type": "authorization_code", "code_verifier": verifier])
        if let r = tok["refresh_token"] as? String { Keychain.save(r) }
        take(tok)
    }

    func signOut() { Keychain.clear(); access = nil; expires = .distantPast }

    /// A valid access token, renewed from the refresh token when it is near its end.
    func token() async throws -> String {
        if let a = access, expires > Date().addingTimeInterval(120) { return a }
        guard let refresh = Keychain.load() else { throw GoogleError.noToken }
        let tok = try await tokenRequest(["refresh_token": refresh, "client_id": GoogleConfig.clientID, "grant_type": "refresh_token"])
        take(tok)
        guard let a = access else { throw GoogleError.noToken }
        return a
    }

    private func take(_ tok: [String: Any]) {
        access = tok["access_token"] as? String
        expires = Date().addingTimeInterval(TimeInterval((tok["expires_in"] as? Int) ?? 3000))
    }

    private func tokenRequest(_ form: [String: String]) async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.httpBody = form.map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "")" }
            .joined(separator: "&").data(using: .utf8)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            // a refresh token Google no longer honours is forgotten, so the sign-in button shows
            if json["error"] as? String == "invalid_grant" { Keychain.clear() }
            throw GoogleError.http(status, (json["error_description"] as? String) ?? (json["error"] as? String) ?? "")
        }
        return json
    }

    static func randomURLSafe(_ n: Int) -> String {
        var b = [UInt8](repeating: 0, count: n)
        _ = SecRandomCopyBytes(kSecRandomDefault, n, &b)
        return Data(b).base64URL
    }
}

extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

// ---------- the Calendar API ----------
enum GCal {
    static let base = "https://www.googleapis.com/calendar/v3"

    static func get(_ path: String, _ query: [URLQueryItem] = []) async throws -> [String: Any] {
        var c = URLComponents(string: base + path)!
        if !query.isEmpty { c.queryItems = query }
        var req = URLRequest(url: c.url!)
        req.setValue("Bearer " + (try await GoogleAuth.shared.token()), forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard status == 200 else {
            throw GoogleError.http(status, ((json["error"] as? [String: Any])?["message"] as? String) ?? "")
        }
        return json
    }

    /// A write: POST, PATCH or DELETE, with the response checked (CLAUDE.md: a silent
    /// failure means he believes something was saved when it was not).
    static func send(_ method: String, _ path: String, body: [String: Any]? = nil, query: [URLQueryItem] = []) async throws -> [String: Any] {
        var c = URLComponents(string: base + path)!
        if !query.isEmpty { c.queryItems = query }
        var req = URLRequest(url: c.url!)
        req.httpMethod = method
        req.setValue("Bearer " + (try await GoogleAuth.shared.token()), forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard status == 200 || status == 204 else {
            throw GoogleError.http(status, ((json["error"] as? [String: Any])?["message"] as? String) ?? "")
        }
        return json
    }
    static func path(_ cal: String) -> String {
        "/calendars/" + (cal.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "@#"))) ?? cal)
    }
    static func gid(_ e: CalEvent) -> String { String(e.id.dropFirst(e.calId.count + 1)) }

    static func insert(cal: String, body: [String: Any]) async throws -> CalEvent? {
        event(try await send("POST", path(cal) + "/events", body: body), cal: cal)
    }
    static func patch(_ e: CalEvent, body: [String: Any]) async throws -> CalEvent? {
        event(try await send("PATCH", path(e.calId) + "/events/" + gid(e), body: body), cal: e.calId)
    }
    static func delete(_ e: CalEvent) async throws {
        _ = try await send("DELETE", path(e.calId) + "/events/" + gid(e))
    }
    /// to another calendar: Google's own move, so the event keeps its history
    static func move(_ e: CalEvent, to cal: String) async throws -> CalEvent? {
        event(try await send("POST", path(e.calId) + "/events/" + gid(e) + "/move", query: [.init(name: "destination", value: cal)]), cal: cal)
    }

    static func calendars() async throws -> [CalInfo] {
        let j = try await get("/users/me/calendarList")
        return ((j["items"] as? [[String: Any]]) ?? []).compactMap { c in
            guard let id = c["id"] as? String, (c["hidden"] as? Bool) != true else { return nil }
            return CalInfo(id: id, name: (c["summaryOverride"] as? String) ?? (c["summary"] as? String) ?? id,
                           color: (c["backgroundColor"] as? String) ?? "#26241f")
        }
    }

    /// Every event of one calendar between two days, recurring ones expanded.
    static func events(cal: String, from: String, to: String) async throws -> [CalEvent] {
        var out: [CalEvent] = []
        var page: String? = nil
        let enc = cal.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "@#"))) ?? cal
        repeat {
            var q: [URLQueryItem] = [
                .init(name: "timeMin", value: from + "T00:00:00Z"), .init(name: "timeMax", value: to + "T23:59:59Z"),
                .init(name: "singleEvents", value: "true"), .init(name: "maxResults", value: "2500"),
            ]
            if let p = page { q.append(.init(name: "pageToken", value: p)) }
            let j = try await get("/calendars/\(enc)/events", q)
            for ev in (j["items"] as? [[String: Any]]) ?? [] { if let e = event(ev, cal: cal) { out.append(e) } }
            page = j["nextPageToken"] as? String
        } while page != nil
        return out
    }

    /// Google's event as the engine keeps it (gcal.js, the same reading): an all-day end
    /// is exclusive in Google and inclusive here; a timed event shows its OWN local clock.
    static func event(_ ev: [String: Any], cal: String) -> CalEvent? {
        guard let gid = ev["id"] as? String, (ev["status"] as? String) != "cancelled",
              let s = ev["start"] as? [String: Any], let e = ev["end"] as? [String: Any] else { return nil }
        var start = "", end = "", time = "", endTime = "", dur = 0
        if let d = s["date"] as? String {
            start = d
            end = Day.add((e["date"] as? String) ?? d, -1)
            if end < start { end = start }
        } else if let st = s["dateTime"] as? String, let en = e["dateTime"] as? String {
            let (sd, stime) = local(st, zone: s["timeZone"] as? String)
            let (_, etime) = local(en, zone: (e["timeZone"] as? String) ?? (s["timeZone"] as? String))
            let iso = ISO8601DateFormatter()
            if let a = iso.date(from: st), let b = iso.date(from: en) { dur = max(0, Int(b.timeIntervalSince(a) / 60)) }
            // a timed event lives on its first day only, as in gcal.js (start = end)
            start = sd; end = sd; time = stime; endTime = etime
            // a flight leaving 00:00–03:29 belongs to the evening before: that is the night
            // he travels (gcal.js, Alan 02.09.2026)
            if Places.nightFlight((ev["summary"] as? String) ?? "", time: stime) { start = Day.add(sd, -1); end = start }
        } else { return nil }
        return CalEvent(id: cal + "/" + gid, calId: cal, title: (ev["summary"] as? String) ?? "(uten tittel)", start: start, end: end,
                        time: time, endTime: endTime, location: (ev["location"] as? String) ?? "", notes: (ev["description"] as? String) ?? "",
                        colorId: (ev["colorId"] as? String) ?? "", fromGmail: (ev["eventType"] as? String) == "fromGmail",
                        zone: (s["timeZone"] as? String) ?? "", minutes: dur)
    }

    /// "2026-10-09T11:20:00+02:00" in its zone -> ("2026-10-09", "11:20")
    static func local(_ iso: String, zone: String?) -> (String, String) {
        let f = ISO8601DateFormatter()
        guard let date = f.date(from: iso) else { return (String(iso.prefix(10)), String(iso.dropFirst(11).prefix(5))) }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US_POSIX")
        out.timeZone = zone.flatMap(TimeZone.init(identifier:)) ?? .current
        out.dateFormat = "yyyy-MM-dd HH:mm"
        let s = out.string(from: date)
        return (String(s.prefix(10)), String(s.suffix(5)))
    }
}
#endif
