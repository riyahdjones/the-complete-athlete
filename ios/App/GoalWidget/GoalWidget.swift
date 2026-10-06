import AppIntents
import SwiftUI
import WidgetKit

private let goalWidgetAppGroup = "group.com.riyahdjones.thecompleteathlete"
private let goalWidgetStorageKey = "goal-widget-goals"

struct SharedGoal: Codable, Identifiable {
    let id: String
    let name: String
    let detail: String
    let progress: Int
    let linkedActivity: String
}

enum SharedGoalStore {
    static func goals() -> [SharedGoal] {
        guard let defaults = UserDefaults(suiteName: goalWidgetAppGroup),
              let data = defaults.data(forKey: goalWidgetStorageKey),
              let goals = try? JSONDecoder().decode([SharedGoal].self, from: data) else {
            return []
        }
        return goals
    }
}

struct GoalEntity: AppEntity, Identifiable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Goal")
    static let defaultQuery = GoalEntityQuery()

    let id: String
    let name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct GoalEntityQuery: EntityQuery {
    func entities(for identifiers: [GoalEntity.ID]) async throws -> [GoalEntity] {
        SharedGoalStore.goals()
            .filter { identifiers.contains($0.id) }
            .map { GoalEntity(id: $0.id, name: $0.name) }
    }

    func suggestedEntities() async throws -> [GoalEntity] {
        SharedGoalStore.goals().map { GoalEntity(id: $0.id, name: $0.name) }
    }

    func defaultResult() async -> GoalEntity? {
        SharedGoalStore.goals().first.map { GoalEntity(id: $0.id, name: $0.name) }
    }
}

struct SelectGoalIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Choose a Goal"
    static let description = IntentDescription("Select the goal this widget displays.")

    @Parameter(title: "Goal")
    var goal: GoalEntity?

    init() {}

    init(goal: GoalEntity?) {
        self.goal = goal
    }
}

struct GoalWidgetEntry: TimelineEntry {
    let date: Date
    let goal: SharedGoal?
}

struct GoalWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> GoalWidgetEntry {
        GoalWidgetEntry(
            date: Date(),
            goal: SharedGoal(id: "preview", name: "Get Stronger", detail: "Build the work one day at a time.", progress: 42, linkedActivity: "Complete today’s strength session")
        )
    }

    func snapshot(for configuration: SelectGoalIntent, in context: Context) async -> GoalWidgetEntry {
        GoalWidgetEntry(date: Date(), goal: selectedGoal(configuration))
    }

    func timeline(for configuration: SelectGoalIntent, in context: Context) async -> Timeline<GoalWidgetEntry> {
        let entry = GoalWidgetEntry(date: Date(), goal: selectedGoal(configuration))
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60)))
    }

    private func selectedGoal(_ configuration: SelectGoalIntent) -> SharedGoal? {
        let goals = SharedGoalStore.goals()
        guard let selectedId = configuration.goal?.id else { return goals.first }
        return goals.first(where: { $0.id == selectedId }) ?? goals.first
    }
}

struct GoalWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: GoalWidgetEntry

    var body: some View {
        Group {
            if let goal = entry.goal {
                goalContent(goal)
                    .widgetURL(URL(string: "com.riyahdjones.thecompleteathlete://goal?id=\(goal.id)"))
            } else {
                emptyContent
            }
        }
        .containerBackground(for: .widget) {
            LinearGradient(
                colors: [Color(red: 0.03, green: 0.12, blue: 0.30), Color(red: 0.02, green: 0.06, blue: 0.16)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private func goalContent(_ goal: SharedGoal) -> some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 8 : 10) {
            HStack {
                Text("MY GOAL")
                    .font(.caption2.weight(.bold))
                    .tracking(1.1)
                    .foregroundStyle(Color(red: 0.39, green: 0.66, blue: 1.0))
                Spacer()
                Text("\(goal.progress)%")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            }

            Text(goal.name)
                .font(family == .systemSmall ? .headline.weight(.bold) : .title3.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(2)

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.18))
                    Capsule()
                        .fill(Color(red: 0.10, green: 0.43, blue: 1.0))
                        .frame(width: proxy.size.width * CGFloat(goal.progress) / 100)
                }
            }
            .frame(height: 7)

            if family != .systemSmall {
                Text(goal.detail)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color(red: 0.22, green: 0.55, blue: 1.0))
                Text(goal.linkedActivity)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.92))
                    .lineLimit(family == .systemSmall ? 2 : 1)
            }
        }
        .padding(2)
    }

    private var emptyContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("THE COMPLETE ATHLETE")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Color(red: 0.39, green: 0.66, blue: 1.0))
            Text("Add a goal in the app to see it here.")
                .font(.headline.weight(.bold))
                .foregroundStyle(.white)
            Spacer()
            Text("Open The Complete Athlete")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.72))
        }
        .padding(2)
        .widgetURL(URL(string: "com.riyahdjones.thecompleteathlete://goals"))
    }
}

struct GoalWidget: Widget {
    private let kind = "TheCompleteAthleteGoalWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectGoalIntent.self, provider: GoalWidgetProvider()) { entry in
            GoalWidgetView(entry: entry)
        }
        .configurationDisplayName("My Goal")
        .description("Keep your goal and today’s next action visible.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct TheCompleteAthleteGoalWidgetBundle: WidgetBundle {
    var body: some Widget {
        GoalWidget()
    }
}
