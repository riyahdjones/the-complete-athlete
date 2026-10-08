import UIKit
import Capacitor
import StoreKit
import WidgetKit
import Speech
import AVFoundation

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
        bridge?.registerPluginInstance(TCAVoiceCoachPlugin())
        bridge?.registerPluginInstance(TCAPlanAudioPlugin())
        bridge?.registerPluginInstance(TCAHapticsPlugin())
    }
}

@objc(TCAHapticsPlugin)
public class TCAHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TCAHapticsPlugin"
    public let jsName = "TCAHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pointsEarned", returnType: CAPPluginReturnPromise)
    ]

    @objc func pointsEarned(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
            call.resolve()
        }
    }
}

@objc(TCAPlanAudioPlugin)
public class TCAPlanAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TCAPlanAudioPlugin"
    public let jsName = "TCAPlanAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activatePlanAudioSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivatePlanAudioSession", returnType: CAPPluginReturnPromise)
    ]

    @objc func activatePlanAudioSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
                try session.setActive(true)
                call.resolve()
            } catch {
                call.reject("Plan audio could not start.", "PLAN_AUDIO_SESSION_FAILED", error)
            }
        }
    }

    @objc func deactivatePlanAudioSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
                call.resolve()
            } catch {
                call.reject("Plan audio could not close.", "PLAN_AUDIO_SESSION_CLOSE_FAILED", error)
            }
        }
    }
}

@objc(TCAVoiceCoachPlugin)
public class TCAVoiceCoachPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "TCAVoiceCoachPlugin"
    public let jsName = "TCAVoiceCoach"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestVoicePermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSpeaking", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private let speechSynthesizer = AVSpeechSynthesizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var inputTapInstalled = false
    private var latestTranscript = ""

    @objc func requestVoicePermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            AVAudioSession.sharedInstance().requestRecordPermission { microphoneAllowed in
                DispatchQueue.main.async {
                    call.resolve([
                        "speech": speechStatus == .authorized,
                        "microphone": microphoneAllowed
                    ])
                }
            }
        }
    }

    @objc func startListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard SFSpeechRecognizer.authorizationStatus() == .authorized,
                  AVAudioSession.sharedInstance().recordPermission == .granted else {
                call.reject("Microphone or speech recognition permission denied.", "PERMISSION_DENIED")
                return
            }

            let localeIdentifier = call.getString("locale") ?? "en-US"
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)), recognizer.isAvailable else {
                call.reject("Speech recognition is temporarily unavailable.", "SPEECH_UNAVAILABLE")
                return
            }

            self.stopRecognition()
            self.speechSynthesizer.stopSpeaking(at: .immediate)
            self.latestTranscript = ""

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            self.recognitionRequest = request

            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
                try session.setActive(true, options: .notifyOthersOnDeactivation)

                let inputNode = self.audioEngine.inputNode
                let recordingFormat = inputNode.outputFormat(forBus: 0)
                guard recordingFormat.sampleRate > 0 else {
                    call.reject("The microphone is unavailable.", "MICROPHONE_UNAVAILABLE")
                    return
                }
                inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                    request.append(buffer)
                }
                self.inputTapInstalled = true
                self.audioEngine.prepare()
                try self.audioEngine.start()
            } catch {
                self.stopRecognition()
                call.reject("Voice Coach could not access the microphone.", "MICROPHONE_START_FAILED", error)
                return
            }

            self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                DispatchQueue.main.async {
                    if let result {
                        let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                        self.latestTranscript = text
                        self.notifyListeners("voiceTranscript", data: [
                            "text": text,
                            "isFinal": result.isFinal
                        ])
                        if result.isFinal {
                            self.stopRecognition()
                        }
                    }
                    if let error, self.audioEngine.isRunning {
                        self.notifyListeners("voiceError", data: ["message": error.localizedDescription])
                        self.stopRecognition()
                    }
                }
            }

            self.notifyListeners("voiceListening", data: ["active": true])
            call.resolve()
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let text = self.latestTranscript
            self.stopRecognition()
            call.resolve(["text": text])
        }
    }

    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text")?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
            call.reject("There is no coach response to read.")
            return
        }

        DispatchQueue.main.async {
            self.stopRecognition()
            self.speechSynthesizer.stopSpeaking(at: .immediate)
            self.speechSynthesizer.delegate = self

            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                call.reject("Voice playback could not start.", "VOICE_PLAYBACK_FAILED", error)
                return
            }

            let utterance = AVSpeechUtterance(string: text)
            let localeIdentifier = call.getString("locale") ?? "en-US"
            utterance.voice = AVSpeechSynthesisVoice(language: localeIdentifier)
            let requestedRate = Float(call.getDouble("rate") ?? Double(AVSpeechUtteranceDefaultSpeechRate))
            utterance.rate = min(max(requestedRate, 0.38), 0.58)
            utterance.pitchMultiplier = 0.96
            utterance.preUtteranceDelay = 0.08
            self.speechSynthesizer.speak(utterance)
            call.resolve()
        }
    }

    @objc func stopSpeaking(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.speechSynthesizer.stopSpeaking(at: .immediate)
            self.notifyListeners("voiceSpeaking", data: ["active": false])
            call.resolve()
        }
    }

    private func stopRecognition() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if inputTapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            inputTapInstalled = false
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        notifyListeners("voiceListening", data: ["active": false])
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        notifyListeners("voiceSpeaking", data: ["active": true])
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        notifyListeners("voiceSpeaking", data: ["active": false])
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        notifyListeners("voiceSpeaking", data: ["active": false])
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
