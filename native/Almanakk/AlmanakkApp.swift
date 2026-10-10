// Almanakk — the iPhone and Mac app.
//
// Stage A of "three surfaces, one almanac" (STATUS.md, 23.09.2026): a window
// around the live web almanac at almanakk-v2.pages.dev. The renderer, the
// sign-in and the data are all the web app's; this file owns the window, the
// icon and nothing else. Stage B bundles the assets and moves sign-in into the
// app; the native views then replace the web view one at a time, day first.
import SwiftUI

@main
struct AlmanakkApp: App {
    @StateObject private var page = Page()

    var body: some Scene {
        WindowGroup {
            // THE FULL APP, IPHONE FIRST (Alan, 09.10). Since TestFlight build 5 (10.10)
            // the iPhone runs the native almanac: Google sign-in, editing, week, year, and
            // the widgets' snapshot written by the app itself. The Mac keeps the web
            // almanac until it gets a design of its own.
            #if os(iOS)
            NativeRoot()
            #else
            ContentView(page: page)
            #endif
        }
        #if os(macOS)
        // The Mac is where the quarter and the year live: the year is six months
        // over six and wants about 1180 points. Open wide enough to show it.
        .defaultSize(width: 1280, height: 860)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(after: .toolbar) {
                Button("Last inn på nytt") { page.reload() }.keyboardShortcut("r")
                Button("Til almanakken") { page.load() }.keyboardShortcut("h", modifiers: [.command, .shift])
            }
        }
        #endif
    }
}

struct ContentView: View {
    @ObservedObject var page: Page

    var body: some View {
        ZStack {
            // the almanac's own paper, so the status bar and any gap read as the page
            Color(red: 0xeb / 255, green: 0xeb / 255, blue: 0xe7 / 255).ignoresSafeArea()
            WebView(page: page)
                // under the home indicator: the page already keeps its last row
                // clear of it (env(safe-area-inset-bottom)); the status bar stays ours
                .ignoresSafeArea(.container, edges: .bottom)
            if let err = page.error {
                VStack(spacing: 12) {
                    Text(T("Almanakken får ikke kontakt", "The almanac can't connect")).font(.headline)
                    Text(err).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button(T("Prøv igjen", "Try again")) { page.load() }
                }
                .padding(24)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
                .padding()
            }
        }
        #if os(macOS)
        .frame(minWidth: 900, minHeight: 600)
        #endif
    }
}
