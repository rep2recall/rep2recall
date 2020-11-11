package rep2recall.api

import rep2recall.db.PresetSer
import rep2recall.db.PresetStatus

data class CreateResponse(
        val id: String
)

data class StdSuccessResponse(
        val result: String
)

data class StdErrorResponse(
        val error: String
)

data class PresetGetAllResponse(
        val result: List<PresetSer>
)

data class QuizQueryRequest(
        val q: String,
        val decks: List<String>,
        val status: PresetStatus
)

data class QuizQueryResponse(
        val result: List<String>
)

data class TreeviewRequest(
        val q: String,
        val status: PresetStatus
)

data class TreeviewItem(
        val deck: List<String>,
        val new: Int,
        val due: Int,
        val leech: Int
)

data class TreeviewResponse(
        val result: List<TreeviewItem>
)