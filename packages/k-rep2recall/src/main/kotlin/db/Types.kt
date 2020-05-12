package rep2recall.db

typealias DateString = String

data class Stat (
    val streak: StatStreak,
    val lastRight: DateString,
    val lastWrong: DateString
)

data class StatStreak (
    val right: Int,
    val wrong: Int,
    val maxRight: Int,
    val maxWrong: Int
)

data class Lesson (
    val name: String,
    val deck: String
)