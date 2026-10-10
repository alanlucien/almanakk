// THE MOON (Alan, 11.10: "moon phases we need!"). New moon, first quarter, full moon and
// last quarter, as an almanac prints them. Ported from v3/app.js, which took it from
// Meeus, Astronomical Algorithms ch. 49: the phase instants to within about a minute,
// far inside a day. Shown on the day it falls, in his local date.
import Foundation

enum Moon {
    struct Phase { var glyph: String; var name: String }
    static let phases = [Phase(glyph: "●", name: "Nymåne"), Phase(glyph: "◐", name: "Første kvarter"),
                         Phase(glyph: "○", name: "Fullmåne"), Phase(glyph: "◑", name: "Siste kvarter")]
    private static var cache: [Int: [String: Phase]] = [:]

    static func turn(_ ds: String) -> Phase? { year(Int(ds.prefix(4))!)[ds] }

    static func year(_ y: Int) -> [String: Phase] {
        if let c = cache[y] { return c }
        var map: [String: Phase] = [:]
        let k0 = Int(floor(Double(y - 2000) * 12.3685)) - 1
        for k in k0..<(k0 + 15) {
            for q in 0..<4 {
                let jde = phaseJDE(Double(k), q)
                let date = Date(timeIntervalSince1970: (jde - 2440587.5) * 86400)
                let key = Day.key(date)
                if key.hasPrefix(String(y)) { map[key] = phases[q] }
            }
        }
        cache[y] = map
        return map
    }

    private static func phaseJDE(_ k0: Double, _ q: Int) -> Double {
        let rad = Double.pi / 180
        func s(_ a: Double) -> Double { sin(a * rad) }
        func c(_ a: Double) -> Double { cos(a * rad) }
        let k = k0 + Double(q) / 4
        let T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T
        var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4
        let E = 1 - 0.002516 * T - 0.0000074 * T2
        let M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3
        let M1 = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4
        let F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4
        let O = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3
        if q == 0 || q == 2 {
            let a = q == 0 ? -0.4072 : -0.40614, b = q == 0 ? 0.17241 : 0.17302
            let cc = q == 0 ? 0.01608 : 0.01614, d = q == 0 ? 0.01039 : 0.01043, e = q == 0 ? 0.00739 : 0.00734
            var t = a * s(M1) + b * E * s(M) + cc * s(2 * M1) + d * s(2 * F)
            t += e * E * s(M1 - M) - 0.00514 * E * s(M1 + M) + 0.00208 * E * E * s(2 * M)
            t += -0.00111 * s(M1 - 2 * F) - 0.00057 * s(M1 + 2 * F) + 0.00056 * E * s(2 * M1 + M)
            t += -0.00042 * s(3 * M1) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
            t += -0.00024 * E * s(2 * M1 - M) - 0.00017 * s(O) - 0.00007 * s(M1 + 2 * M)
            jde += t
        } else {
            var t = -0.62801 * s(M1) + 0.17172 * E * s(M) - 0.01183 * E * s(M1 + M)
            t += 0.00862 * s(2 * M1) + 0.00804 * s(2 * F) + 0.00454 * E * s(M1 - M)
            t += 0.00204 * E * E * s(2 * M) - 0.0018 * s(M1 - 2 * F) - 0.0007 * s(M1 + 2 * F)
            t += -0.0004 * s(3 * M1) - 0.00034 * E * s(2 * M1 - M) + 0.00032 * E * s(M + 2 * F)
            t += 0.00032 * E * s(M - 2 * F) - 0.00028 * E * E * s(M1 + 2 * M) + 0.00027 * E * s(2 * M1 + M)
            t += -0.00017 * s(O)
            jde += t
            var W = 0.00306 - 0.00038 * E * c(M) + 0.00026 * c(M1)
            W += -0.00002 * c(M1 - M) + 0.00002 * c(M1 + M) + 0.00002 * c(2 * F)
            jde += q == 1 ? W : -W
        }
        return jde
    }
}
