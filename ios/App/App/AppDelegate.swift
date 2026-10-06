import UIKit
import Capacitor
import StoreKit
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}

// System authentication browser keeps Google/Apple sign-in outside WKWebView.
import AuthenticationServices

class TCAViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TCAAuthPlugin())
        bridge?.registerPluginInstance(TCAReviewPlugin())
        bridge?.registerPluginInstance(TCAGoalWidgetPlugin())
    }
}

@objc(TCAGoalWidgetPlugin)
public class TCAGoalWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TCAGoalWidgetPlugin"
    public let jsName = "TCAGoalWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncGoals", returnType: CAPPluginReturnPromise)
    ]

    @objc func syncGoals(_ call: CAPPluginCall) {
        guard let goals = call.getArray("goals", JSObject.self),
              JSONSerialization.isValidJSONObject(goals),
              let data = try? JSONSerialization.data(withJSONObject: goals),
              let defaults = UserDefaults(suiteName: "group.com.riyahdjones.thecompleteathlete") else {
            call.reject("Goal widgets could not be updated.")
            return
        }

        defaults.set(data, forKey: "goal-widget-goals")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

@objc(TCAReviewPlugin)
public class TCAReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TCAReviewPlugin"
    public let jsName = "TCAReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *), let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) {
                SKStoreReviewController.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview()
            }
            call.resolve()
        }
    }
}

@objc(TCAAuthPlugin)
public class TCAAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "TCAAuthPlugin"
    public let jsName = "TCAAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]
    private var authSession: ASWebAuthenticationSession?

    @objc func authenticate(_ call: CAPPluginCall) {
        guard let rawURL = call.getString("url"), let url = URL(string: rawURL),
              url.scheme == "https", url.host == "nddtgwygnzjikjynrzen.supabase.co",
              url.path == "/auth/v1/authorize" else {
            call.reject("Invalid authentication URL.")
            return
        }
        DispatchQueue.main.async {
            guard self.authSession == nil else { call.reject("Sign-in is already open."); return }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.riyahdjones.thecompleteathlete") { [weak self] callback, error in
                self?.authSession = nil
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Sign-in canceled.", "CANCELLED")
                } else if let callback = callback {
                    call.resolve(["url": callback.absoluteString])
                } else {
                    call.reject("Sign-in could not be completed. Please try again.")
                }
            }
            session.presentationContextProvider = self
            self.authSession = session
            if !session.start() {
                self.authSession = nil
                call.reject("Unable to open sign-in.")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
