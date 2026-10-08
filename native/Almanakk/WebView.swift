import SwiftUI
import WebKit
import WidgetKit

/// The one web view, and what it is allowed to do.
final class Page: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    // v3 — the redesigned sheet (Front/REDESIGN — 06.10.md), production since 08.10
    static let home = URL(string: "https://almanakk-v2.pages.dev/v3/")!
    @Published var error: String?
    private(set) weak var web: WKWebView?

    func load() { error = nil; web?.load(URLRequest(url: Page.home)) }
    func reload() { error = nil; web?.reload() }

    // Google refuses to sign in inside anything it recognises as an embedded
    // web view ("this browser or app may not be secure"), and the Cloudflare
    // Access login in front of the almanac is a Google sign-in. A Safari
    // user-agent is what lets it through; WebKit is Safari's engine anyway.
    static var userAgent: String {
        #if os(macOS)
        return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
        #else
        return "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        #endif
    }

    func make() -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()   // the Access session survives a relaunch
        // the page hands the widget its snapshot through here after every sync
        cfg.userContentController.add(self, name: "almanakk")
        let w = WKWebView(frame: .zero, configuration: cfg)
        w.customUserAgent = Page.userAgent
        w.navigationDelegate = self
        w.uiDelegate = self
        #if os(iOS)
        w.allowsBackForwardNavigationGestures = true
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.isOpaque = false
        #endif
        w.underPageBackgroundColor = PlatformColor(red: 0xeb / 255, green: 0xeb / 255, blue: 0xe7 / 255, alpha: 1)
        web = w
        load()
        return w
    }

    // Everything the almanac itself needs stays in the window; a link out of it
    // (an event's Google Calendar page) goes to the real browser.
    private static let inside = ["pages.dev", "cloudflareaccess.com", "google.com", "gstatic.com", "googleapis.com", "googleusercontent.com"]
    private static func isInside(_ url: URL) -> Bool {
        guard let host = url.host else { return true }
        return inside.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.navigationType == .linkActivated, let url = action.request.url, !Page.isInside(url) {
            open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // target=_blank has no second window here: load it in this one, or hand it out
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if Page.isInside(url) { webView.load(URLRequest(url: url)) } else { open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { error = nil }

    private func fail(_ e: Error) {
        let ns = e as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        error = e.localizedDescription
    }

    // THE WIDGET'S FOOD. The page posts a JSON of the coming weeks; it is kept in
    // the App Group, where the widget — a separate process — can read it, and the
    // widget is told to redraw. The widget never talks to Google or Cloudflare.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "almanakk", let json = message.body as? String else { return }
        if Snapshot.write(json) { WidgetCenter.shared.reloadAllTimelines() }
    }

    private func open(_ url: URL) {
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #else
        UIApplication.shared.open(url)
        #endif
    }
}

#if os(macOS)
typealias PlatformColor = NSColor
struct WebView: NSViewRepresentable {
    let page: Page
    func makeNSView(context: Context) -> WKWebView { page.make() }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
typealias PlatformColor = UIColor
struct WebView: UIViewRepresentable {
    let page: Page
    func makeUIView(context: Context) -> WKWebView { page.make() }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif
